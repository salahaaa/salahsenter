import { eq } from "drizzle-orm";
import { orderItems, orders } from "@/lib/db";
import { getMerchantIntegrationSettings } from "@/lib/commerce/financial-strategy";
import { createFinancialServices } from "@/lib/commerce/financial-services";
import { recordOfferProductSales } from "@/lib/offers/offer-product-inventory";

type DbLike = any;

/**
 * Standalone inventory is committed only after a paid delivery/close. Webhook,
 * receipt-review and merchant status paths all call this idempotent guard.
 */
export async function finalizePaidDeliveredStandaloneOrder(tx: DbLike, input: { orderId: string; actorId?: string | null }) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (!order) return { finalized: false, reason: "order_missing" };
  if (order.reservationStatus !== "active") return { finalized: false, reason: "reservation_not_active" };
  if (order.paymentStatus !== "paid" || !["delivered", "closed"].includes(order.statusCode)) return { finalized: false, reason: "awaiting_paid_completion" };

  const settings = await getMerchantIntegrationSettings(order.storeId);
  const financialServices = createFinancialServices(settings);
  if (financialServices.mode !== "STANDALONE") return { finalized: false, reason: "erp_inventory_authority" };

  const items: Array<typeof orderItems.$inferSelect> = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  if (!items.length) return { finalized: false, reason: "order_items_missing" };
  const finalization = await financialServices.inventory.finalizeOrderReservation(tx, {
    storeId: order.storeId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    actorId: input.actorId || null,
    items: items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity, productName: item.productName }))
  });
  if (!finalization.finalized) return finalization;

  await recordOfferProductSales(tx, { orderId: order.id, items: items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })) });
  await tx.update(orders).set({ reservationStatus: "released", reservationReleasedAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, order.id));
  return { finalized: true };
}
