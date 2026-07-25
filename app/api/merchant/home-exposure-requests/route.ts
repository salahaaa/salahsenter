export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db, homeExposureRequests } from "@/lib/db";
import { homepageExposurePlacements } from "@/lib/home-exposure";
import { isMasterFeatureEnabled } from "@/lib/master-settings";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { notifyAdmins } from "@/lib/notifications";
import { userHasAnyStorePermission, Permission } from "@/lib/rbac";
import { normalizeVisibilitySchedule } from "@/lib/visibility-schedule";

const schema = z.object({
  placementId: z.enum(homepageExposurePlacements),
  targetType: z.enum(["store", "product", "offer", "wing", "banner"]).default("store"),
  targetId: z.string().trim().max(160).optional().nullable(),
  commercialModel: z.enum(["duration", "cpm", "cpc", "visit", "conversion"]).default("duration"),
  requestedStartsAt: z.string().datetime().optional().nullable(),
  requestedEndsAt: z.string().datetime().optional().nullable(),
  visibilitySchedule: z.record(z.unknown()).default({}),
  headline: z.string().trim().max(180).optional().nullable(),
  description: z.string().trim().max(1_500).optional().nullable(),
  imageUrl: z.string().trim().max(2_000).optional().nullable(),
  linkUrl: z.string().trim().max(2_000).optional().nullable()
});

export async function GET() {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store || !hasStoreAccess(session, store.id)) return fail("لا يوجد متجر", 403);
    if (!(await userHasAnyStorePermission(session.userId, store.id, ["store.ads.view", Permission.ManageStoreAds]))) return fail("لا تملك صلاحية الاطلاع على طلبات الظهور", 403);
    const requests = await db.select().from(homeExposureRequests).where(eq(homeExposureRequests.storeId, store.id)).orderBy(desc(homeExposureRequests.createdAt)).limit(100);
    return ok({ requests });
  } catch (error) { return handleApiError(error, "تعذر تحميل طلبات الظهور التجاري"); }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    if (!(await isMasterFeatureEnabled("allowCommercialExposureRequests"))) return fail("طلبات الظهور التجاري متوقفة مؤقتاً بسياسة المنصة.", 503);
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store || !hasStoreAccess(session, store.id)) return fail("لا يوجد متجر", 403);
    if (!(await userHasAnyStorePermission(session.userId, store.id, ["store.ads.manage", Permission.ManageStoreAds]))) return fail("لا تملك صلاحية طلب ظهور تجاري", 403);
    const payload = schema.parse(await request.json());
    if (payload.requestedEndsAt && payload.requestedStartsAt && new Date(payload.requestedEndsAt).getTime() <= new Date(payload.requestedStartsAt).getTime()) return fail("نهاية الطلب يجب أن تكون بعد بدايته", 422);
    const [exposureRequest] = await db.insert(homeExposureRequests).values({
      storeId: store.id,
      merchantId: session.userId,
      status: "submitted",
      placementId: payload.placementId,
      targetType: payload.targetType,
      targetId: payload.targetId || null,
      commercialModel: payload.commercialModel,
      requestedStartsAt: payload.requestedStartsAt ? new Date(payload.requestedStartsAt) : null,
      requestedEndsAt: payload.requestedEndsAt ? new Date(payload.requestedEndsAt) : null,
      visibilitySchedule: normalizeVisibilitySchedule(payload.visibilitySchedule),
      creative: { headline: payload.headline || null, description: payload.description || null, imageUrl: payload.imageUrl || null, linkUrl: payload.linkUrl || null }
    }).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "home_exposure_request", entityId: exposureRequest.id, afterData: exposureRequest });
    await notifyAdmins({ title: "طلب ظهور تجاري جديد", body: `أرسل متجر ${store.name} طلب ظهور في موضع ${payload.placementId}.`, type: "merchant_home_exposure_requested", data: { requestId: exposureRequest.id, storeId: store.id, url: "/admin/home-exposure-revenue" } });
    return created({ request: exposureRequest, message: "تم إرسال الطلب للمراجعة. لن يبدأ الظهور أو الفوترة تلقائياً." });
  } catch (error) { return handleApiError(error, "تعذر إرسال طلب الظهور التجاري"); }
}
