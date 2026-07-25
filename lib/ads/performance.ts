import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { adBilling, adCampaigns, adClicks, adImpressions, adOrderAttributions, adReports, db } from "@/lib/db";
import { adsOperationalDayRange } from "@/lib/ads/operational-time";

type DbLike = any;

export type AdPerformanceInput = {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  invalidClicks?: number;
};

function amount(value: unknown) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function rate(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 10_000) / 100 : 0;
}

export function calculateAdPerformance(input: AdPerformanceInput) {
  const impressions = Math.max(0, input.impressions);
  const clicks = Math.max(0, input.clicks);
  const conversions = Math.max(0, input.conversions);
  const spend = Math.max(0, Math.round(input.spend * 100) / 100);
  const revenue = Math.max(0, Math.round(input.revenue * 100) / 100);
  return {
    impressions,
    clicks,
    conversions,
    spend,
    revenue,
    ctr: rate(clicks, impressions),
    cpc: clicks ? Math.round((spend / clicks) * 100) / 100 : 0,
    cvr: rate(conversions, clicks),
    roas: spend ? Math.round((revenue / spend) * 1000) / 1000 : 0,
    invalidClicks: Math.max(0, input.invalidClicks || 0)
  };
}

/** Backward-compatible export; ad reports are now grouped by Asia/Aden operational day. */
export function utcDayRange(date = new Date()) {
  const { start, end } = adsOperationalDayRange(date);
  return { start, end };
}

export async function getCampaignPerformanceForDay(input: { campaignId: string; date?: Date; tx?: DbLike }) {
  const tx = input.tx || db;
  const { start, end } = utcDayRange(input.date);
  const [impressionRow, clickRow, invalidClickRow, billingRow, conversionRow] = await Promise.all([
    tx.select({ count: sql<number>`count(*)::int` }).from(adImpressions).where(and(eq(adImpressions.campaignId, input.campaignId), gte(adImpressions.createdAt, start), lt(adImpressions.createdAt, end))).then((rows: Array<{ count: number }>) => rows[0]),
    tx.select({ count: sql<number>`count(*)::int` }).from(adClicks).where(and(eq(adClicks.campaignId, input.campaignId), inArray(adClicks.fraudStatus, ["clean", "pending"]), gte(adClicks.createdAt, start), lt(adClicks.createdAt, end))).then((rows: Array<{ count: number }>) => rows[0]),
    tx.select({ count: sql<number>`count(*)::int` }).from(adClicks).where(and(eq(adClicks.campaignId, input.campaignId), eq(adClicks.fraudStatus, "invalid"), gte(adClicks.createdAt, start), lt(adClicks.createdAt, end))).then((rows: Array<{ count: number }>) => rows[0]),
    tx.select({ total: sql<string>`coalesce(sum(${adBilling.amount}), 0)` }).from(adBilling).where(and(eq(adBilling.campaignId, input.campaignId), inArray(adBilling.status, ["accrued", "invoiced", "paid"]), gte(adBilling.createdAt, start), lt(adBilling.createdAt, end))).then((rows: Array<{ total: string }>) => rows[0]),
    tx.select({ count: sql<number>`count(*)::int`, revenue: sql<string>`coalesce(sum(${adOrderAttributions.conversionValue}), 0)` }).from(adOrderAttributions).where(and(eq(adOrderAttributions.campaignId, input.campaignId), eq(adOrderAttributions.status, "delivered"), gte(adOrderAttributions.deliveredAt, start), lt(adOrderAttributions.deliveredAt, end))).then((rows: Array<{ count: number; revenue: string }>) => rows[0])
  ]);
  return calculateAdPerformance({
    impressions: Number(impressionRow?.count || 0),
    clicks: Number(clickRow?.count || 0),
    conversions: Number(conversionRow?.count || 0),
    spend: amount(billingRow?.total),
    revenue: amount(conversionRow?.revenue),
    invalidClicks: Number(invalidClickRow?.count || 0)
  });
}

/** Materializes raw daily telemetry into the existing ad_reports table for exports and future analytics. */
export async function refreshAdPerformanceReports(input: { date?: Date; limit?: number } = {}) {
  const { start, end } = utcDayRange(input.date);
  const campaigns = await db.select().from(adCampaigns).limit(Math.max(1, Math.min(input.limit || 300, 500)));
  const refreshed = [];
  for (const campaign of campaigns) {
    const metrics = await getCampaignPerformanceForDay({ campaignId: campaign.id, date: start });
    const [existing] = await db.select({ id: adReports.id }).from(adReports).where(and(eq(adReports.campaignId, campaign.id), gte(adReports.reportDate, start), lt(adReports.reportDate, end))).orderBy(sql`${adReports.reportDate} desc`).limit(1);
    const values = {
      storeId: campaign.storeId,
      reportDate: start,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      conversions: metrics.conversions,
      spend: metrics.spend.toFixed(2),
      revenue: metrics.revenue.toFixed(2),
      ctr: metrics.ctr.toFixed(4),
      cpc: metrics.cpc.toFixed(2),
      cvr: metrics.cvr.toFixed(4),
      invalidClicks: metrics.invalidClicks,
      roas: metrics.roas.toFixed(3),
      updatedAt: new Date()
    };
    const [report] = existing
      ? await db.update(adReports).set(values).where(eq(adReports.id, existing.id)).returning()
      : await db.insert(adReports).values({ campaignId: campaign.id, ...values }).returning();
    refreshed.push(report);
  }
  return { reportDate: start, refreshedCount: refreshed.length, reports: refreshed };
}
