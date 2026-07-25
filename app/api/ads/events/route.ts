export const dynamic = "force-dynamic";

import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError } from "@/lib/api";
import { getCurrentSession } from "@/lib/auth";
import { adBilling, adClicks, adCampaigns, adFraudSignals, adImpressions, db, products, stores } from "@/lib/db";
import { getClientIp, checkIpRateLimit } from "@/lib/rate-limit";
import { adDeliveryCharge, calculateAdDeliveryPacing, campaignBudgetExhaustionReason } from "@/lib/ads/pacing";
import { consumeCampaignOperationalReservation } from "@/lib/ads/billing";
import { assessAdClickFraud, fraudAssessmentEvidence } from "@/lib/ads/fraud";
import { assessAdImpressionQuality, impressionQualityEvidence } from "@/lib/ads/impression-quality";
import { evaluateAdServingEligibility } from "@/lib/ads/eligibility";
import { incrementAdDeliveryCounter } from "@/lib/ads/delivery-counters";
import { startOfAdsOperationalDay } from "@/lib/ads/operational-time";
import { getCampaignDailyAdSpend, notifyMerchantBudgetPause, pauseCampaignForBudget } from "@/lib/ads/budget-pacing";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";
import { enforceHomeExposureDeliveryGate, notifyHomeExposureAutoPause, pauseHomeExposureIfCapReached } from "@/lib/home-exposure";
import {
  adEventKey,
  adEventTypes,
  adImpressionFrequencyCap,
  adPlacements,
  hashAdTrackingId,
  isTrackableAdCampaign
} from "@/lib/ads/tracking";

const schema = z.object({
  eventType: z.enum(adEventTypes),
  campaignId: z.string().uuid(),
  placement: z.enum(adPlacements),
  visitorId: z.string().min(12).max(160),
  productId: z.string().uuid().optional().nullable(),
  creativeVariantId: z.string().uuid().optional().nullable(),
  attributionToken: z.string().uuid().optional().nullable(),
  /** Supplied by the visible-ad tracker; required only for CPM billing quality. */
  viewableMs: z.coerce.number().int().min(0).max(60_000).optional().default(0),
  viewportRatio: z.coerce.number().min(0).max(1).optional().default(0)
});

function clickLedgerMetadata(input: { clickId: string; placement: string; attributionToken?: string | null; creativeVariantId?: string | null; billingModel: string }) {
  return { clickId: input.clickId, placement: input.placement, attributionToken: input.attributionToken || null, creativeVariantId: input.creativeVariantId || null, billingModel: input.billingModel };
}

/**
 * Public, privacy-aware sponsored-ad telemetry. The database is authoritative:
 * raw browser IDs/IPs are never stored, event keys are idempotent, campaign
 * locks serialize money-affecting events, and invalid/suspected click traffic
 * is retained for review without becoming a billable ledger entry.
 */
