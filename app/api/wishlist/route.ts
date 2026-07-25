export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, products, stores, wishlists } from "@/lib/db";
import { inlineMediaSql } from "@/lib/inline-media";

export async function GET() {
  try {
    const session = await requireAuth();
    const items = await db
      .select({
        id: wishlists.id,
        productId: products.id,
        name: products.name,
        slug: products.slug,
        imageUrl: inlineMediaSql("products", products.id, "mainImageUrl", products.mainImageUrl),
        basePrice: products.basePrice,
        storeId: stores.id,
        storeName: stores.name,
        storeSlug: stores.slug,
        createdAt: wishlists.createdAt
      })
      .from(wishlists)
      .innerJoin(products, eq(wishlists.productId, products.id))
      .innerJoin(stores, eq(wishlists.storeId, stores.id))
      .where(eq(wishlists.userId, session.userId))
      .orderBy(desc(wishlists.createdAt));
    return ok({ items });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل المفضلة");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { productId } = await request.json();
    if (!productId) return fail("productId مطلوب", 422);
    const [product] = await db.select({ id: products.id, storeId: products.storeId }).from(products).where(eq(products.id, productId)).limit(1);
    if (!product) return fail("المنتج غير موجود", 404);
    const [item] = await db.insert(wishlists).values({ userId: session.userId, productId: product.id, storeId: product.storeId }).onConflictDoNothing().returning();
    return created({ item, message: "تمت إضافة المنتج للمفضلة" });
  } catch (error) {
    return handleApiError(error, "تعذر إضافة المنتج للمفضلة");
  }
}
