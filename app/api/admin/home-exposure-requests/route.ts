export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";
import { adBilling, adCampaigns, db, homeExposureRequests, notifications, stores } from "@/lib/db";
import { homepageExposurePlacements, normalizeHomeExposureCampaignConfig, withHomeExposureConfig } from "@/lib/home-exposure";
import { canRecordFinancialCheckpoint, canReviewHomeExposureRequest, hasExplicitAdminFinalSchedule, manualActivationInitialCampaignStatus, requiresPositiveQuotedAmount } from "@/lib/home-exposure-request-policy";
import { assertAdmin } from "@/lib/rbac";
import { normalizeVisibilitySchedule } from "@/lib/visibility-schedule";

const configSchema = z.object({ manualPriority: z.coerce.number().int().min(-10_000).max(10_000).default(0), rankingMode: z.enum(["manual", "bid", "clicks", "conversion", "fair_rotation"]).optional(), rotationWeight: z.coerce.number().min(0.1).max(100).default(1), impressionCap: z.coerce.number().int().min(0).max(100_000_000).default(0), clickCap: z.coerce.number().int().min(0).max(100_000_000).default(0), paidPriority: z.boolean().default(false) });
const schema = z.object({
  action: z.enum(["quote", "approve_create_campaign", "reject", "record_financial_checkpoint"]),
  requestId: z.string().uuid(),
  quotedAmount: z.coerce.number().min(0).max(1_000_000_000).optional(),
  currency: z.string().trim().min(3).max(10).optional(),
  adminNote: z.string().trim().max(1_500).optional().nullable(),
  financialCheckpointStatus: z.enum(["invoice_issued", "payment_verified"]).optional(),
  financialReference: z.string().trim().max(180).optional().nullable(),
  financialNote: z.string().trim().max(1_500).optional().nullable(),
  config: configSchema.optional(),
  placementId: z.enum(homepageExposurePlacements).optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  visibilitySchedule: z.record(z.unknown()).optional(),
  headline: z.string().trim().max(180).optional().nullable(),
  description: z.string().trim().max(1_500).optional().nullable(),
  imageUrl: z.string().trim().max(2_000).optional().nullable(),
  linkUrl: z.string().trim().max(2_000).optional().nullable()
}).superRefine((payload, context) => {
  if (payload.action !== "approve_create_campaign") return;
  if (!payload.placementId) context.addIssue({ code: z.ZodIssueCode.custom, message: "حدد موضعاً نهائياً للإدارة قبل إنشاء الحملة" });
  if (!payload.startsAt || !payload.endsAt) context.addIssue({ code: z.ZodIssueCode.custom, message: "حدد بداية ونهاية نهائيتين بقرار الإدارة" });
  if (!payload.visibilitySchedule) context.addIssue({ code: z.ZodIssueCode.custom, message: "حدد الجدولة النهائية بقرار الإدارة" });
});

async function requireAdmin() { const session = await requireAuth(); await assertAdmin(session, "ads.manage"); await assertAdmin(session, "home.manage"); return session; }

