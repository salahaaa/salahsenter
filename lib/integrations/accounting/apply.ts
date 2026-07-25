import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  integrationEntityLinks,
  integrationEvents,
  erpConflictCases,
  inventoryMovements,
  orderInvoices,
  orderItems,
  orderPayments,
  orderStatusDefinitions,
  orders,
  productVariants
} from "@/lib/db";
import { releaseOrderStock } from "@/lib/inventory/atomic-inventory";
import { settleClosedPaidOrder } from "@/lib/finance/settlements";
import { platformIsFinancialIntermediary } from "@/lib/platform-revenue/customer-money-policy";

type DbLike = any;

type IntegrationEventRow = typeof integrationEvents.$inferSelect;

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function itemsFromPayload(payload: Record<string, unknown>): Record<string, unknown>[] {
  const items = payload.items;
  return Array.isArray(items) ? items.filter((item) => item && typeof item === "object") as Record<string, unknown>[] : [];
}

async function recordErpConflict(tx: DbLike, input: { event: IntegrationEventRow; entityType: string; platformEntityId?: string | null; externalEntityId?: string | null; conflictType: string; platformSnapshot?: Record<string, unknown>; externalSnapshot?: Record<string, unknown> }) {
  const payload = asObject(input.event.payload);
  const clientKey = String(asObject(payload.integrationClient).id || "") || null;
  const [existing] = await tx.select({ id: erpConflictCases.id }).from(erpConflictCases).where(and(eq(erpConflictCases.entityType, input.entityType), eq(erpConflictCases.conflictType, input.conflictType), input.platformEntityId ? eq(erpConflictCases.platformEntityId, input.platformEntityId) : input.externalEntityId ? eq(erpConflictCases.externalEntityId, input.externalEntityId) : sql`false`, inArray(erpConflictCases.status, ["open", "assigned"]))).limit(1);
  if (existing) return existing.id;
  const [created] = await tx.insert(erpConflictCases).values({
    storeId: input.event.storeId || null,
    clientKey,
    entityType: input.entityType,
    platformEntityId: input.platformEntityId || null,
    externalEntityId: input.externalEntityId || null,
    conflictType: input.conflictType,
    platformSnapshot: input.platformSnapshot || {},
    externalSnapshot: input.externalSnapshot || {}
  }).returning();
  return created?.id || null;
}

async function resolveVariantId(tx: DbLike, clientKey: string, item: Record<string, unknown>) {
  const direct = String(item.variantId || "").trim();
  if (direct) return direct;
  const external = String(item.externalVariantId || item.externalProductId || item.externalId || item.productCode || "").trim();
  if (!external) return null;
  const [link] = await tx
    .select({ platformEntityId: integrationEntityLinks.platformEntityId })
    .from(integrationEntityLinks)
    .where(and(eq(integrationEntityLinks.clientKey, clientKey), eq(integrationEntityLinks.entityType, "variant"), eq(integrationEntityLinks.externalEntityId, external)))
    .limit(1);
  return link?.platformEntityId || null;
}

async function applyInventorySnapshot(tx: DbLike, event: IntegrationEventRow, item: Record<string, unknown>) {
  const clientKey = String(asObject(event.payload).integrationClient && asObject(asObject(event.payload).integrationClient).id || "");
  const variantId = await resolveVariantId(tx, clientKey, item);
  if (!variantId) {
    await recordErpConflict(tx, { event, entityType: "inventory", externalEntityId: String(item.externalVariantId || item.externalProductId || item.externalId || item.productCode || "") || null, conflictType: "variant_unresolved", externalSnapshot: item });
    return { applied: false, reason: "variant_unresolved" };
  }
  const quantityOnHand = Number(item.quantityOnHand ?? item.stockQuantity ?? item.availableQuantity ?? item.quantity ?? 0);
  if (!Number.isFinite(quantityOnHand) || quantityOnHand < 0) return { applied: false, reason: "invalid_quantity" };
  const [variant] = await tx.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1);
  if (!variant) {
    await recordErpConflict(tx, { event, entityType: "inventory", platformEntityId: variantId, conflictType: "variant_missing", externalSnapshot: item });
    return { applied: false, reason: "variant_missing" };
  }
  const storeId = event.storeId || String(item.storeId || "");
  if (!storeId) return { applied: false, reason: "store_unresolved" };
  const beforeAvailable = Number(variant.stockQuantity || 0) - Number(variant.reservedQuantity || 0);
  if (Number(variant.reservedQuantity || 0) > quantityOnHand) {
    await recordErpConflict(tx, { event, entityType: "inventory", platformEntityId: variant.id, conflictType: "incoming_stock_below_active_reservations", platformSnapshot: { stockQuantity: variant.stockQuantity, reservedQuantity: variant.reservedQuantity }, externalSnapshot: item });
  }
  const cappedReserved = Math.min(Number(variant.reservedQuantity || 0), quantityOnHand);
  const afterAvailable = quantityOnHand - cappedReserved;
  const [updated] = await tx
    .update(productVariants)
    .set({ stockQuantity: quantityOnHand, reservedQuantity: cappedReserved, updatedAt: new Date() })
    .where(eq(productVariants.id, variantId))
    .returning({ productId: productVariants.productId, stockQuantity: productVariants.stockQuantity, reservedQuantity: productVariants.reservedQuantity });
  await tx.insert(inventoryMovements).values({
    storeId,
    productId: updated.productId,
    variantId,
    type: "adjust",
    quantity: Math.abs(afterAvailable - beforeAvailable),
    beforeQuantity: beforeAvailable,
    afterQuantity: afterAvailable,
    reason: `ERP inventory snapshot (${event.id})`,
    referenceType: "erp_inventory_snapshot",
    referenceId: event.id
  }).onConflictDoNothing();
  return { applied: true, variantId, quantityOnHand, availableQuantity: afterAvailable };
}