export async function POST(request: Request) {
  try {
    const rate = await checkIpRateLimit("ads:events", 180, 15 * 60 * 1000);
    if (!rate.allowed) return fail("محاولات كثيرة، حاول لاحقًا", 429);

    const payload = schema.parse(await request.json());
    const now = new Date();
    const [campaignRow] = await db
      .select({ campaign: adCampaigns, store: stores })
      .from(adCampaigns)
      .innerJoin(stores, eq(adCampaigns.storeId, stores.id))
      .where(eq(adCampaigns.id, payload.campaignId))
      .limit(1);

    // Never expose campaign state. A wrong placement is treated exactly like a
    // non-displayable campaign so callers cannot probe campaign configuration.
    if (!campaignRow || campaignRow.campaign.placementId !== payload.placement || !campaignRow.store.isActive || campaignRow.store.status !== "active" || !isTrackableAdCampaign(campaignRow.campaign, now) || !evaluateAdServingEligibility({ campaign: campaignRow.campaign, now }).allowed) {
      return created({ recorded: false, reason: "campaign_unavailable" });
    }
    if (payload.productId && campaignRow.campaign.productIds.length && !campaignRow.campaign.productIds.includes(payload.productId)) {
      return created({ recorded: false, reason: "product_unavailable" });
    }
    if (payload.productId) {
      const [product] = await db.select({ id: products.id, storeId: products.storeId, status: products.status, productCommerceType: products.productCommerceType, showcaseStatus: products.showcaseStatus, publishAt: products.publishAt, unpublishAt: products.unpublishAt }).from(products).where(eq(products.id, payload.productId)).limit(1);
      if (!product || product.storeId !== campaignRow.campaign.storeId || product.status !== "active" || product.productCommerceType === "SHOWCASE_ONLY" || product.showcaseStatus === "SOLD" || product.publishAt && product.publishAt > now || product.unpublishAt && product.unpublishAt < now) return created({ recorded: false, reason: "product_unavailable" });
    }
    const creative = campaignRow.campaign.creative && typeof campaignRow.campaign.creative === "object" && !Array.isArray(campaignRow.campaign.creative) ? campaignRow.campaign.creative as Record<string, unknown> : {};
    const variantIds = [typeof creative.variantId === "string" ? creative.variantId : null, ...(Array.isArray(creative.variants) ? creative.variants.map((variant) => variant && typeof variant === "object" && !Array.isArray(variant) && typeof (variant as Record<string, unknown>).id === "string" ? String((variant as Record<string, unknown>).id) : null) : [])].filter(Boolean);
    if (payload.creativeVariantId && !variantIds.includes(payload.creativeVariantId)) return created({ recorded: false, reason: "creative_unavailable" });

    const visitorHash = hashAdTrackingId(payload.visitorId);
    if (!visitorHash) return fail("معرف الزائر غير صالح", 422);
    const ipHash = hashAdTrackingId(await getClientIp());
    const userAgent = request.headers.get("user-agent")?.slice(0, 1_000) || null;
    const session = await getCurrentSession();
    const eventKey = adEventKey({ eventType: payload.eventType, campaignId: campaignRow.campaign.id, placement: payload.placement, visitorHash, occurredAt: now });

    const result = await db.transaction(async (tx) => {
      const lockKey = `ads:event:${payload.eventType}:${campaignRow.campaign.id}:${visitorHash}:${startOfAdsOperationalDay(now).toISOString()}`;
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);
      const since = startOfAdsOperationalDay(now);

      if (payload.eventType === "impression") {
        const [{ count: impressionCount }, recentVisitorRow] = await Promise.all([
          tx.select({ count: sql<number>`count(*)::int` }).from(adImpressions).where(and(eq(adImpressions.campaignId, campaignRow.campaign.id), eq(adImpressions.visitorHash, visitorHash), gte(adImpressions.createdAt, since))).then((rows: Array<{ count: number }>) => rows[0]),
          tx.select({ count: sql<number>`count(*)::int` }).from(adImpressions).where(and(eq(adImpressions.campaignId, campaignRow.campaign.id), eq(adImpressions.visitorHash, visitorHash), gte(adImpressions.createdAt, new Date(now.getTime() - 15 * 60 * 1000)))).then((rows: Array<{ count: number }>) => rows[0])
        ]);
        if (impressionCount >= adImpressionFrequencyCap(campaignRow.campaign.frequencyCap)) return { recorded: false, reason: "frequency_capped" };

        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ad-budget:${campaignRow.campaign.id}`}))`);
        const [campaign] = await tx.select().from(adCampaigns).where(eq(adCampaigns.id, campaignRow.campaign.id)).limit(1);
        if (!campaign || campaign.placementId !== payload.placement || !isTrackableAdCampaign(campaign, now)) return { recorded: false, reason: "campaign_unavailable" };
        const recentIpRow = ipHash
          ? await tx.select({ count: sql<number>`count(*)::int` }).from(adImpressions).where(and(eq(adImpressions.campaignId, campaign.id), eq(adImpressions.ipAddress, ipHash), gte(adImpressions.createdAt, new Date(now.getTime() - 15 * 60 * 1000)))).then((rows: Array<{ count: number }>) => rows[0])
          : { count: 0 };
        const qualityInput = { userAgent, viewableMs: payload.viewableMs, viewportRatio: payload.viewportRatio, sameVisitorRecentImpressions: Number(recentVisitorRow?.count || 0), sameIpRecentImpressions: Number(recentIpRow?.count || 0) };
        const quality = assessAdImpressionQuality(qualityInput);
        const dailySpent = await getCampaignDailyAdSpend(campaign.id, now, tx);
        const serving = evaluateAdServingEligibility({ campaign, dailySpent, now });
        if (!serving.allowed && serving.reason !== "budget_exhausted") return { recorded: false, reason: serving.reason || "campaign_unavailable" };
        const exposureGate = await enforceHomeExposureDeliveryGate({ tx, campaign, now });
        if (!exposureGate.allowed) return { recorded: false, reason: exposureGate.reason, exposurePause: exposureGate.autoPausedCampaign };
        const charge = quality.billable && campaign.billingModel === "cpm" ? adDeliveryCharge({ billingModel: "cpm", bidAmount: campaign.bidAmount }) : 0;
        const pacing = calculateAdDeliveryPacing({ budget: campaign.budget, dailyBudget: campaign.dailyBudget, spentAmount: campaign.spentAmount, dailySpent, charge });
        const metadata = { source: "sponsored_ad_client", billingModel: campaign.billingModel, creativeVariantId: payload.creativeVariantId || null, viewableMs: payload.viewableMs, viewportRatio: payload.viewportRatio, billable: quality.billable && pacing.canServe && charge > 0, quality: { status: quality.status, score: quality.score, reasons: quality.reasons }, budgetLimited: !pacing.canServe, pacingReason: pacing.reason };
        const inserted = await tx.insert(adImpressions).values({
          campaignId: campaign.id,
          storeId: campaign.storeId,
          productId: payload.productId || null,
          userId: session?.userId || null,
          visitorHash,
          placement: payload.placement,
          eventKey,
          cost: quality.billable && pacing.canServe ? pacing.charge.toFixed(2) : "0",
          qualityStatus: quality.status,
          fraudScore: quality.score,
          ipAddress: ipHash,
          userAgent,
          metadata
        }).onConflictDoNothing({ target: adImpressions.eventKey }).returning({ id: adImpressions.id });
        if (!inserted[0]) return { recorded: false, reason: "duplicate" };
        if (quality.status !== "clean") await tx.insert(adFraudSignals).values(quality.reasons.map((signalType) => ({ campaignId: campaign.id, clickId: null, eventKey, signalType, score: quality.score, status: quality.status, evidence: impressionQualityEvidence(qualityInput, quality) }))).onConflictDoNothing({ target: [adFraudSignals.eventKey, adFraudSignals.signalType] });
        await incrementAdDeliveryCounter({ tx, campaignId: campaign.id, eventType: "impression", now });

        if (!pacing.canServe) {
          const pause = await pauseCampaignForBudget({ tx, campaign, reason: pacing.reason!, dailySpent, now });
          const exposurePause = await pauseHomeExposureIfCapReached({ tx, campaign, now });
          return { recorded: true, eventId: inserted[0].id, reason: "budget_paused", autoPaused: pause.paused, pause: pause.paused ? { campaign: pause.campaign, reason: pacing.reason!, dailySpent } : null, exposurePause };
        }
        let updatedCampaign = campaign;
        if (pacing.charge > 0) {
          await tx.insert(adBilling).values({ campaignId: campaign.id, storeId: campaign.storeId, eventKey, billingType: "cpm", amount: pacing.charge.toFixed(2), currency: campaign.currency, status: "accrued", description: `CPM quality impression at ${payload.placement}`, metadata: { impressionId: inserted[0].id, placement: payload.placement, creativeVariantId: payload.creativeVariantId || null, billingModel: "cpm", qualityStatus: quality.status, qualityScore: quality.score } }).onConflictDoNothing({ target: adBilling.eventKey });
          [updatedCampaign] = await tx.update(adCampaigns).set({ spentAmount: sql`${adCampaigns.spentAmount} + ${pacing.charge}`, updatedAt: now }).where(eq(adCampaigns.id, campaign.id)).returning();
          await consumeCampaignOperationalReservation({ tx, campaign: updatedCampaign, charge: pacing.charge, now });
        }
        const reasonAfterCharge = pacing.charge > 0 ? campaignBudgetExhaustionReason({ budget: updatedCampaign.budget, dailyBudget: updatedCampaign.dailyBudget, spentAmount: updatedCampaign.spentAmount, dailySpent: dailySpent + pacing.charge }) : null;
        const exposurePause = await pauseHomeExposureIfCapReached({ tx, campaign: updatedCampaign, now });
        const pause = reasonAfterCharge ? await pauseCampaignForBudget({ tx, campaign: updatedCampaign, reason: reasonAfterCharge, dailySpent: dailySpent + pacing.charge } ) : null;
        return { recorded: true, eventId: inserted[0].id, billable: pacing.charge > 0, qualityStatus: quality.status, autoPaused: Boolean(pause?.paused), pause: pause?.paused ? { campaign: pause.campaign, reason: reasonAfterCharge!, dailySpent: dailySpent + pacing.charge } : null, exposurePause };
      }

      // A click can only be charged for CPC. CPM clicks remain measured for CTR
      // and attribution but never add a second delivery charge.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ad-budget:${campaignRow.campaign.id}`}))`);
      const [campaign] = await tx.select().from(adCampaigns).where(eq(adCampaigns.id, campaignRow.campaign.id)).limit(1);
      if (!campaign || !isTrackableAdCampaign(campaign, now)) return { recorded: false, reason: "campaign_unavailable" };
      if (campaign.placementId !== payload.placement || (payload.productId && campaign.productIds.length && !campaign.productIds.includes(payload.productId))) return { recorded: false, reason: "product_unavailable" };
      const exposureGate = await enforceHomeExposureDeliveryGate({ tx, campaign, now });
      if (!exposureGate.allowed) return { recorded: false, reason: exposureGate.reason, exposurePause: exposureGate.autoPausedCampaign };

      const [{ count: clickCount }, recentVisitorRow] = await Promise.all([
        tx.select({ count: sql<number>`count(*)::int` }).from(adClicks).where(and(eq(adClicks.campaignId, campaign.id), eq(adClicks.visitorHash, visitorHash), gte(adClicks.createdAt, since))).then((rows: Array<{ count: number }>) => rows[0]),
        tx.select({ count: sql<number>`count(*)::int` }).from(adClicks).where(and(eq(adClicks.campaignId, campaign.id), eq(adClicks.visitorHash, visitorHash), gte(adClicks.createdAt, new Date(now.getTime() - 15 * 60 * 1000)))).then((rows: Array<{ count: number }>) => rows[0])
      ]);
      if (clickCount >= 10) return { recorded: false, reason: "click_frequency_capped" };
      const recentIpRow = ipHash
        ? await tx.select({ count: sql<number>`count(*)::int` }).from(adClicks).where(and(eq(adClicks.campaignId, campaign.id), eq(adClicks.ipAddress, ipHash), gte(adClicks.createdAt, new Date(now.getTime() - 15 * 60 * 1000)))).then((rows: Array<{ count: number }>) => rows[0])
        : { count: 0 };
      const assessmentInput = { userAgent, sameVisitorRecentClicks: Number(recentVisitorRow?.count || 0), sameIpRecentClicks: Number(recentIpRow?.count || 0) };
      const fraud = assessAdClickFraud(assessmentInput);

      const dailySpent = await getCampaignDailyAdSpend(campaign.id, now, tx);
      const serving = evaluateAdServingEligibility({ campaign, dailySpent, now });
      if (!serving.allowed && serving.reason !== "budget_exhausted") return { recorded: false, reason: serving.reason || "campaign_unavailable" };
      const charge = fraud.billable && campaign.billingModel === "cpc" ? adDeliveryCharge({ billingModel: "cpc", bidAmount: campaign.bidAmount }) : 0;
      const pacing = calculateAdDeliveryPacing({ budget: campaign.budget, dailyBudget: campaign.dailyBudget, spentAmount: campaign.spentAmount, dailySpent, charge });
      const clickMetadata = { source: "sponsored_ad_client", attributionToken: payload.attributionToken || null, creativeVariantId: payload.creativeVariantId || null, billingModel: campaign.billingModel, billable: fraud.billable && pacing.billable, budgetLimited: !pacing.canServe, pacingReason: pacing.reason, fraud: { status: fraud.status, score: fraud.score, reasons: fraud.reasons } };

      if (!pacing.canServe) {
        const inserted = await tx.insert(adClicks).values({ campaignId: campaign.id, storeId: campaign.storeId, productId: payload.productId || null, userId: session?.userId || null, visitorHash, placement: payload.placement, eventKey, cost: "0", fraudStatus: fraud.status, ipAddress: ipHash, userAgent, metadata: clickMetadata }).onConflictDoNothing({ target: adClicks.eventKey }).returning({ id: adClicks.id });
        if (inserted[0] && fraud.status !== "clean") await tx.insert(adFraudSignals).values(fraud.reasons.map((signalType) => ({ campaignId: campaign.id, clickId: inserted[0].id, eventKey, signalType, score: fraud.score, status: fraud.status, evidence: fraudAssessmentEvidence(assessmentInput, fraud) }))).onConflictDoNothing({ target: [adFraudSignals.eventKey, adFraudSignals.signalType] });
        if (inserted[0]) await incrementAdDeliveryCounter({ tx, campaignId: campaign.id, eventType: "click", cleanClick: fraud.status === "clean", now });
        const exposurePause = inserted[0] ? await pauseHomeExposureIfCapReached({ tx, campaign, now }) : null;
        const pause = await pauseCampaignForBudget({ tx, campaign, reason: pacing.reason!, dailySpent, now });
        return { recorded: Boolean(inserted[0]), eventId: inserted[0]?.id || null, reason: inserted[0] ? "budget_paused" : "duplicate", autoPaused: pause.paused, pause: pause.paused ? { campaign: pause.campaign, reason: pacing.reason!, dailySpent } : null, exposurePause };
      }

      const inserted = await tx.insert(adClicks).values({ campaignId: campaign.id, storeId: campaign.storeId, productId: payload.productId || null, userId: session?.userId || null, visitorHash, placement: payload.placement, eventKey, cost: pacing.charge.toFixed(2), fraudStatus: fraud.status, ipAddress: ipHash, userAgent, metadata: clickMetadata }).onConflictDoNothing({ target: adClicks.eventKey }).returning({ id: adClicks.id });
      if (!inserted[0]) return { recorded: false, reason: "duplicate" };
      if (fraud.status !== "clean") await tx.insert(adFraudSignals).values(fraud.reasons.map((signalType) => ({ campaignId: campaign.id, clickId: inserted[0].id, eventKey, signalType, score: fraud.score, status: fraud.status, evidence: fraudAssessmentEvidence(assessmentInput, fraud) }))).onConflictDoNothing({ target: [adFraudSignals.eventKey, adFraudSignals.signalType] });
      await incrementAdDeliveryCounter({ tx, campaignId: campaign.id, eventType: "click", cleanClick: fraud.status === "clean", now });

      let updatedCampaign = campaign;
      if (pacing.charge > 0) {
        await tx.insert(adBilling).values({ campaignId: campaign.id, storeId: campaign.storeId, eventKey, billingType: "cpc", amount: pacing.charge.toFixed(2), currency: campaign.currency, status: "accrued", description: `CPC click at ${payload.placement}`, metadata: clickLedgerMetadata({ clickId: inserted[0].id, placement: payload.placement, attributionToken: payload.attributionToken, creativeVariantId: payload.creativeVariantId, billingModel: campaign.billingModel }) }).onConflictDoNothing({ target: adBilling.eventKey });
        [updatedCampaign] = await tx.update(adCampaigns).set({ spentAmount: sql`${adCampaigns.spentAmount} + ${pacing.charge}`, updatedAt: now }).where(eq(adCampaigns.id, campaign.id)).returning();
        await consumeCampaignOperationalReservation({ tx, campaign: updatedCampaign, charge: pacing.charge, now });
      }
      const reasonAfterCharge = pacing.charge > 0 ? campaignBudgetExhaustionReason({ budget: updatedCampaign.budget, dailyBudget: updatedCampaign.dailyBudget, spentAmount: updatedCampaign.spentAmount, dailySpent: dailySpent + pacing.charge }) : null;
      const exposurePause = await pauseHomeExposureIfCapReached({ tx, campaign: updatedCampaign, now });
      const pause = reasonAfterCharge ? await pauseCampaignForBudget({ tx, campaign: updatedCampaign, reason: reasonAfterCharge, dailySpent: dailySpent + pacing.charge, now }) : null;
      return { recorded: true, eventId: inserted[0].id, billable: pacing.charge > 0, fraudStatus: fraud.status, autoPaused: Boolean(pause?.paused), pause: pause?.paused ? { campaign: pause.campaign, reason: reasonAfterCharge!, dailySpent: dailySpent + pacing.charge } : null, exposurePause };
    });

    const deliveryResult = result as { autoPaused?: boolean; pause?: { campaign: typeof adCampaigns.$inferSelect; reason: any; dailySpent: number } | null; exposurePause?: typeof adCampaigns.$inferSelect | null };
    if (deliveryResult.autoPaused && deliveryResult.pause) await notifyMerchantBudgetPause(deliveryResult.pause);
    if (deliveryResult.exposurePause) {
      const reason = (deliveryResult.exposurePause.targetConfig as Record<string, any>)?.homeExposure?.autoStop?.reason;
      if (reason === "impression_cap" || reason === "click_cap") await notifyHomeExposureAutoPause(deliveryResult.exposurePause, reason);
    }
    if ((deliveryResult.autoPaused && deliveryResult.pause) || deliveryResult.exposurePause) await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home], paths: ["/"] });
    return created(result);
  } catch (error) {
    return handleApiError(error, "تعذر تسجيل حدث الإعلان");
  }
}
