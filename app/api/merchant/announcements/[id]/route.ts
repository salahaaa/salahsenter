export const dynamic = "force-dynamic";

import { and, eq, sql } from "drizzle-orm";
import { ApiError, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { announcements, db } from "@/lib/db";
import { announcementSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";
import { Permission, userHasStorePermission } from "@/lib/rbac";
import { getAdvertisingSettings } from "@/lib/advertising-settings";
import { assertRentalLimit, lockRentalEntitlement } from "@/lib/rentals/service";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = announcementSchema.partial().parse(await request.json());
    const [before] = await db.select().from(announcements).where(and(eq(announcements.id, id), eq(announcements.level, "store"))).limit(1);
    if (!before || !before.storeId) return fail("الإعلان غير موجود", 404);
    if (!hasStoreAccess(session, before.storeId)) return fail("لا تملك صلاحية تعديل هذا الإعلان", 403);
    if (!(await userHasStorePermission(session.userId, before.storeId, Permission.ManageAnnouncements))) return fail("لا تملك صلاحية إعلانات المتجر", 403);

    const updateData = {
      title: payload.title,
      summary: payload.summary,
      body: payload.body,
      imageUrl: payload.imageUrl || undefined,
      linkUrl: payload.linkUrl || undefined,
      isPinned: payload.isPinned,
      status: payload.status,
      isPromoted: payload.isPromoted,
      promotionPackage: payload.promotionPackage,
      startAt: payload.startAt ? new Date(payload.startAt) : undefined,
      endAt: payload.endAt ? new Date(payload.endAt) : undefined,
      promotionStart: payload.promotionStart ? new Date(payload.promotionStart) : payload.promotionStart === null ? null : undefined,
      promotionEnd: payload.promotionEnd ? new Date(payload.promotionEnd) : payload.promotionEnd === null ? null : undefined,
      updatedAt: new Date()
    };

    const nextStatus = payload.status ?? before.status;
    const nextPromoted = payload.isPromoted ?? before.isPromoted;
    const adSettings = await getAdvertisingSettings();
    const [item] = await db.transaction(async (tx) => {
      await lockRentalEntitlement(before.storeId!, tx);
      if (before.status !== "active" && nextStatus === "active") {
        const [{ count }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(announcements)
          .where(and(eq(announcements.storeId, before.storeId!), eq(announcements.level, "store"), eq(announcements.status, "active")));
        await assertRentalLimit({ storeId: before.storeId!, resource: "announcements", currentCount: count, tx });
        if (count >= adSettings.maxActiveStoreAnnouncements && !nextPromoted) {
          throw new ApiError(`تم الوصول للحد الأقصى للإعلانات المجانية النشطة لهذا المتجر (${adSettings.maxActiveStoreAnnouncements})`, 409);
        }
      }
      return tx.update(announcements).set(updateData).where(eq(announcements.id, id)).returning();
    });
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "store_announcement", entityId: id, beforeData: before, afterData: item });
    return ok({ announcement: item, message: "تم تعديل إعلان المتجر" });
  } catch (error) { return handleApiError(error, "تعذر تعديل إعلان المتجر"); }
}