async function findOrder(tx: DbLike, item: Record<string, unknown>) {
  const orderId = String(item.orderId || "").trim();
  if (orderId) return (await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0] || null;
  const orderNumber = String(item.orderNumber || "").trim();
  if (orderNumber) return (await tx.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1))[0] || null;
  return null;
}

async function applyInvoiceCreated(tx: DbLike, event: IntegrationEventRow, item: Record<string, unknown>) {
  const order = await findOrder(tx, item);
  if (!order) return { applied: false, reason: "order_unresolved" };
  const invoiceNumber = String(item.invoiceNumber || item.externalInvoiceId || `ERP-${order.orderNumber}`).slice(0, 80);
  const sourceSystem = String(item.sourceSystem || asObject(event.payload).sourceSystem || "erp").slice(0, 120);
  const externalInvoiceId = String(item.externalInvoiceId || item.invoiceId || invoiceNumber).slice(0, 180);
  const postedAt = item.issuedAt || item.postedAt ? new Date(String(item.issuedAt || item.postedAt)) : new Date();
  const totalsSnapshot = asObject(item.totalsSnapshot);
  if (!Object.keys(totalsSnapshot).length) {
    totalsSnapshot.currency = order.currency;
    totalsSnapshot.grandTotal = Number(item.total ?? item.amount ?? order.grandTotal ?? 0);
    totalsSnapshot.source = "erp";
  }

  const [invoice] = await tx
    .insert(orderInvoices)
    .values({
      orderId: order.id,
      invoiceNumber,
      invoiceDate: Number.isFinite(postedAt.getTime()) ? postedAt : new Date(),
      status: String(item.status || "issued"),
      externalInvoiceId,
      sourceSystem,
      erpPostedAt: Number.isFinite(postedAt.getTime()) ? postedAt : new Date(),
      totalsSnapshot,
      sellerSnapshot: asObject(item.sellerSnapshot),
      buyerSnapshot: asObject(item.buyerSnapshot),
      integrationMetadata: { integrationEventId: event.id, raw: item }
    })
    .onConflictDoUpdate({
      target: orderInvoices.orderId,
      set: { invoiceNumber, status: String(item.status || "issued"), externalInvoiceId, sourceSystem, erpPostedAt: new Date(), integrationMetadata: { integrationEventId: event.id, raw: item }, updatedAt: new Date() }
    })
    .returning();

  const orderItemRows = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  if (orderItemRows.length) {
    await releaseOrderStock(tx, {
      storeId: order.storeId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      actorId: order.customerId,
      movementType: "release",
      items: orderItemRows.map((row: any) => ({ productId: row.productId, variantId: row.variantId, quantity: row.quantity, productName: row.productName }))
    });
  }

  // Invoice confirmation proves ERP invoicing and releases the platform reservation.
  // Payment/delivery/revenue settlement remain separate inbound updates.
  await tx.update(orders).set({ reservationStatus: "released", reservationReleasedAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, order.id));
  return { applied: true, orderId: order.id, invoiceId: invoice.id, invoiceNumber, invoicePosted: true };
}

async function applyInvoiceCancelled(tx: DbLike, event: IntegrationEventRow, item: Record<string, unknown>) {
  const order = await findOrder(tx, item);
  if (!order) return { applied: false, reason: "order_unresolved" };
  await tx.update(orderInvoices).set({ status: "cancelled", integrationMetadata: { integrationEventId: event.id, cancelledByErp: true, raw: item }, updatedAt: new Date() }).where(eq(orderInvoices.orderId, order.id));
  await tx.update(orders).set({ statusCode: "cancelled", cancelledAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, order.id));
  return { applied: true, orderId: order.id, cancelled: true };
}

