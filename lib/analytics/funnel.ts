import crypto from "node:crypto";
import { and, gte, sql } from "drizzle-orm";
import { commerceFunnelEvents, db } from "@/lib/db";

type DbLike = any;

export const funnelEventTypes = ["product_view", "add_to_cart", "checkout_started", "order_created", "order_delivered", "product_recommendation_click"] as const;
export type FunnelEventType = (typeof funnelEventTypes)[number];

export function hashVisitorId(value: string | null | undefined) {
  if (!value) return null;
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function recordFunnelEvent(input: { eventType: FunnelEventType; visitorId?: string | null; userId?: string | null; storeId?: string | null; productId?: string | null; orderId?: string | null; metadata?: Record<string, unknown>; tx?: DbLike }) {
  const executor = input.tx || db;
  await executor.insert(commerceFunnelEvents).values({
    eventType: input.eventType,
    visitorHash: hashVisitorId(input.visitorId),
    userId: input.userId || null,
    storeId: input.storeId || null,
    productId: input.productId || null,
    orderId: input.orderId || null,
    metadata: input.metadata || {}
  });
}

export async function getFunnelSummary(input: { storeId?: string; days?: number } = {}) {
  const since = new Date(Date.now() - Math.max(1, Math.min(input.days || 30, 365)) * 24 * 60 * 60 * 1000);
  const conditions = [gte(commerceFunnelEvents.createdAt, since)];
  if (input.storeId) conditions.push(sql`${commerceFunnelEvents.storeId} = ${input.storeId}`);
  const rows = await db
    .select({ eventType: commerceFunnelEvents.eventType, count: sql<number>`count(*)::int` })
    .from(commerceFunnelEvents)
    .where(and(...conditions))
    .groupBy(commerceFunnelEvents.eventType);
  const byType = Object.fromEntries(rows.map((row) => [row.eventType, Number(row.count || 0)]));
  const views = Number(byType.product_view || 0);
  const carts = Number(byType.add_to_cart || 0);
  const checkoutStarted = Number(byType.checkout_started || 0);
  const orders = Number(byType.order_created || 0);
  const delivered = Number(byType.order_delivered || 0);
  const recommendationClicks = Number(byType.product_recommendation_click || 0);
  const rate = (part: number, whole: number) => whole ? Math.round((part / whole) * 1000) / 10 : 0;
  return {
    days: Math.max(1, Math.min(input.days || 30, 365)),
    counts: { productViews: views, addToCart: carts, checkoutStarted, ordersCreated: orders, ordersDelivered: delivered, recommendationClicks },
    rates: { viewToCart: rate(carts, views), cartToCheckout: rate(checkoutStarted, carts), checkoutToOrder: rate(orders, checkoutStarted), orderToDelivered: rate(delivered, orders), recommendationClickRate: rate(recommendationClicks, views) }
  };
}
