import { sql } from "drizzle-orm";
import { adCampaignDeliveryCounters } from "@/lib/db";

type DbLike = any;

/** Updates the counter in the same transaction as the idempotently inserted
 * event, making homepage exposure caps enforceable rather than advisory. */
export async function incrementAdDeliveryCounter(input: {
  tx: DbLike;
  campaignId: string;
  eventType: "impression" | "click" | "conversion";
  cleanClick?: boolean;
  conversionValue?: number;
  now?: Date;
}) {
  const now = input.now || new Date();
  const values = {
    campaignId: input.campaignId,
    impressions: input.eventType === "impression" ? 1 : 0,
    clicks: input.eventType === "click" ? 1 : 0,
    cleanClicks: input.eventType === "click" && input.cleanClick ? 1 : 0,
    conversions: input.eventType === "conversion" ? 1 : 0,
    attributedRevenue: Math.max(0, Number(input.conversionValue || 0)).toFixed(2),
    lastImpressionAt: input.eventType === "impression" ? now : null,
    lastClickAt: input.eventType === "click" ? now : null,
    lastConversionAt: input.eventType === "conversion" ? now : null,
    updatedAt: now
  };
  await input.tx.insert(adCampaignDeliveryCounters).values(values).onConflictDoUpdate({
    target: adCampaignDeliveryCounters.campaignId,
    set: {
      impressions: sql`${adCampaignDeliveryCounters.impressions} + ${values.impressions}`,
      clicks: sql`${adCampaignDeliveryCounters.clicks} + ${values.clicks}`,
      cleanClicks: sql`${adCampaignDeliveryCounters.cleanClicks} + ${values.cleanClicks}`,
      conversions: sql`${adCampaignDeliveryCounters.conversions} + ${values.conversions}`,
      attributedRevenue: sql`${adCampaignDeliveryCounters.attributedRevenue} + ${values.attributedRevenue}`,
      lastImpressionAt: values.lastImpressionAt || adCampaignDeliveryCounters.lastImpressionAt,
      lastClickAt: values.lastClickAt || adCampaignDeliveryCounters.lastClickAt,
      lastConversionAt: values.lastConversionAt || adCampaignDeliveryCounters.lastConversionAt,
      updatedAt: now
    }
  });
}
