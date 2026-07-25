export const dynamic = "force-dynamic";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, products, productVariants, storeOfferCollections } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePrivateApiCacheTags } from "@/lib/cache/private-api-cache";

function merchantInventoryCacheTag(storeId: string) { return `merchant:inventory:${storeId}`; }
function merchantProductsCacheTag(storeId: string) { return `merchant:products:${storeId}`; }

const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("category_price"), categoryId: z.string().uuid(), adjustmentType: z.enum(["percent", "fixed"]), value: z.coerce.number() }),
  z.object({ mode: z.literal("all_low_stock_threshold"), threshold: z.coerce.number().int().min(0) })
]);

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return fail("لا يوجد متجر", 403);
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية هذا المتجر", 403);
    if (!(await userHasAnyStorePermission(session.userId, store.id, ["store.inventory.manage", Permission.ManageInventory]))) return fail("لا تملك صلاحية إدارة المخزون", 403);
    const payload = schema.parse(await request.json());

    if (payload.mode === "category_price") {
      const expression = payload.adjustmentType === "percent"
        ? sql`${productVariants.price}::numeric * ${(100 + payload.value) / 100}`
        : sql`${productVariants.price}::numeric + ${payload.value}`;
      const updated = await db
        .update(productVariants)
        .set({ price: sql`greatest(0, ${expression})`, updatedAt: new Date() })
        .where(sql`${productVariants.productId} in (select ${products.id} from ${products} where ${products.storeId} = ${store.id} and ${products.categoryId} = ${payload.categoryId}) and not exists (select 1 from ${storeOfferCollections} where ${storeOfferCollections.offerProductId} = ${productVariants.productId})`)
        .returning({ id: productVariants.id });
      await writeAuditLog({ actorId: session.userId, action: "update", category: "inventory", entityType: "inventory.bulk_category_price", entityId: payload.categoryId, afterData: { count: updated.length, payload } });
      await invalidatePrivateApiCacheTags([merchantInventoryCacheTag(store.id), merchantProductsCacheTag(store.id)]);
      return ok({ count: updated.length, message: "تم تعديل أسعار الصنف المحدد" });
    }

    const updated = await db
      .update(productVariants)
      .set({ lowStockThreshold: payload.threshold, updatedAt: new Date() })
      .where(sql`${productVariants.productId} in (select ${products.id} from ${products} where ${products.storeId} = ${store.id}) and not exists (select 1 from ${storeOfferCollections} where ${storeOfferCollections.offerProductId} = ${productVariants.productId})`)
      .returning({ id: productVariants.id });
    await writeAuditLog({ actorId: session.userId, action: "update", category: "inventory", entityType: "inventory.bulk_low_stock_threshold", entityId: store.id, afterData: { count: updated.length, threshold: payload.threshold } });
    await invalidatePrivateApiCacheTags([merchantInventoryCacheTag(store.id), merchantProductsCacheTag(store.id)]);
    return ok({ count: updated.length, message: "تم تحديث حد التنبيه للمخزون بالكامل" });
  } catch (error) {
    return handleApiError(error, "تعذر تنفيذ التعديل الجماعي");
  }
}
