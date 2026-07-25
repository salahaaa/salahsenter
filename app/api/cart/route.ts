export const dynamic = "force-dynamic";

import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, productVariants, products, shoppingCartItems, shoppingCarts, stores } from "@/lib/db";
import { inlineMediaSql } from "@/lib/inline-media";

const cartItemInput = z.object({ productId: z.string().uuid(), variantId: z.string().uuid(), quantity: z.coerce.number().int().positive().max(999).default(1) });
const cartPostSchema = z.object({ mode: z.enum(["merge", "replace"]).optional().default("merge"), items: z.array(cartItemInput).default([]) });

async function getActiveCart(userId: string, tx: any = db) {
  const [cart] = await tx.select().from(shoppingCarts).where(and(eq(shoppingCarts.userId, userId), eq(shoppingCarts.status, "active"))).orderBy(desc(shoppingCarts.updatedAt)).limit(1);
  if (cart) return cart;
  const [created] = await tx.insert(shoppingCarts).values({ userId, status: "active" }).returning();
  return created;
}

async function getCartPayload(userId: string) {
  const cart = await getActiveCart(userId);
  const rows = await db
    .select({
      id: shoppingCartItems.id,
      cartId: shoppingCartItems.cartId,
      storeId: shoppingCartItems.storeId,
      productId: shoppingCartItems.productId,
      variantId: shoppingCartItems.variantId,
      quantity: shoppingCartItems.quantity,
      price: productVariants.price,
      compareAtPrice: productVariants.compareAtPrice,
      productName: products.name,
      productSlug: products.slug,
      variantTitle: productVariants.title,
      imageUrl: inlineMediaSql("products", products.id, "mainImageUrl", products.mainImageUrl),
      storeName: stores.name,
      storeSlug: stores.slug,
      stockQuantity: productVariants.stockQuantity,
      isActive: productVariants.isActive,
      productStatus: products.status,
      storeStatus: stores.status,
      storeActive: stores.isActive,
      productCommerceType: products.productCommerceType,
      publishAt: products.publishAt,
      unpublishAt: products.unpublishAt
    })
    .from(shoppingCartItems)
    .innerJoin(productVariants, eq(shoppingCartItems.variantId, productVariants.id))
    .innerJoin(products, eq(shoppingCartItems.productId, products.id))
    .innerJoin(stores, eq(shoppingCartItems.storeId, stores.id))
    .where(eq(shoppingCartItems.cartId, cart.id))
    .orderBy(desc(shoppingCartItems.createdAt));

  const items = rows.map((row) => ({
    id: `${row.productId}:${row.variantId}`,
    cartItemId: row.id,
    productId: row.productId,
    variantId: row.variantId,
    storeId: row.storeId,
    storeSlug: row.storeSlug,
    storeName: row.storeName,
    name: row.productName,
    variantTitle: row.variantTitle,
    href: `/store/${row.storeSlug}/products/${row.productSlug}`,
    imageUrl: row.imageUrl,
    price: row.price,
    compareAtPrice: row.compareAtPrice,
    quantity: row.quantity,
    stockQuantity: row.stockQuantity,
    available: row.isActive && row.productStatus === "active" && row.storeStatus === "active" && row.storeActive && row.productCommerceType !== "SHOWCASE_ONLY" && (!row.publishAt || new Date(row.publishAt) <= new Date()) && (!row.unpublishAt || new Date(row.unpublishAt) >= new Date()),
    productCommerceType: row.productCommerceType
  }));
  return { cart, items };
}

export async function GET() {
  try {
    const session = await requireAuth();
    return ok(await getCartPayload(session.userId));
  } catch (error) {
    return handleApiError(error, "تعذر تحميل السلة");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = cartPostSchema.parse(await request.json());
    const merged = Array.from(payload.items.reduce((map, item) => {
      const existing = map.get(item.variantId);
      if (existing) existing.quantity += item.quantity;
      else map.set(item.variantId, { ...item });
      return map;
    }, new Map<string, z.infer<typeof cartItemInput>>()).values());

    await db.transaction(async (tx) => {
      const cart = await getActiveCart(session.userId, tx);
      if (payload.mode === "replace") await tx.delete(shoppingCartItems).where(eq(shoppingCartItems.cartId, cart.id));
      if (!merged.length) {
        await tx.update(shoppingCarts).set({ updatedAt: new Date() }).where(eq(shoppingCarts.id, cart.id));
        return;
      }
      const variantRows = await tx
        .select({
          variantId: productVariants.id,
          productId: productVariants.productId,
          storeId: products.storeId,
          price: productVariants.price,
          variantActive: productVariants.isActive,
          productStatus: products.status,
          storeStatus: stores.status,
          storeActive: stores.isActive,
          productCommerceType: products.productCommerceType,
          publishAt: products.publishAt,
          unpublishAt: products.unpublishAt
        })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .innerJoin(stores, eq(products.storeId, stores.id))
        .where(inArray(productVariants.id, merged.map((item) => item.variantId)));
      for (const item of merged) {
        const row = variantRows.find((variant) => variant.variantId === item.variantId && variant.productId === item.productId);
        if (!row) throw new Error("منتج في السلة غير موجود أو لا يطابق المتغير");
        if (!row.variantActive || row.productStatus !== "active" || row.storeStatus !== "active" || !row.storeActive) throw new Error("أحد منتجات السلة غير متاح حالياً");
        if (row.productCommerceType === "SHOWCASE_ONLY") throw new Error("هذا الصنف للعرض فقط ولا يدعم السلة أو الشراء الإلكتروني");
        if (row.publishAt && new Date(row.publishAt) > new Date() || row.unpublishAt && new Date(row.unpublishAt) < new Date()) throw new Error("هذا العرض أو المنتج خارج فترة النشر حالياً");
        await tx
          .insert(shoppingCartItems)
          .values({ cartId: cart.id, productId: row.productId, variantId: row.variantId, storeId: row.storeId, quantity: item.quantity, unitPriceSnapshot: row.price })
          .onConflictDoUpdate({ target: [shoppingCartItems.cartId, shoppingCartItems.variantId], set: { quantity: item.quantity, unitPriceSnapshot: row.price, updatedAt: new Date() } });
      }
      await tx.update(shoppingCarts).set({ updatedAt: new Date() }).where(eq(shoppingCarts.id, cart.id));
    });

    return ok({ ...(await getCartPayload(session.userId)), message: "تم تحديث السلة" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث السلة");
  }
}

export async function DELETE() {
  try {
    const session = await requireAuth();
    const cart = await getActiveCart(session.userId);
    await db.delete(shoppingCartItems).where(eq(shoppingCartItems.cartId, cart.id));
    await db.update(shoppingCarts).set({ updatedAt: new Date() }).where(eq(shoppingCarts.id, cart.id));
    return ok({ message: "تم تفريغ السلة" });
  } catch (error) {
    return handleApiError(error, "تعذر تفريغ السلة");
  }
}
