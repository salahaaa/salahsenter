import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { adBilling, adCampaigns, adBudgetReservations, banners, db, notifications, stores } from "@/lib/db";
import { adBudgetPauseMessage, campaignBudgetExhaustionReason, type AdBudgetLimitReason } from "@/lib/ads/pacing";
import { startOfAdsOperationalDay } from "@/lib/ads/operational-time";

type DbLike = any;
type Campaign = typeof adCampaigns.$inferSelect;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/** @deprecated use the explicit Asia/Aden operational boundary. */
export const startOfUtcDay = startOfAdsOperationalDay;

export async function getCampaignDailyAdSpend(campaignId: string, now = new Date(), tx: DbLike = db) {
  const [{ total }] = await tx
    .select({ total: sql<string>`coalesce(sum(${adBilling.amount}), 0)` })
    .from(adBilling)
    .where(and(eq(adBilling.campaignId, campaignId), inArray(adBilling.status, ["accrued", "invoiced", "paid"]), gte(adBilling.createdAt, startOfUtcDay(now))));
  return Number(total || 0);
}

/** Pauses a campaign and its derived homepage banner without deleting any creative or ledger data. */
export async function pauseCampaignForBudget(input: { tx: DbLike; campaign: Campaign; reason: AdBudgetLimitReason; dailySpent: number; now?: Date }) {
  const now = input.now || new Date();
  if (input.campaign.status === "paused") return { campaign: input.campaign, banner: null, paused: false };

  const message = adBudgetPauseMessage(input.reason);
  const targetConfig = {
    ...record(input.campaign.targetConfig),
    budgetPacing: {
      state: "auto_paused",
      reason: input.reason,
      dailySpent: input.dailySpent,
      totalSpent: Number(input.campaign.spentAmount || 0),
      pausedAt: now.toISOString()
    }
  };
  const [campaign] = await input.tx
    .update(adCampaigns)
    .set({
      status: "paused",
      adminNote: [input.campaign.adminNote, `[budget:auto] ${message}`].filter(Boolean).join("\n"),
      targetConfig,
      updatedAt: now
    })
    .where(eq(adCampaigns.id, input.campaign.id))
    .returning();

  const bannerId = text(record(input.campaign.creative).publishedBannerId);
  if (input.reason === "total_budget_exhausted") {
    await input.tx
      .update(adBudgetReservations)
      .set({ status: "exhausted", updatedAt: now })
      .where(eq(adBudgetReservations.campaignId, input.campaign.id));
  }
  const [banner] = bannerId
    ? await input.tx.update(banners).set({ status: "disabled", updatedAt: now }).where(eq(banners.id, bannerId)).returning()
    : [null];
  return { campaign, banner, paused: true };
}

export async function notifyMerchantBudgetPause(input: { campaign: Campaign; reason: AdBudgetLimitReason; dailySpent: number }) {
  const [store] = await db.select({ merchantId: stores.merchantId }).from(stores).where(eq(stores.id, input.campaign.storeId)).limit(1);
  await db.insert(notifications).values({
    userId: input.campaign.createdBy || store?.merchantId || null,
    storeId: input.campaign.storeId,
    title: "تم إيقاف الحملة الإعلانية تلقائيًا",
    body: adBudgetPauseMessage(input.reason),
    type: "merchant_ad_campaign_budget_paused",
    data: { campaignId: input.campaign.id, storeId: input.campaign.storeId, reason: input.reason, dailySpent: input.dailySpent, url: "/merchant/ads" }
  });
}

/** Cron backstop for campaigns that already reached a total/daily budget. */
export async function processAdBudgetPacing(limit = 100) {
  const now = new Date();
  const campaigns = await db
    .select()
    .from(adCampaigns)
    .where(inArray(adCampaigns.status, ["active", "approved"]))
    .limit(Math.max(1, Math.min(limit, 500)));

  const paused: Array<{ campaign: Campaign; reason: AdBudgetLimitReason; dailySpent: number }> = [];
  for (const candidate of campaigns) {
    const outcome = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ad-budget:${candidate.id}`}))`);
      const [campaign] = await tx.select().from(adCampaigns).where(eq(adCampaigns.id, candidate.id)).limit(1);
      if (!campaign || !["active", "approved"].includes(campaign.status)) return null;
      const dailySpent = await getCampaignDailyAdSpend(campaign.id, now, tx);
      const reason = campaignBudgetExhaustionReason({ budget: campaign.budget, dailyBudget: campaign.dailyBudget, spentAmount: campaign.spentAmount, dailySpent });
      if (!reason) return null;
      const result = await pauseCampaignForBudget({ tx, campaign, reason, dailySpent, now });
      return result.paused ? { campaign: result.campaign, reason, dailySpent } : null;
    });
    if (outcome) paused.push(outcome);
  }

  for (const item of paused) await notifyMerchantBudgetPause(item);
  return { scanned: campaigns.length, pausedCount: paused.length, paused };
}
