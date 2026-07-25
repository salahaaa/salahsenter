export const dynamic = "force-dynamic";

import { and, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, productVariants, products, stores } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";
import { isStoreOperational } from "@/lib/store-guards";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePrivateApiCacheTags } from "@/lib/cache/private-api-cache";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

function merchantProductsCacheTag(storeId: string) { return `merchant:products:${storeId}`; }
function merchantInventoryCacheTag(storeId: string) { return `merchant:inventory:${storeId}`; }

const schema = z.object({
  scope: z.enum(["filtered", "ids"]).default("filtered"),
  productIds: z.array(z.string().uuid()).default([]),
  filters: z.object({ q: z.string().optional().default(""), status: z.string().optional().default(""), categoryId: z.string().optional().default("") }).default({}),
  adjustmentType: z.enum(["percentage", "amount"]),
  direction: z.enum(["increase", "decrease"]),
  value: z.coerce.number().positive(),
  updateBasePrice: z.boolean().default(true)
});

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

function nextPrice(current: unknown, input: { adjustmentType: "percentage" | "amount"; direction: "increase" | "decrease"; value: number }) {
  const base = Number(current || 0);
  const delta = input.adjustmentType === "percentage" ? base * (input.value / 100) : input.value;
  const raw = input.direction === "increase" ? base + delta : base - delta;
  return Math.max(0, Number(raw.toFixed(2)));
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية إدارة هذا المتجر", 403);
    if (!(await userHasAnyStorePermission(session.userId, store.id, ["store.products.prices.change", Permission.ManageProducts]))) return fail("لا تملك صلاحية إدارة المنتجات", 403);
    if (!(await isStoreOperational(store.id))) return fail("المتجر مجمد أو غير مفعل؛ لا يمكن تعديل الأسعار", 403);

    const conditions: SQL[] = [eq(products.storeId, store.id)];
    if (payload.scope === "ids") {
      if (!payload.productIds.length) return fail("اختر منتجات للتعديل", 422);
      conditions.push(inArray(products.id, payload.productIds));
    } else {
      const q = payload.filters.q?.trim() || "";
      const status = payload.filters.status || "";
      const categoryId = payload.filters.categoryId || "";
      if (q) {
        const term = `%${q}%`;
        conditions.push(or(ilike(products.name, term), ilike(products.productCode, term), ilike(products.barcode, term), ilike(products.slug, term))!);
      }
      if (["draft", "active", "inactive", "archived"].includes(status)) conditions.push(eq(products.status, status as any));
      if (isUuid(categoryId)) conditions.push(eq(products.categoryId, categoryId));
    }

    const productRows = await db.select({ id: products.id, basePrice: products.basePrice }).from(products).where(and(...conditions)).limit(5000);
    if (!productRows.length) return fail("لا توجد منتجات مطابقة للتعديل", 404);
    const productIds = productRows.map((product) => product.id);
    const variantRows = await db.select({ id: productVariants.id, price: productVariants.price }).from(productVariants).where(inArray(productVariants.productId, productIds)).limit(20000);

    const result = await db.transaction(async (tx) => {
      let updatedProducts = 0;
      let updatedVariants = 0;
      if (payload.updateBasePrice) {
        for (const product of productRows) {
          if (product.basePrice == null) continue;
          await tx.update(products).set({ basePrice: nextPrice(product.basePrice, payload).toString(), updatedAt: new Date() }).where(eq(products.id, product.id));
          updatedProducts += 1;
        }
      }
      for (const variant of variantRows) {
        await tx.update(productVariants).set({ price: nextPrice(variant.price, payload).toString(), updatedAt: new Date() }).where(eq(productVariants.id, variant.id));
        updatedVariants += 1;
      }
      return { updatedProducts, updatedVariants };
    });

    await invalidatePrivateApiCacheTags([merchantProductsCacheTag(store.id), merchantInventoryCacheTag(store.id)]);
    await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.products, PUBLIC_CACHE_TAGS.storeSlug(store.slug)], paths: ["/", `/store/${store.slug}`] });
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "bulk_product_prices", entityId: store.id, afterData: { ...payload, productCount: productRows.length, variantCount: variantRows.length, result } });
    return ok({ ...result, matchedProducts: productRows.length, message: `تم تعديل أسعار ${result.updatedVariants} متغير و ${result.updatedProducts} سعر أساسي` });
  } catch (error) {
    return handleApiError(error, "تعذر تنفيذ التعديل الجماعي للأسعار");
  }
}