export async function GET() {
  try {
    await requireAdmin();
    const requests = await db.select({ request: homeExposureRequests, storeName: stores.name, storeSlug: stores.slug }).from(homeExposureRequests).innerJoin(stores, eq(homeExposureRequests.storeId, stores.id)).orderBy(desc(homeExposureRequests.createdAt)).limit(300);
    return ok({ requests });
  } catch (error) { return handleApiError(error, "تعذر تحميل طلبات الظهور التجاري"); }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdmin(); const payload = schema.parse(await request.json());
    const [before] = await db.select().from(homeExposureRequests).where(eq(homeExposureRequests.id, payload.requestId)).limit(1);
    if (!before) return fail("طلب الظهور غير موجود", 404);
    if (payload.action === "record_financial_checkpoint") {
      if (before.status !== "approved_pending_activation" || !before.campaignId) return fail("لا توجد حملة بانتظار التفعيل لهذا الطلب", 409);
      if (!payload.financialCheckpointStatus || !canRecordFinancialCheckpoint(before.financialCheckpointStatus, payload.financialCheckpointStatus)) return fail("انتقال النقطة المالية غير صالح", 422);
      if (!payload.financialReference?.trim()) return fail("مرجع الفاتورة أو مرجع المراجعة المالي مطلوب", 422);
      const [updated] = await db.update(homeExposureRequests).set({ financialCheckpointStatus: payload.financialCheckpointStatus, financialReference: payload.financialReference.trim(), financialNote: payload.financialNote || null, financialCheckedBy: session.userId, financialCheckedAt: new Date(), updatedAt: new Date() }).where(eq(homeExposureRequests.id, before.id)).returning();
      await writeAuditLog({ actorId: session.userId, action: "update", category: "financial", entityType: "home_exposure_financial_checkpoint", entityId: before.id, beforeData: before, afterData: updated });
      const label = payload.financialCheckpointStatus === "invoice_issued" ? "تم تسجيل إصدار فاتورة الظهور" : "تم تسجيل مراجعة سداد الظهور";
      await db.insert(notifications).values({ userId: before.merchantId, storeId: before.storeId, title: label, body: "تظل الحملة متوقفة حتى يفعّلها الأدمن يدوياً وفق قرار الإدارة.", type: "merchant_home_exposure_financial_checkpoint", data: { requestId: before.id, campaignId: before.campaignId, checkpoint: payload.financialCheckpointStatus, url: "/merchant/home-exposure-requests" } });
      return ok({ request: updated, message: label });
    }
    if (!canReviewHomeExposureRequest(before.status, before.campaignId)) return fail("لا يمكن تعديل طلب تم تحويله أو إغلاقه", 409);
    if (payload.action === "quote") {
      if (payload.quotedAmount === undefined) return fail("مبلغ العرض مطلوب", 422);
      const [updated] = await db.update(homeExposureRequests).set({ status: "quoted", quotedAmount: payload.quotedAmount.toFixed(2), currency: payload.currency || "YER", adminNote: payload.adminNote || null, reviewedBy: session.userId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(homeExposureRequests.id, before.id)).returning();
      await writeAuditLog({ actorId: session.userId, action: "update", entityType: "home_exposure_request", entityId: before.id, beforeData: before, afterData: updated });
      await db.insert(notifications).values({ userId: before.merchantId, storeId: before.storeId, title: "تم تسعير طلب الظهور التجاري", body: `قامت الإدارة بتسجيل عرض بقيمة ${payload.quotedAmount} ${payload.currency}. الظهور لا يبدأ إلا بقرار تفعيل إداري.`, type: "merchant_home_exposure_quoted", data: { requestId: before.id, url: "/merchant/home-exposure-requests" } });
      return ok({ request: updated, message: "تم حفظ التسعير دون بدء الحملة" });
    }
    if (payload.action === "reject") {
      const [updated] = await db.update(homeExposureRequests).set({ status: "rejected", adminNote: payload.adminNote || "تم رفض الطلب", reviewedBy: session.userId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(homeExposureRequests.id, before.id)).returning();
      await writeAuditLog({ actorId: session.userId, action: "status_change", entityType: "home_exposure_request", entityId: before.id, beforeData: before, afterData: updated });
      await db.insert(notifications).values({ userId: before.merchantId, storeId: before.storeId, title: "تم رفض طلب الظهور التجاري", body: updated.adminNote || "يرجى مراجعة تفاصيل الطلب.", type: "merchant_home_exposure_rejected", data: { requestId: before.id, url: "/merchant/home-exposure-requests" } });
      return ok({ request: updated, message: "تم رفض الطلب" });
    }
    if (!before.quotedAmount && payload.quotedAmount === undefined) return fail("سعّر الطلب أولاً قبل إنشاء حملة مدفوعة", 422);
    if (!hasExplicitAdminFinalSchedule({ placementId: payload.placementId, startsAt: payload.startsAt, endsAt: payload.endsAt, visibilitySchedule: payload.visibilitySchedule })) return fail("قرار الإدارة النهائي للموضع والتاريخ والجدولة مطلوب", 422);
    const amount = payload.quotedAmount ?? Number(before.quotedAmount || 0);
    if (requiresPositiveQuotedAmount(before.commercialModel) && amount <= 0) return fail("قيمة الظهور المدفوع يجب أن تكون أكبر من صفر", 422);
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`home-exposure-request:${before.id}`}))`);
      const [fresh] = await tx.select().from(homeExposureRequests).where(eq(homeExposureRequests.id, before.id)).limit(1);
      if (!fresh || fresh.campaignId) throw new Error("تم تحويل الطلب إلى حملة مسبقاً");
      const [store] = await tx.select().from(stores).where(and(eq(stores.id, fresh.storeId), eq(stores.isActive, true), eq(stores.status, "active"))).limit(1);
      if (!store) throw new Error("المتجر لم يعد نشطاً ولا يمكن إنشاء ظهور له");
      const creativeBefore = fresh.creative && typeof fresh.creative === "object" && !Array.isArray(fresh.creative) ? fresh.creative as Record<string, unknown> : {};
      const config = normalizeHomeExposureCampaignConfig({ ...(payload.config || {}), commercialModel: fresh.commercialModel, targetType: fresh.targetType, targetId: fresh.targetId, paidPriority: payload.config?.paidPriority ?? true });
      // Merchant dates are a proposal only. Campaigns can be created solely
      // from explicit admin-controlled final dates and schedule.
      const startsAt = new Date(payload.startsAt!);
      const endsAt = new Date(payload.endsAt!);
      if (endsAt <= startsAt) throw new Error("نهاية الحملة النهائية يجب أن تكون بعد البداية النهائية");
      const finalSchedule = normalizeVisibilitySchedule(payload.visibilitySchedule!);
      const creative = { variantId: crypto.randomUUID(), headline: payload.headline || creativeBefore.headline || `ظهور ممول: ${store.name}`, description: payload.description || creativeBefore.description || `إعلان ممول من ${store.name}`, imageUrl: payload.imageUrl || creativeBefore.imageUrl || null, linkUrl: payload.linkUrl || creativeBefore.linkUrl || `/store/${store.slug}` };
      const [campaign] = await tx.insert(adCampaigns).values({ storeId: store.id, createdBy: fresh.merchantId, name: `طلب ظهور ${fresh.id.slice(0, 8)}`, type: "homepage_exposure", placementId: payload.placementId!, status: manualActivationInitialCampaignStatus(), billingModel: "cpc", billingState: "awaiting_manual_activation", budget: "0", dailyBudget: "0", bidAmount: "0", startsAt, endsAt, visibilitySchedule: finalSchedule, targetConfig: withHomeExposureConfig({}, config), creative, adminNote: `Created from merchant home exposure request ${fresh.id}; manual activation required.` }).returning();
      const eventKey = `home-exposure-request:${fresh.id}:fixed-duration`;
      const [billing] = await tx.insert(adBilling).values({ campaignId: campaign.id, storeId: store.id, eventKey, billingType: "homepage_exposure_duration", amount: amount.toFixed(2), currency: payload.currency || fresh.currency, status: "accrued", description: `Fixed commercial homepage exposure request ${fresh.id}`, metadata: { requestId: fresh.id, activationPolicy: "manual_admin", commercialModel: fresh.commercialModel, quotedAmount: amount } }).onConflictDoNothing({ target: adBilling.eventKey }).returning();
      const [updated] = await tx.update(homeExposureRequests).set({ status: "approved_pending_activation", quotedAmount: amount.toFixed(2), currency: payload.currency || fresh.currency, activationPolicy: "manual_admin", financialCheckpointStatus: "awaiting_invoice", adminNote: payload.adminNote || fresh.adminNote, approvedPlacementId: payload.placementId!, approvedStartsAt: startsAt, approvedEndsAt: endsAt, approvedVisibilitySchedule: finalSchedule, campaignId: campaign.id, billingId: billing?.id || null, reviewedBy: session.userId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(homeExposureRequests.id, fresh.id)).returning();
      return { request: updated, campaign, billing: billing || null };
    });
    await writeAuditLog({ actorId: session.userId, action: "create", category: "financial", entityType: "home_exposure_request_campaign", entityId: before.id, beforeData: before, afterData: result });
    await db.insert(notifications).values({ userId: before.merchantId, storeId: before.storeId, title: "تم اعتماد طلب الظهور بانتظار التفعيل", body: "تم إنشاء الحملة وسجل استحقاق الإعلان. سيبدأ الظهور فقط عندما يفعّلها الأدمن يدوياً بعد الإجراء المالي الذي يقرره.", type: "merchant_home_exposure_approved_pending_activation", data: { requestId: before.id, campaignId: result.campaign.id, url: "/merchant/ads" } });
    await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home], paths: ["/"] });
    return ok({ ...result, message: "تم إنشاء حملة متوقفة وسطر استحقاق؛ التفعيل المالي/التشغيلي اليدوي مطلوب" });
  } catch (error) { return handleApiError(error, "تعذر مراجعة طلب الظهور التجاري"); }
}
