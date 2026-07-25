import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { adCampaigns, adClicks, adImpressions, adOrderAttributions, db } from "@/lib/db";

function variantMap(value: unknown) {
  const creative = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const variants = Array.isArray(creative.variants) ? creative.variants : [];
  return new Map(variants.filter((variant): variant is Record<string, unknown> => Boolean(variant) && typeof variant === "object" && !Array.isArray(variant) && typeof variant.id === "string").map((variant) => [String(variant.id), { label: typeof variant.label === "string" ? variant.label : "A", headline: typeof variant.headline === "string" ? variant.headline : null }]));
}

/** Seven-day cohort statistics for creative variants. Only server-side hashed visitor identifiers exist in raw events. */
export async function getMerchantCreativeVariantPerformance(storeId: string, days = 7) {
  const since = new Date(Date.now() - Math.max(1, Math.min(days, 30)) * 24 * 60 * 60 * 1000);
  const impressionVariant = sql<string | null>`${adImpressions.metadata}->>'creativeVariantId'`;
  const clickVariant = sql<string | null>`${adClicks.metadata}->>'creativeVariantId'`;
  const [campaigns, impressions, clicks, conversions] = await Promise.all([
    db.select({ id: adCampaigns.id, name: adCampaigns.name, creative: adCampaigns.creative }).from(adCampaigns).where(eq(adCampaigns.storeId, storeId)),
    db.select({ campaignId: adImpressions.campaignId, variantId: impressionVariant, count: sql<number>`count(*)::int` }).from(adImpressions).where(and(eq(adImpressions.storeId, storeId), gte(adImpressions.createdAt, since), sql`${adImpressions.metadata}->>'creativeVariantId' is not null`)).groupBy(adImpressions.campaignId, impressionVariant),
    db.select({ campaignId: adClicks.campaignId, variantId: clickVariant, count: sql<number>`count(*)::int` }).from(adClicks).where(and(eq(adClicks.storeId, storeId), gte(adClicks.createdAt, since), inArray(adClicks.fraudStatus, ["clean", "pending"]), sql`${adClicks.metadata}->>'creativeVariantId' is not null`)).groupBy(adClicks.campaignId, clickVariant),
    db.select({ campaignId: adOrderAttributions.campaignId, variantId: clickVariant, count: sql<number>`count(*)::int`, revenue: sql<string>`coalesce(sum(${adOrderAttributions.conversionValue}), 0)` }).from(adOrderAttributions).innerJoin(adClicks, eq(adOrderAttributions.clickId, adClicks.id)).where(and(eq(adOrderAttributions.storeId, storeId), eq(adOrderAttributions.status, "delivered"), gte(adOrderAttributions.deliveredAt, since), sql`${adClicks.metadata}->>'creativeVariantId' is not null`)).groupBy(adOrderAttributions.campaignId, clickVariant)
  ]);
  const index = new Map<string, { impressions: number; clicks: number; conversions: number; revenue: number }>();
  const key = (campaignId: string, variantId: string) => `${campaignId}:${variantId}`;
  for (const row of impressions) if (row.variantId) index.set(key(row.campaignId, row.variantId), { ...(index.get(key(row.campaignId, row.variantId)) || { impressions: 0, clicks: 0, conversions: 0, revenue: 0 }), impressions: Number(row.count || 0) });
  for (const row of clicks) if (row.variantId) index.set(key(row.campaignId, row.variantId), { ...(index.get(key(row.campaignId, row.variantId)) || { impressions: 0, clicks: 0, conversions: 0, revenue: 0 }), clicks: Number(row.count || 0) });
  for (const row of conversions) if (row.variantId) index.set(key(row.campaignId, row.variantId), { ...(index.get(key(row.campaignId, row.variantId)) || { impressions: 0, clicks: 0, conversions: 0, revenue: 0 }), conversions: Number(row.count || 0), revenue: Number(row.revenue || 0) });

  return campaigns.flatMap((campaign) => {
    const variants = variantMap(campaign.creative);
    return [...variants.entries()].map(([variantId, variant]) => {
      const metric = index.get(key(campaign.id, variantId)) || { impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
      return { campaignId: campaign.id, campaignName: campaign.name, variantId, label: variant.label, headline: variant.headline, ...metric, ctr: metric.impressions ? Math.round((metric.clicks / metric.impressions) * 10_000) / 100 : 0, cvr: metric.clicks ? Math.round((metric.conversions / metric.clicks) * 10_000) / 100 : 0 };
    });
  }).filter((variant) => variant.impressions || variant.clicks || variant.conversions);
}
