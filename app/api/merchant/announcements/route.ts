export const dynamic = "force-dynamic";

import { and, desc, eq, sql } from "drizzle-orm";
import { ApiError, created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { announcements, db } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { announcementSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";
import { isStoreOperational } from "@/lib/store-guards";
import { getAdvertisingSettings } from "@/lib/advertising-settings";
import { Permission, userHasStorePermission } from "@/lib/rbac";
import { assertRentalLimit, lockRentalEntitlement } from "@/lib/rentals/service";

export async function GET() {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return ok({ announcements: [] });

    const items = await db
      .select()
      .from(announcements)
      .where(and(eq(announcements.level, "store"), eq(announcements.storeId, store.id)))
      .orderBy(desc(announcements.createdAt))
      .limit(50);

    return ok({ announcements: items });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل إعلانات المتجر");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = announcementSchema.parse(await request.json());
    const primaryStore = await getMerchantPrimaryStore(session.userId);
    const storeId = payload.storeId || primaryStore?.id;

    if (!storeId) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, storeId)) return fail("لا تملك صلاحية إدارة هذا المتجر", 403);
    if (!(await userHasStorePermission(session.userId, storeId, Permission.ManageAnnouncements))) return fail("لا تملك صلاحية إعلانات المتجر", 403);
    if (!(await isStoreOperational(storeId))) return fail("المتجر مجمد أو غير مفعل؛ لا يمكن تنفيذ عمليات تشغيلية حتى إعادة فتحه من الأدمن", 403);

    const adSettings = await getAdvertisingSettings();
    const [announcement] = await db.transaction(async (tx) => {
      await lockRentalEntitlement(storeId, tx);
      if (payload.status === "active") {
        const [{ count }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(announcements)
          .where(and(eq(announcements.storeId, storeId), eq(announcements.level, "store"), eq(announcements.status, "active")));
        await assertRentalLimit({ storeId, resource: "announcements", currentCount: count, tx });
        if (count >= adSettings.maxActiveStoreAnnouncements && !payload.isPromoted) {
          throw new ApiError(`تم الوصول للحد الأقصى للإعلانات المجانية النشطة لهذا المتجر (${adSettings.maxActiveStoreAnnouncements})`, 409);
        }
      }

      return tx
        .insert(announcements)
        .values({
          level: "store",
          storeId,
          title: payload.title,
          summary: payload.summary,
          body: payload.body,
          imageUrl: payload.imageUrl || null,
          linkUrl: payload.linkUrl || null,
          isPinned: payload.isPinned,
          startAt: payload.startAt ? new Date(payload.startAt) : null,
          endAt: payload.endAt ? new Date(payload.endAt) : null,
          status: payload.status,
          isPromoted: payload.isPromoted,
          promotionStart: payload.promotionStart ? new Date(payload.promotionStart) : null,
          promotionEnd: payload.promotionEnd ? new Date(payload.promotionEnd) : null,
          promotionPackage: payload.promotionPackage,
          createdBy: session.userId
        })
        .returning();
    });

    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "store_announcement", entityId: announcement.id, afterData: announcement });
    return created({ announcement, message: "تم حفظ إعلان المتجر بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ إعلان المتجر");
  }
}
