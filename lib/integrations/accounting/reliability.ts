import { and, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import {
  db,
  integrationEvents,
  integrationFailedSyncs,
  inventoryMovements,
  orderInvoices,
  orderItems,
  orders,
  productVariants
} from "@/lib/db";
import { releaseOrderStock } from "@/lib/inventory/atomic-inventory";
import { processAccountingIntegrationEvent } from "@/lib/integrations/accounting/apply";

function retryDelay(attempts: number) {
  const minutes = Math.min(60, Math.max(1, 2 ** Math.max(0, attempts - 1)));
  return new Date(Date.now() + minutes * 60 * 1000 + Math.floor(Math.random() * 30_000));
}

export async function moveIntegrationEventToFailedQueue(input: { eventId: string; error: string; failureType?: string }) {
  const [event] = await db.select().from(integrationEvents).where(eq(integrationEvents.id, input.eventId)).limit(1);
  if (!event) return { moved: false, reason: "event_missing" };
  const payload = event.payload || {};
  const clientKey = typeof payload.integrationClient === "object" && payload.integrationClient ? String((payload.integrationClient as any).id || "") : null;
  const [failed] = await db.insert(integrationFailedSyncs).values({
    integrationEventId: event.id,
    clientKey,
    storeId: event.storeId,
    resource: event.entityType,
    direction: event.direction,
    failureType: input.failureType || "processing_error",
    attempts: event.attempts,
    error: input.error,
    payload: event.payload,
    nextRetryAt: retryDelay(event.attempts + 1)
  }).returning();
  await db.update(integrationEvents).set({ status: "failed", lastError: input.error, updatedAt: new Date() }).where(eq(integrationEvents.id, event.id));
  return { moved: true, failed };
}

export async function retryIntegrationEvent(eventId: string) {
  await db.update(integrationEvents).set({ status: "retry", nextAttemptAt: new Date(), lockedAt: null, updatedAt: new Date() }).where(eq(integrationEvents.id, eventId));
  await db.update(integrationFailedSyncs).set({ status: "retrying", nextRetryAt: new Date(), updatedAt: new Date() }).where(eq(integrationFailedSyncs.integrationEventId, eventId));
  return { queued: true, eventId };
}

export async function processIntegrationRetryQueue(limit = 25) {
  const due = await db
    .select({ id: integrationEvents.id, attempts: integrationEvents.attempts, maxAttempts: integrationEvents.maxAttempts })
    .from(integrationEvents)
    .where(and(eq(integrationEvents.provider, "accounting"), eq(integrationEvents.direction, "inbound"), inArray(integrationEvents.status, ["pending", "retry"]), lte(integrationEvents.nextAttemptAt, new Date())))
    .limit(Math.max(1, Math.min(limit, 100)));

  const results = [];
  for (const event of due) {
    try {
      await db.update(integrationEvents).set({ status: "processing", lockedAt: new Date(), attempts: sql`${integrationEvents.attempts} + 1`, updatedAt: new Date() }).where(eq(integrationEvents.id, event.id));
      const result = await processAccountingIntegrationEvent(event.id);
      results.push(result);
      const [after] = await db.select({ status: integrationEvents.status, attempts: integrationEvents.attempts, lastError: integrationEvents.lastError }).from(integrationEvents).where(eq(integrationEvents.id, event.id)).limit(1);
      if (after?.status === "failed") await moveIntegrationEventToFailedQueue({ eventId: event.id, error: after.lastError || "integration processing failed" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempts = event.attempts + 1;
      if (attempts >= event.maxAttempts) {
        await moveIntegrationEventToFailedQueue({ eventId: event.id, error: message });
      } else {
        await db.update(integrationEvents).set({ status: "retry", lockedAt: null, lastError: message, nextAttemptAt: retryDelay(attempts), updatedAt: new Date() }).where(eq(integrationEvents.id, event.id));
      }
      results.push({ processed: false, eventId: event.id, error: message });
    }
  }
  return { scanned: due.length, results };
}

export async function expireReservations(options: { limit?: number; reason?: string } = {}) {
  const now = new Date();
  const rows = await db
    .select({ order: orders })
    .from(orders)
    .leftJoin(orderInvoices, eq(orderInvoices.orderId, orders.id))
    .where(and(
      eq(orders.reservationStatus, "active"),
      lte(orders.reservationExpiresAt, now),
      isNull(orderInvoices.id),
      inArray(orders.statusCode, ["new", "confirmed", "pending", "processing"])
    ))
    .limit(Math.max(1, Math.min(options.limit || 50, 200)));

  const expired = [];
  for (const row of rows) {
    const order = row.order;
    const result = await db.transaction(async (tx) => {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      if (items.length) {
        await releaseOrderStock(tx, {
          storeId: order.storeId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          actorId: order.customerId,
          movementType: "release",
          items: items.map((item: any) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity, productName: item.productName }))
        });
      }
      const [updated] = await tx.update(orders).set({ reservationStatus: "expired", reservationReleasedAt: now, statusCode: "cancelled", cancelledAt: now, updatedAt: now }).where(eq(orders.id, order.id)).returning();
      return updated;
    });
    expired.push(result);
  }
  return { expiredCount: expired.length, orders: expired };
}

export async function getReconciliationDashboardData() {
  const now = new Date();
  const staleSince = new Date(Date.now() - 30 * 60 * 1000);
  const [summary, failedSyncs, retryQueue, awaitingErpInvoice, staleReservations, negativeAvailable, recentMovements, recentAudit] = await Promise.all([
    db.execute(sql`
      select
        (select count(*)::int from integration_events where status in ('pending','retry')) as retry_queue,
        (select count(*)::int from integration_events where status='failed') as failed_events,
        (select count(*)::int from integration_failed_syncs where status in ('open','retrying')) as failed_syncs,
        (select count(*)::int from orders where reservation_status='active' and reservation_expires_at < now()) as expired_reservations,
        (select count(*)::int from orders o left join order_invoices i on i.order_id=o.id where i.id is null and o.status_code not in ('cancelled','closed')) as awaiting_erp_invoice,
        (select count(*)::int from product_variants where stock_quantity - reserved_quantity < 0) as negative_available
    `),
    db.select().from(integrationFailedSyncs).where(inArray(integrationFailedSyncs.status, ["open", "retrying"])).orderBy(desc(integrationFailedSyncs.createdAt)).limit(30),
    db.select().from(integrationEvents).where(and(eq(integrationEvents.provider, "accounting"), inArray(integrationEvents.status, ["pending", "retry"]))).orderBy(integrationEvents.nextAttemptAt).limit(30),
    db.execute(sql`select * from orders o where not exists (select 1 from order_invoices i where i.order_id=o.id) and o.created_at <= ${staleSince} and o.status_code in ('new','confirmed') order by o.created_at desc limit 30`).catch(() => []),
    db.select().from(orders).where(and(eq(orders.reservationStatus, "active"), lte(orders.reservationExpiresAt, now))).orderBy(orders.reservationExpiresAt).limit(30),
    db.select({ id: productVariants.id, productId: productVariants.productId, sku: productVariants.sku, stockQuantity: productVariants.stockQuantity, reservedQuantity: productVariants.reservedQuantity }).from(productVariants).where(sql`${productVariants.stockQuantity} - ${productVariants.reservedQuantity} < 0`).limit(30),
    db.select().from(inventoryMovements).where(inArray(inventoryMovements.referenceType, ["erp_inventory_snapshot", "order"])).orderBy(desc(inventoryMovements.createdAt)).limit(30),
    db.execute(sql`select * from integration_audit_logs order by created_at desc limit 30`).catch(() => [])
  ]);

  return {
    generatedAt: now.toISOString(),
    summary: (summary as any)[0] || {},
    failedSyncs,
    retryQueue,
    awaitingErpInvoice,
    staleReservations,
    negativeAvailable,
    recentMovements,
    recentAudit: recentAudit as any[]
  };
}
