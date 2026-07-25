export const dynamic = "force-dynamic";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, inventoryMovements, products, productVariants } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { parseListQuery } from "@/lib/api-list-utils";
import { writeAuditLog } from "@/lib/audit";
import { isStoreOperational } from "@/lib/store-guards";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";
import { apiCacheKey, cacheHeader, getCachedPrivateApi, invalidatePrivateApiCacheTags } from "@/lib/cache/private-api-cache";
import { assertNotGeneratedOfferInventory } from "@/lib/offers/guards";

function merchantInventoryCacheTag(storeId: string) { return `merchant:inventory:${storeId}`; }
function merchantProductsCacheTag(storeId: string) { return `merchant:products:${storeId}`; }

const movementSchema = z.object({
  storeId: z.string().uuid().optional(),
  variantId: z.string().uuid(),
  type: z.enum(["add", "deduct", "adjust"]),
  quantity: z.coerce.number().int().positive(),
  reason: z.string().optional()
});

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return ok({ variants: [], movements: [], movementsPage: 1, movementsTotalCount: 0, movementsHasNext: false });
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية عرض هذا المتجر", 403);
    if (!(await userHasAnyStorePermission(session.userId, store.id, ["store.inventory.view", "store.inventory.manage", Permission.ManageInventory]))) return fail("لا تملك صلاحية عرض المخزون", 403);

    const { page, pageSize, offset, q } = parseListQuery(request, { defaultPageSize: 50 });
    const variantConditions = [eq(products.storeId, store.id)];
    if (q) {
      const term = `%${q}%`;
      variantConditions.push(or(ilike(products.name, term), ilike(productVariants.sku, term), ilike(productVariants.title, term), ilike(productVariants.barcode, term))!);
    }
    const variantWhere = and(...variantConditions);

    const cached = await getCachedPrivateApi(
      apiCacheKey(["merchant:inventory", session.userId, store.id, page, pageSize, q]),
      async () => {
        const [variants, movements, [{ count: movementsTotalCount }]] = await Promise.all([
          db
            .select({
              variantId: productVariants.id,
              sku: productVariants.sku,
              title: productVariants.title,
              price: productVariants.price,
              stockQuantity: productVariants.stockQuantity,
              reservedQuantity: productVariants.reservedQuantity,
              availableQuantity: sql<number>`greatest(${productVariants.stockQuantity} - ${productVariants.reservedQuantity}, 0)::int`,
              lowStockThreshold: productVariants.lowStockThreshold,
              productId: products.id,
              productName: products.name
            })
            .from(productVariants)
            .innerJoin(products, eq(productVariants.productId, products.id))
            .where(variantWhere)
            .orderBy(desc(productVariants.updatedAt))
            .limit(200),
          db
            .select({
              id: inventoryMovements.id,
              productId: inventoryMovements.productId,
              variantId: inventoryMovements.variantId,
              type: inventoryMovements.type,
              quantity: inventoryMovements.quantity,
              beforeQuantity: inventoryMovements.beforeQuantity,
              afterQuantity: inventoryMovements.afterQuantity,
              reason: inventoryMovements.reason,
              actorId: inventoryMovements.actorId,
              createdAt: inventoryMovements.createdAt
            })
            .from(inventoryMovements)
            .where(eq(inventoryMovements.storeId, store.id))
            .orderBy(desc(inventoryMovements.createdAt))
            .limit(pageSize)
            .offset(offset),
          db.select({ count: sql<number>`count(*)::int` }).from(inventoryMovements).where(eq(inventoryMovements.storeId, store.id))
        ]);

        return {
          variants,
          movements,
          movementsPage: page,
          movementsPageSize: pageSize,
          movementsTotalCount: movementsTotalCount,
          movementsHasNext: offset + movements.length < movementsTotalCount
        };
      },
      { ttlSeconds: 15, tags: [merchantInventoryCacheTag(store.id)], encrypted: true }
    );
    const response = ok(cached.value);
    response.headers.set("x-redis-cache", cacheHeader(cached.hit));
    return response;
  } catch (error) {
    return handleApiError(error, "تعذر تحميل المخزون");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = movementSchema.parse(await request.json());
    const primaryStore = await getMerchantPrimaryStore(session.userId);
    const storeId = payload.storeId || primaryStore?.id;
    if (!storeId) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, storeId)) return fail("لا تملك صلاحية إدارة هذا المتجر", 403);
    if (!(await userHasAnyStorePermission(session.userId, storeId, ["store.inventory.manage", Permission.ManageInventory]))) return fail("لا تملك صلاحية إدارة المخزون", 403);
    if (!(await isStoreOperational(storeId))) return fail("المتجر مجمد أو غير مفعل؛ لا يمكن تنفيذ عمليات تشغيلية حتى إعادة فتحه من الأدمن", 403);

    const result = await db.transaction(async (tx) => {
      const [variant] = await tx
        .select({ variantId: productVariants.id, productId: products.id, storeId: products.storeId, stockQuantity: productVariants.stockQuantity })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(and(eq(productVariants.id, payload.variantId), eq(products.storeId, storeId)))
        .limit(1);

      if (!variant) throw new Error("المتغير غير موجود داخل هذا المتجر");
      await assertNotGeneratedOfferInventory({ productId: variant.productId, variantId: variant.variantId, tx });
      const beforeQuantity = variant.stockQuantity;
      const afterQuantity = payload.type === "add" ? beforeQuantity + payload.quantity : payload.type === "deduct" ? beforeQuantity - payload.quantity : payload.quantity;
      if (afterQuantity < 0) throw new Error("لا يمكن أن يصبح المخزون أقل من صفر");

      const [updatedVariant] = await tx
        .update(productVariants)
        .set({ stockQuantity: afterQuantity, updatedAt: new Date() })
        .where(eq(productVariants.id, payload.variantId))
        .returning();

      const [movement] = await tx
        .insert(inventoryMovements)
        .values({
          storeId,
          productId: variant.productId,
          variantId: payload.variantId,
          type: payload.type,
          quantity: payload.quantity,
          beforeQuantity,
          afterQuantity,
          reason: payload.reason,
          actorId: session.userId
        })
        .returning();

      return { variant: updatedVariant, movement };
    });

    await writeAuditLog({ actorId: session.userId, action: "update", category: "inventory", entityType: "inventory.adjustment", entityId: payload.variantId, afterData: result });
    await invalidatePrivateApiCacheTags([merchantInventoryCacheTag(storeId), merchantProductsCacheTag(storeId)]);
    return created({ ...result, message: "تم تحديث المخزون بنجاح" });
  } catch (error) {
    if (error instanceof Error) return fail(error.message, 400);
    return handleApiError(error, "تعذر تحديث المخزون");
  }
}
