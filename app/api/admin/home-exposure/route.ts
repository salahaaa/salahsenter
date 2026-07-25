export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";
import { adCampaigns, db, homeExposureRequests, stores, systemSettings } from "@/lib/db";
import {
  defaultHomeExposureEngineSettings,
  getHomeExposureAdminSnapshot,
  homepageExposurePlacements,
  isHomepageExposurePlacement,
  normalizeHomeExposureCampaignConfig,
  normalizeHomeExposureEngineSettings,
  withHomeExposureConfig
} from "@/lib/home-exposure";
import { assertAdmin } from "@/lib/rbac";
import { normalizeVisibilitySchedule } from "@/lib/visibility-schedule";
import { canManuallyActivateHomeExposure } from "@/lib/home-exposure-request-policy";

const dateSchema = z.string().datetime().optional().nullable();
const configSchema = z.object({
  manualPriority: z.coerce.number().int().min(-10_000).max(10_000).default(0),
  rankingMode: z.enum(["manual", "bid", "clicks", "conversion", "fair_rotation"]).optional(),
  rotationWeight: z.coerce.number().min(0.1).max(100).default(1),
  impressionCap: z.coerce.number().int().min(0).max(100_000_000).default(0),
  clickCap: z.coerce.number().int().min(0).max(100_000_000).default(0),
  commercialModel: z.enum(["duration", "cpm", "cpc", "visit", "conversion"]).default("duration"),
  paidPriority: z.boolean().default(false),
  targetType: z.enum(["store", "product", "offer", "wing", "banner"]).default("store"),
  targetId: z.string().max(160).optional().nullable()
});
const createSchema = z.object({
  action: z.literal("create").default("create"),
  name: z.string().trim().min(2).max(180),
  storeId: z.string().uuid(),
  placementId: z.enum(homepageExposurePlacements),
  status: z.enum(["active", "paused"]).default("paused"),
  billingModel: z.enum(["cpc", "cpm"]).default("cpc"),
  budget: z.coerce.number().min(0).max(1_000_000_000).default(0),
  dailyBudget: z.coerce.number().min(0).max(1_000_000_000).default(0),
  bidAmount: z.coerce.number().min(0).max(1_000_000_000).default(0),
  startsAt: dateSchema,
  endsAt: dateSchema,
  schedule: z.record(z.unknown()).default({}),
  config: configSchema,
  headline: z.string().trim().max(180).optional().nullable(),
  description: z.string().trim().max(1_500).optional().nullable(),
  imageUrl: z.string().trim().max(2_000).optional().nullable(),
  linkUrl: z.string().trim().max(2_000).optional().nullable()
});
const patchSchema = z.object({
  action: z.enum(["update", "set_status", "update_settings"]),
  campaignId: z.string().uuid().optional(),
  status: z.enum(["active", "paused"]).optional(),
  name: z.string().trim().min(2).max(180).optional(),
  startsAt: dateSchema,
  endsAt: dateSchema,
  schedule: z.record(z.unknown()).optional(),
  config: configSchema.partial().optional(),
  headline: z.string().trim().max(180).optional().nullable(),
  description: z.string().trim().max(1_500).optional().nullable(),
  imageUrl: z.string().trim().max(2_000).optional().nullable(),
  linkUrl: z.string().trim().max(2_000).optional().nullable(),
  settings: z.record(z.unknown()).optional()
}).superRefine((payload, context) => {
  if (payload.action !== "update_settings" && !payload.campaignId) context.addIssue({ code: z.ZodIssueCode.custom, message: "معرف الحملة مطلوب" });
  if (payload.action === "update_settings" && !payload.settings) context.addIssue({ code: z.ZodIssueCode.custom, message: "الإعدادات مطلوبة" });
});

async function requireExposureAdmin() {
  const session = await requireAuth();
  await assertAdmin(session, "ads.manage");
  await assertAdmin(session, "home.manage");
  return session;
}

async function refreshHome() {
  await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home], paths: ["/"] });
}

