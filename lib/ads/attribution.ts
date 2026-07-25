import { and, eq, gte, sql } from "drizzle-orm";
import { adClicks, adOrderAttributions, adCampaigns, orders } from "@/lib/db";
import { incrementAdDeliveryCounter } from "@/lib/ads/delivery-counters";

type DbLike = any;

export type OrderAdAttributionInput = {
  campaignId: string;
  placement: string;
  productId?: string | null;
  attributionToken: string;
  clickedAt: string;
};

const attributionWindowMs = 7 * 24 * 60 * 60 * 1000;

/**
 * Resolves a browser token against a real click owned by the same store. A
 * malformed, expired or unmatched token never blocks checkout; it merely
 * produces no attribution record.
 */
export async function recordOrderAdAttribution(input: {
  tx: DbLike;
  order: typeof orders.$inferSelect;
  customerId: string;
  orderProductIds: string[];
  attribution?: OrderAdAttributionInput | null;
  now?: Date;
}) {
  const attribution = input.attribution;
  if (!attribution) return null;
  const now = input.now || new Date();
  const submittedClickTime = new Date(attribution.clickedAt);
  if (Number.isNaN(submittedClickTime.getTime()) || submittedClickTime.getTime() > now.getTime() + 5 * 60 * 1000 || now.getTime() - submittedClickTime.getTime() > attributionWindowMs) return null;

  const [matched] = await input.tx
    .select({ click: adClicks, campaign: adCampaigns })
    .from(adClicks)
    .innerJoin(adCampaigns, eq(adClicks.campaignId, adCampaigns.id))
    .where(and(
      eq(adClicks.campaignId, attribution.campaignId),
      eq(adClicks.storeId, input.order.storeId),
      eq(adCampaigns.storeId, input.order.storeId),
      eq(sql`${adClicks.metadata}->>'attributionToken'`, attribution.attributionToken),
      gte(adClicks.createdAt, new Date(now.getTime() - attributionWindowMs))
    ))
    .orderBy(sql`${adClicks.createdAt} desc`)
    .limit(1);
  if (!matched) return null;
  if (matched.click.productId && !input.orderProductIds.includes(matched.click.productId)) return null;
  if (attribution.productId && matched.click.productId && attribution.productId !== matched.click.productId) return null;

  const [record] = await input.tx
    .insert(adOrderAttributions)
    .values({
      orderId: input.order.id,
      campaignId: matched.campaign.id,
      clickId: matched.click.id,
      storeId: input.order.storeId,
      customerId: input.customerId,
      attributionToken: attribution.attributionToken,
      placement: matched.click.placement,
      conversionValue: input.order.grandTotal,
      currency: input.order.currency,
      status: "created",
      clickedAt: matched.click.createdAt,
      attributedAt: now,
      metadata: { clickEventKey: matched.click.eventKey, source: "checkout", submittedPlacement: attribution.placement }
    })
    .onConflictDoNothing({ target: adOrderAttributions.orderId })
    .returning();
  return record || null;
}

export async function markOrderAdAttributionStatus(input: { tx: DbLike; orderId: string; status: "delivered" | "cancelled"; now?: Date }) {
  const now = input.now || new Date();
  const [record] = await input.tx
    .update(adOrderAttributions)
    .set({ status: input.status, deliveredAt: input.status === "delivered" ? now : null, updatedAt: now })
    .where(and(eq(adOrderAttributions.orderId, input.orderId), eq(adOrderAttributions.status, "created")))
    .returning();
  if (record?.status === "delivered") await incrementAdDeliveryCounter({ tx: input.tx, campaignId: record.campaignId, eventType: "conversion", conversionValue: Number(record.conversionValue || 0), now });
  return record || null;
}
