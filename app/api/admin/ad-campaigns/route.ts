export const dynamic = "force-dynamic";

import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { adCampaigns, adClicks, adImpressions, banners, db, notifications, stores } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";
import { ensureCampaignOperationalReservation, releaseCampaignOperationalReservation } from "@/lib/ads/billing";
import { chargeCampaignPromotionPlacementFee } from "@/lib/platform-revenue/service";

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected", "active", "paused", "ended"]),
  adminNote: z.string().trim().max(2_000).optional(),
  publishToHomepageBanner: z.boolean().optional().default(false)
}).superRefine((value, ctx) => {
  if (value.status === "rejected" && !value.adminNote) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["adminNote"], message: "سبب رفض الحملة مطلوب للتاجر" });
});

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type CampaignRow = typeof adCampaigns.$inferSelect;
type StoreRow = typeof stores.$inferSelect;

function creativeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Homepage banners are delivered only by the campaign renderer
 * (MerchantSponsoredBanner). Older generic banners are retired here so one
 * creative has exactly one delivery/tracking/billing path.
 */
async function publishHomepageBanner(tx: Tx, campaign: CampaignRow, _store: StoreRow, _adminId: string) {
  const creative = creativeRecord(campaign.creative);
  const imageUrl = text(creative.imageUrl);
  if (!imageUrl) throw new Error("لا يمكن اعتماد بنر رئيسي بدون صورة مرفوعة.");
  const legacyBannerId = text(creative.publishedBannerId);
  if (legacyBannerId) await tx.update(banners).set({ status: "disabled", updatedAt: new Date() }).where(eq(banners.id, legacyBannerId));
  const nextCreative = {
    ...creative,
    publishedBannerId: null,
    deliveryRenderer: "merchant_campaign_homepage_marketplace_ads",
    deliveryPlacement: "homepage_marketplace_ads",
    deliveryApprovedAt: new Date().toISOString()
  };
  const [updatedCampaign] = await tx.update(adCampaigns).set({ creative: nextCreative, updatedAt: new Date() }).where(eq(adCampaigns.id, campaign.id)).returning();
  return { banner: null, campaign: updatedCampaign };
}

async function disablePublishedBanner(tx: Tx, campaign: CampaignRow) {
  const creative = creativeRecord(campaign.creative);
  const existingBannerId = text(creative.publishedBannerId);
  if (!existingBannerId) return null;
  const [banner] = await tx.update(banners).set({ status: "disabled", updatedAt: new Date() }).where(eq(banners.id, existingBannerId)).returning();
  return banner || null;
}

async function refreshPublicHome() {
  await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home], paths: ["/"] });
}

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "ads.view");
    const campaigns = await db
      .select({
        campaign: adCampaigns,
        storeName: stores.name,
        clicks: sql<number>`(select count(*)::int from ${adClicks} where ${adClicks.campaignId} = ${adCampaigns.id})`,
        impressions: sql<number>`(select count(*)::int from ${adImpressions} where ${adImpressions.campaignId} = ${adCampaigns.id})`
      })
      .from(adCampaigns)
      .innerJoin(stores, eq(adCampaigns.storeId, stores.id))
      .orderBy(desc(adCampaigns.createdAt))
      .limit(200);
    return ok({ campaigns });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل حملات الإعلانات");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const payload = patchSchema.parse(await request.json());
    const operation = payload.status === "rejected" ? "ads.reject" : ["approved", "active"].includes(payload.status) ? "ads.approve" : ["paused", "ended"].includes(payload.status) ? "ads.suspend" : "ads.edit";
    await assertAdminOperation(session, operation);
    if (payload.publishToHomepageBanner) await assertAdminOperation(session, "ads.feature");

    const [before] = await db.select().from(adCampaigns).where(eq(adCampaigns.id, payload.id)).limit(1);
    if (!before) return fail("الحملة غير موجودة", 404);
    if (["ended", "rejected"].includes(before.status) && ["approved", "active"].includes(payload.status)) return fail("لا يمكن إعادة تفعيل حملة منتهية أو مرفوضة؛ أنشئ حملة جديدة لمراجعتها واحتياط ميزانيتها", 409);
    const [store] = await db.select().from(stores).where(eq(stores.id, before.storeId)).limit(1);
    if (!store) return fail("المتجر المرتبط بالحملة غير موجود", 404);

    const shouldPublish = before.type === "homepage_banner" && (["approved", "active"].includes(payload.status) || payload.publishToHomepageBanner);
    const shouldDisableBanner = before.type === "homepage_banner" && ["rejected", "paused", "ended"].includes(payload.status);

    const result = await db.transaction(async (tx) => {
      const [campaign] = await tx
        .update(adCampaigns)
        .set({
          status: payload.status,
          adminNote: payload.adminNote,
          approvedBy: ["approved", "active"].includes(payload.status) ? session.userId : before.approvedBy,
          approvedAt: ["approved", "active"].includes(payload.status) ? new Date() : before.approvedAt,
          updatedAt: new Date()
        })
        .where(eq(adCampaigns.id, payload.id))
        .returning();

      if (["approved", "active"].includes(payload.status)) {
        await ensureCampaignOperationalReservation({ tx, campaign });
      }
      if (["rejected", "ended"].includes(payload.status)) {
        await releaseCampaignOperationalReservation({ tx, campaign, reason: `campaign_${payload.status}` });
      }
      const promotionCharge = ["approved", "active"].includes(payload.status)
        ? await chargeCampaignPromotionPlacementFee({ tx, campaign })
        : null;
      if (shouldPublish) {
        const published = await publishHomepageBanner(tx, campaign, store, session.userId);
        return { campaign: published.campaign, banner: published.banner, promotionCharge };
      }
      if (shouldDisableBanner) {
        const banner = await disablePublishedBanner(tx, campaign);
        return { campaign, banner, promotionCharge };
      }
      return { campaign, banner: null, promotionCharge };
    });

    await db.insert(notifications).values({
      userId: store.merchantId,
      storeId: store.id,
      title: payload.status === "rejected" ? "تم رفض إعلان المتجر" : shouldPublish ? "تم اعتماد ونشر إعلان المتجر" : "تم تحديث حالة إعلان المتجر",
      body: shouldPublish ? "تم نشر إعلانك في لوحة البانر الرئيسية بعد اعتماد الإدارة." : `الحالة الجديدة: ${payload.status}`,
      type: "merchant_ad_campaign_status_updated",
      data: { campaignId: payload.id, status: payload.status, bannerId: result.banner?.id || null, url: "/merchant/ads" }
    });

    await writeAuditLog({ actorId: session.userId, action: "status_change", entityType: "ad_campaign", entityId: payload.id, beforeData: before, afterData: result });
    await refreshPublicHome();
    return ok({ ...result, message: shouldPublish ? "تم اعتماد الإعلان ونشره في لوحة البنر الرئيسية" : "تم تحديث حالة الحملة" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث الحملة");
  }
}
