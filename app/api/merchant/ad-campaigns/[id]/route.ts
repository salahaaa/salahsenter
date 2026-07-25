export const dynamic = "force-dynamic";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { adCampaigns, db } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { releaseCampaignOperationalReservation } from "@/lib/ads/billing";
import { evaluateAdServingEligibility } from "@/lib/ads/eligibility";
import { getCampaignDailyAdSpend } from "@/lib/ads/budget-pacing";

const schema = z.object({
  action: z.enum(["pause", "resume", "cancel", "clone", "update_draft"]),
  name: z.string().trim().min(2).max(180).optional(),
  creative: z.record(z.unknown()).optional(),
  targetConfig: z.record(z.unknown()).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional()
});

function clearDeliveryMetadata(value: unknown) {
  const creative = value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
  delete creative.publishedBannerId;
  delete creative.deliveryRenderer;
  delete creative.deliveryPlacement;
  delete creative.deliveryApprovedAt;
  return creative;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store || !hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية هذا المتجر", 403);
    if (!(await userHasAnyStorePermission(session.userId, store.id, ["store.ads.manage", Permission.ManageStoreAds]))) return fail("لا تملك صلاحية إدارة الحملات", 403);
    const [before] = await db.select().from(adCampaigns).where(and(eq(adCampaigns.id, id), eq(adCampaigns.storeId, store.id))).limit(1);
    if (!before) return fail("الحملة غير موجودة", 404);

    if (payload.action === "clone") {
      const [campaign] = await db.insert(adCampaigns).values({
        storeId: before.storeId,
        createdBy: session.userId,
        name: `${before.name} — نسخة`,
        type: before.type,
        placementId: before.placementId,
        status: "pending_review",
        billingModel: before.billingModel,
        billingState: "operational_reserve",
        frequencyCap: before.frequencyCap,
        currency: before.currency,
        budget: before.budget,
        dailyBudget: before.dailyBudget,
        spentAmount: "0",
        bidAmount: before.bidAmount,
        startsAt: null,
        endsAt: before.endsAt,
        productIds: before.productIds,
        targetConfig: before.targetConfig,
        creative: clearDeliveryMetadata(before.creative),
        visibilitySchedule: before.visibilitySchedule,
        adminNote: "نسخة تاجر بانتظار مراجعة جديدة"
      }).returning();
      await writeAuditLog({ actorId: session.userId, action: "create", entityType: "merchant_ad_campaign_clone", entityId: campaign.id, afterData: { sourceCampaignId: before.id, campaign } });
      return created({ campaign, message: "تم إنشاء نسخة جديدة للحملة؛ راجعها وأرسلها للموافقة." });
    }

    const result = await db.transaction(async (tx) => {
      if (payload.action === "pause") {
        if (!["approved", "active"].includes(before.status)) throw Object.assign(new Error("لا يمكن إيقاف حملة ليست نشطة أو معتمدة"), { statusCode: 409 });
        const [campaign] = await tx.update(adCampaigns).set({ status: "paused", updatedAt: new Date() }).where(eq(adCampaigns.id, before.id)).returning();
        return { campaign, message: "تم إيقاف الحملة مؤقتاً." };
      }
      if (payload.action === "resume") {
        if (before.status !== "paused") throw Object.assign(new Error("لا يمكن استئناف حملة ليست موقوفة"), { statusCode: 409 });
        const dailySpent = await getCampaignDailyAdSpend(before.id, new Date(), tx);
        const eligibility = evaluateAdServingEligibility({ campaign: before, dailySpent, now: new Date() });
        if (!eligibility.allowed) throw Object.assign(new Error("لا يمكن استئناف الحملة قبل معالجة تاريخها أو ميزانيتها أو جدول ظهورها"), { statusCode: 409 });
        const [campaign] = await tx.update(adCampaigns).set({ status: "active", updatedAt: new Date() }).where(eq(adCampaigns.id, before.id)).returning();
        return { campaign, message: "تم استئناف الحملة ضمن حدود الميزانية والجدولة الحالية." };
      }
      if (payload.action === "cancel") {
        if (!["draft", "pending_review", "paused"].includes(before.status)) throw Object.assign(new Error("يمكن إلغاء المسودة أو الطلب المعلق أو الحملة الموقوفة فقط"), { statusCode: 409 });
        const [campaign] = await tx.update(adCampaigns).set({ status: "ended", updatedAt: new Date(), adminNote: sql`concat_ws(E'\n', ${adCampaigns.adminNote}, 'ألغيت من التاجر')` }).where(eq(adCampaigns.id, before.id)).returning();
        await releaseCampaignOperationalReservation({ tx, campaign, reason: "merchant_cancelled" });
        return { campaign, message: "تم إلغاء الحملة مع الاحتفاظ بسجلها." };
      }
      // Draft/pending changes always retain/re-enter review; a merchant cannot
      // edit an approved delivery without submitting a fresh reviewed copy.
      if (!["draft", "pending_review"].includes(before.status)) throw Object.assign(new Error("انسخ الحملة المعتمدة أو أوقفها ثم أنشئ نسخة جديدة لتعديل المحتوى."), { statusCode: 409 });
      if (payload.startsAt && payload.endsAt && new Date(payload.endsAt) <= new Date(payload.startsAt)) throw Object.assign(new Error("نهاية الحملة يجب أن تكون بعد بدايتها"), { statusCode: 422 });
      const [campaign] = await tx.update(adCampaigns).set({
        name: payload.name ?? before.name,
        creative: payload.creative ?? before.creative,
        targetConfig: payload.targetConfig ?? before.targetConfig,
        startsAt: payload.startsAt === undefined ? before.startsAt : payload.startsAt ? new Date(payload.startsAt) : null,
        endsAt: payload.endsAt === undefined ? before.endsAt : payload.endsAt ? new Date(payload.endsAt) : null,
        status: "pending_review",
        adminNote: null,
        updatedAt: new Date()
      }).where(eq(adCampaigns.id, before.id)).returning();
      return { campaign, message: "تم حفظ التعديل وإبقاء الحملة في انتظار مراجعة الإدارة." };
    });

    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "merchant_ad_campaign_action", entityId: before.id, beforeData: before, afterData: { action: payload.action, campaign: result.campaign } });
    return ok(result);
  } catch (error) {
    return handleApiError(error, "تعذر تنفيذ إجراء الحملة");
  }
}