async function applyOrderUpdated(tx: DbLike, event: IntegrationEventRow, item: Record<string, unknown>) {
  const order = await findOrder(tx, item);
  if (!order) return { applied: false, reason: "order_unresolved" };
  const requestedStatus = String(item.statusCode || item.orderStatus || "").trim();
  const [definition] = requestedStatus ? await tx.select({ code: orderStatusDefinitions.code }).from(orderStatusDefinitions).where(eq(orderStatusDefinitions.code, requestedStatus)).limit(1) : [null];
  const statusCode = definition?.code || order.statusCode;
  const paymentStatus = ["pending", "paid", "failed", "refunded"].includes(String(item.paymentStatus || "")) ? String(item.paymentStatus) : order.paymentStatus;
  await tx.update(orders).set({ statusCode, paymentStatus: paymentStatus as any, deliveredAt: statusCode === "delivered" ? new Date() : order.deliveredAt, updatedAt: new Date() }).where(eq(orders.id, order.id));
  const settlement = paymentStatus === "paid" && ["closed", "delivered"].includes(statusCode)
    ? platformIsFinancialIntermediary() ? await settleClosedPaidOrder(tx, order.id, null) : { settled: false, reason: "merchant_collects_direct_payment" }
    : { settled: false, reason: "awaiting_payment_or_close" };
  return { applied: true, orderId: order.id, statusCode, paymentStatus, settlement };
}

async function applyPaymentUpdated(tx: DbLike, event: IntegrationEventRow, item: Record<string, unknown>) {
  const order = await findOrder(tx, item);
  if (!order) return { applied: false, reason: "order_unresolved" };
  const requested = String(item.paymentStatus || item.status || "pending").toLowerCase();
  const paymentStatus = ["paid", "failed", "refunded"].includes(requested) ? requested : "pending";
  const paidAt = paymentStatus === "paid" ? new Date(String(item.paidAt || item.postedAt || Date.now())) : null;
  await tx.update(orders).set({ paymentStatus: paymentStatus as any, updatedAt: new Date() }).where(eq(orders.id, order.id));
  await tx.update(orderPayments).set({ status: paymentStatus as any, paidAt: paidAt || undefined, transactionReference: String(item.paymentReference || item.transactionReference || "") || undefined, providerResponse: { integrationEventId: event.id, source: "erp", raw: item }, updatedAt: new Date() }).where(eq(orderPayments.orderId, order.id));
  const settlement = paymentStatus === "paid" && ["closed", "delivered"].includes(order.statusCode)
    ? platformIsFinancialIntermediary() ? await settleClosedPaidOrder(tx, order.id, null) : { settled: false, reason: "merchant_collects_direct_payment" }
    : { settled: false, reason: "awaiting_order_close" };
  return { applied: true, orderId: order.id, paymentStatus, settlement };
}

export async function processAccountingIntegrationEvent(eventId: string) {
  return db.transaction(async (tx) => {
    const [event] = await tx.select().from(integrationEvents).where(eq(integrationEvents.id, eventId)).limit(1);
    if (!event) return { processed: false, reason: "event_missing" };
    if (event.status === "processed") return { processed: false, reason: "already_processed" };

    const payload = asObject(event.payload);
    const items = itemsFromPayload(payload);
    const results = [];

    if (event.entityType === "inventory") {
      for (const item of items) results.push(await applyInventorySnapshot(tx, event, item));
    } else if (event.entityType === "invoices") {
      for (const item of items) {
        const status = String(item.status || event.eventType || "").toLowerCase();
        if (status.includes("cancel")) results.push(await applyInvoiceCancelled(tx, event, item));
        else results.push(await applyInvoiceCreated(tx, event, item));
      }
    } else if (event.entityType === "orders") {
      for (const item of items) results.push(await applyOrderUpdated(tx, event, item));
    } else if (event.entityType === "payments") {
      for (const item of items) results.push(await applyPaymentUpdated(tx, event, item));
    } else if (event.entityType === "products") {
      // Product names, descriptions, images and merchant prices are platform/merchant authority.
      // The agent may observe them but cannot overwrite the catalog.
      results.push({ applied: false, ignored: true, reason: "platform_product_and_price_authority", entityType: event.entityType });
    } else {
      results.push({ applied: false, reason: "queued_for_future_mapper", entityType: event.entityType });
    }

    const appliedCount = results.filter((result) => result.applied).length;
    const handledCount = results.filter((result) => result.applied || ("ignored" in result && result.ignored === true)).length;
    await tx.update(integrationEvents).set({
      status: handledCount || !items.length ? "processed" : "failed",
      attempts: sql`${integrationEvents.attempts} + 1`,
      processedAt: handledCount || !items.length ? new Date() : null,
      lastError: handledCount || !items.length ? null : JSON.stringify(results).slice(0, 2000),
      updatedAt: new Date(),
      payload: sql`${integrationEvents.payload} || ${JSON.stringify({ processingResult: results })}::jsonb`
    }).where(eq(integrationEvents.id, event.id));

    return { processed: true, eventId: event.id, results, appliedCount };
  });
}

export async function processPendingAccountingIntegrationEvents(limit = 25) {
  const rows = await db.select({ id: integrationEvents.id }).from(integrationEvents).where(and(eq(integrationEvents.provider, "accounting"), eq(integrationEvents.direction, "inbound"), inArray(integrationEvents.status, ["pending", "retry"]))).limit(limit);
  const results = [];
  for (const row of rows) results.push(await processAccountingIntegrationEvent(row.id));
  return { processed: results.length, results };
}