export async function GET() {
  try {
    await requireExposureAdmin();
    return ok(await getHomeExposureAdminSnapshot());
  } catch (error) {
    return handleApiError(error, "تعذر تحميل محرك الظهور التجاري");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireExposureAdmin();
    const payload = createSchema.parse(await request.json());
    if (payload.endsAt && payload.startsAt && new Date(payload.endsAt).getTime() <= new Date(payload.startsAt).getTime()) return fail("نهاية الظهور يجب أن تكون بعد بدايته", 422);
    if (!isHomepageExposurePlacement(payload.placementId)) return fail("موضع الصفحة الرئيسية غير صالح", 422);
    if (["cpc", "cpm"].includes(payload.config.commercialModel) && payload.bidAmount > 0 && payload.budget <= 0) return fail("نموذج CPC/CPM يحتاج ميزانية كلية عند إدخال سعر مزايدة", 422);
    const [store] = await db.select().from(stores).where(and(eq(stores.id, payload.storeId), eq(stores.status, "active"), eq(stores.isActive, true))).limit(1);
    if (!store) return fail("اختر متجراً نشطاً فقط للظهور التجاري", 422);

    const config = normalizeHomeExposureCampaignConfig(payload.config);
    const [campaign] = await db.insert(adCampaigns).values({
      storeId: store.id,
      createdBy: session.userId,
      name: payload.name,
      type: "homepage_exposure",
      placementId: payload.placementId,
      status: payload.status,
      billingModel: payload.billingModel,
      billingState: ["cpc", "cpm"].includes(config.commercialModel) ? "operational_reserve" : "manual_review_required",
      budget: payload.budget.toFixed(2),
      dailyBudget: payload.dailyBudget.toFixed(2),
      bidAmount: payload.bidAmount.toFixed(2),
      startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
      endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
      visibilitySchedule: normalizeVisibilitySchedule(payload.schedule),
      targetConfig: withHomeExposureConfig({}, config),
      creative: { variantId: crypto.randomUUID(), headline: payload.headline || payload.name, description: payload.description || `إعلان ممول من ${store.name}`, imageUrl: payload.imageUrl || null, linkUrl: payload.linkUrl || `/store/${store.slug}` },
      approvedBy: payload.status === "active" ? session.userId : null,
      approvedAt: payload.status === "active" ? new Date() : null
    }).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "homepage_exposure_campaign", entityId: campaign.id, afterData: campaign });
    await refreshHome();
    return created({ campaign, message: payload.status === "active" ? "تم إنشاء وتفعيل الظهور التجاري" : "تم إنشاء الظهور التجاري بحالة متوقفة" });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء الظهور التجاري");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireExposureAdmin();
    const payload = patchSchema.parse(await request.json());
    if (payload.action === "update_settings") {
      const settings = normalizeHomeExposureEngineSettings(payload.settings || defaultHomeExposureEngineSettings);
      const [saved] = await db.insert(systemSettings).values({ group: "homepage", key: "exposure_revenue_engine", value: settings, isPublic: false, updatedBy: session.userId }).onConflictDoUpdate({ target: [systemSettings.group, systemSettings.key], set: { value: settings, updatedBy: session.userId, updatedAt: new Date() } }).returning();
      await writeAuditLog({ actorId: session.userId, action: "update", entityType: "homepage_exposure_settings", entityId: "exposure_revenue_engine", afterData: saved });
      await refreshHome();
      return ok({ settings, message: "تم حفظ سياسات العدالة والتدوير" });
    }

    const [before] = await db.select().from(adCampaigns).where(and(eq(adCampaigns.id, payload.campaignId!), eq(adCampaigns.type, "homepage_exposure"))).limit(1);
    if (!before) return fail("ظهور الواجهة غير موجود", 404);
    if (payload.action === "set_status" && payload.status === "active") {
      const [request] = await db.select({ financialCheckpointStatus: homeExposureRequests.financialCheckpointStatus }).from(homeExposureRequests).where(eq(homeExposureRequests.campaignId, before.id)).limit(1);
      if (request && !canManuallyActivateHomeExposure(request.financialCheckpointStatus)) return fail("سجّل أولاً إصدار الفاتورة أو مراجعة السداد في نقطة القرار المالي قبل التفعيل اليدوي", 409);
    }
    if (payload.endsAt && payload.startsAt && new Date(payload.endsAt).getTime() <= new Date(payload.startsAt).getTime()) return fail("نهاية الظهور يجب أن تكون بعد بدايته", 422);
    const oldCreative = before.creative && typeof before.creative === "object" && !Array.isArray(before.creative) ? before.creative as Record<string, unknown> : {};
    const nextConfig = normalizeHomeExposureCampaignConfig({ ...normalizeHomeExposureCampaignConfig((before.targetConfig as Record<string, unknown> || {}).homeExposure), ...(payload.config || {}) });
    const [campaign] = await db.update(adCampaigns).set({
      status: payload.action === "set_status" ? payload.status || before.status : before.status,
      name: payload.name || before.name,
      startsAt: payload.startsAt === undefined ? before.startsAt : payload.startsAt ? new Date(payload.startsAt) : null,
      endsAt: payload.endsAt === undefined ? before.endsAt : payload.endsAt ? new Date(payload.endsAt) : null,
      visibilitySchedule: payload.schedule === undefined ? before.visibilitySchedule : normalizeVisibilitySchedule(payload.schedule),
      targetConfig: withHomeExposureConfig(before.targetConfig, nextConfig),
      creative: { ...oldCreative, headline: payload.headline === undefined ? oldCreative.headline : payload.headline || before.name, description: payload.description === undefined ? oldCreative.description : payload.description || "", imageUrl: payload.imageUrl === undefined ? oldCreative.imageUrl : payload.imageUrl || null, linkUrl: payload.linkUrl === undefined ? oldCreative.linkUrl : payload.linkUrl || `/store/${before.storeId}` },
      approvedBy: payload.action === "set_status" && payload.status === "active" ? session.userId : before.approvedBy,
      approvedAt: payload.action === "set_status" && payload.status === "active" ? new Date() : before.approvedAt,
      updatedAt: new Date()
    }).where(eq(adCampaigns.id, before.id)).returning();
    await writeAuditLog({ actorId: session.userId, action: payload.action === "set_status" ? "status_change" : "update", entityType: "homepage_exposure_campaign", entityId: campaign.id, beforeData: before, afterData: campaign });
    await refreshHome();
    return ok({ campaign, message: payload.action === "set_status" ? "تم تحديث حالة الظهور فوراً" : "تم تحديث الجدولة وإعدادات الظهور" });
  } catch (error) {
    return handleApiError(error, "تعذر تعديل الظهور التجاري");
  }
}
