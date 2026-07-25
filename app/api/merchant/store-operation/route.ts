export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, stores } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { Permission, userHasStorePermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

const schema = z.object({
  storeId: z.string().uuid().optional(),
  operationStatus: z.enum(["OPEN", "CLOSED", "VACATION", "PAUSED"]),
  operationNote: z.string().max(500).optional().nullable(),
  businessHours: z.record(z.unknown()).default({})
});

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const primary = await getMerchantPrimaryStore(session.userId);
    const storeId = payload.storeId || primary?.id;
    if (!storeId) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, storeId)) return fail("لا تملك صلاحية هذا المتجر", 403);
    if (!(await userHasStorePermission(session.userId, storeId, Permission.ManageStoreSettings))) return fail("لا تملك صلاحية إعدادات المتجر", 403);
    const [before] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
    if (!before) return fail("المتجر غير موجود", 404);
    const [store] = await db.update(stores).set({
      operationStatus: payload.operationStatus,
      operationNote: payload.operationNote || null,
      businessHours: payload.businessHours,
      operationStatusUpdatedAt: new Date(),
      updatedAt: new Date()
    }).where(eq(stores.id, storeId)).returning();
    await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.stores, PUBLIC_CACHE_TAGS.storeSlug(store.slug)], paths: ["/", `/store/${store.slug}`] });
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "store_operation_status", entityId: storeId, beforeData: { operationStatus: before.operationStatus, operationNote: before.operationNote, businessHours: before.businessHours }, afterData: { operationStatus: store.operationStatus, operationNote: store.operationNote, businessHours: store.businessHours } });
    return ok({ store, message: "تم تحديث حالة تشغيل المحل" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث حالة تشغيل المحل");
  }
}
