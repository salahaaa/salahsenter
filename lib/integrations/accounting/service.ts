import { and, asc, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import {
  backgroundJobs,
  db,
  integrationEvents,
  orderInvoices,
  orderItems,
  orders,
  products,
  productVariants
} from "@/lib/db";
import { assertStoreAllowed, type IntegrationAuthContext } from "@/lib/integrations/accounting/auth";
import { assertAgentStoreEnabled } from "@/lib/integrations/erp/agent-access";
import type { InventorySyncDTO, InvoiceSyncDTO, OrderSyncDTO, ProductSyncDTO, SyncPullResponse } from "@/lib/integrations/accounting/dtos";
import { writeIntegrationAudit } from "@/lib/integrations/accounting/audit";

export type PullQuery = {
  storeId?: string | null;
  since?: string | null;
  cursor?: string | null;
  limit?: number;
};

function limit(input?: number) {
  return Math.max(1, Math.min(Number(input || 100), 500));
}

function dateFrom(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function money(amount: unknown, currency = "YER") {
  return { amount: Number(amount || 0), currency };
}

function page<T extends { updatedAt?: string; createdAt?: string }>(items: T[], requestedLimit: number): SyncPullResponse<T> {
  const hasMore = items.length > requestedLimit;
  const data = hasMore ? items.slice(0, requestedLimit) : items;
  const last = data[data.length - 1];
  return {
    data,
    pageInfo: {
      limit: requestedLimit,
      hasMore,
      nextCursor: hasMore && last ? last.updatedAt || last.createdAt || null : null,
      generatedAt: new Date().toISOString()
    }
  };
}

function storePredicate(context: IntegrationAuthContext, explicitStoreId?: string | null) {
  if (explicitStoreId) {
    assertStoreAllowed(context, explicitStoreId);
    return eq(products.storeId, explicitStoreId);
  }
  if (context.storeIds.length) return inArray(products.storeId, context.storeIds);
  return undefined;
}

function orderStorePredicate(context: IntegrationAuthContext, explicitStoreId?: string | null) {
  if (explicitStoreId) {
    assertStoreAllowed(context, explicitStoreId);
    return eq(orders.storeId, explicitStoreId);
  }
  if (context.storeIds.length) return inArray(orders.storeId, context.storeIds);
  return undefined;
}

function invoiceStorePredicate(context: IntegrationAuthContext, explicitStoreId?: string | null) {
  if (explicitStoreId) {
    assertStoreAllowed(context, explicitStoreId);
    return eq(orders.storeId, explicitStoreId);
  }
  if (context.storeIds.length) return inArray(orders.storeId, context.storeIds);
  return undefined;
}

export async function getProductsForAccounting(context: IntegrationAuthContext, query: PullQuery): Promise<SyncPullResponse<ProductSyncDTO>> {
  const requestedLimit = limit(query.limit);
  const since = dateFrom(query.cursor || query.since);
  const predicates = [storePredicate(context, query.storeId), since ? gt(products.updatedAt, since) : undefined].filter(Boolean) as any[];
  const productRows = await db
    .select()
    .from(products)
    .where(predicates.length ? and(...predicates) : undefined)
    .orderBy(asc(products.updatedAt), asc(products.id))
    .limit(requestedLimit + 1);

  const productIds = productRows.map((product) => product.id);
  const variantRows = productIds.length
    ? await db.select().from(productVariants).where(inArray(productVariants.productId, productIds)).orderBy(asc(productVariants.createdAt))
    : [];

  const byProduct = new Map<string, typeof variantRows>();
  for (const variant of variantRows) byProduct.set(variant.productId, [...(byProduct.get(variant.productId) || []), variant]);

  return page(productRows.map((product) => ({
    productId: product.id,
    storeId: product.storeId,
    sku: product.productCode,
    barcode: product.barcode,
    productCode: product.productCode,
    name: product.name,
    englishName: product.englishName,
    description: product.description || product.shortDescription,
    categoryId: product.categoryId,
    brand: product.brand,
    status: product.status,
    basePrice: product.basePrice == null ? undefined : money(product.basePrice),
    discountPercent: Number(product.discountPercent || 0),
    variants: (byProduct.get(product.id) || []).map((variant) => ({
      variantId: variant.id,
      sku: variant.sku,
      barcode: variant.barcode,
      title: variant.title,
      price: money(variant.price),
      compareAtPrice: variant.compareAtPrice == null ? undefined : money(variant.compareAtPrice),
      stockQuantity: variant.stockQuantity,
      attributes: variant.attributes || {},
      isActive: variant.isActive,
      updatedAt: variant.updatedAt.toISOString()
    })),
    updatedAt: product.updatedAt.toISOString()
  })), requestedLimit);
}

export async function getInventoryForAccounting(context: IntegrationAuthContext, query: PullQuery): Promise<SyncPullResponse<InventorySyncDTO>> {
  const requestedLimit = limit(query.limit);
  const since = dateFrom(query.cursor || query.since);
  const predicates = [storePredicate(context, query.storeId), since ? gt(productVariants.updatedAt, since) : undefined].filter(Boolean) as any[];
  const rows = await db
    .select({ product: products, variant: productVariants })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(predicates.length ? and(...predicates) : undefined)
    .orderBy(asc(productVariants.updatedAt), asc(productVariants.id))
    .limit(requestedLimit + 1);

  return page(rows.map(({ product, variant }) => ({
    storeId: product.storeId,
    productId: product.id,
    variantId: variant.id,
    sku: variant.sku,
    barcode: variant.barcode,
    productName: product.name,
    variantTitle: variant.title,
    quantityOnHand: variant.stockQuantity,
    reservedQuantity: variant.reservedQuantity,
    availableQuantity: Math.max(0, Number(variant.stockQuantity || 0) - Number(variant.reservedQuantity || 0)),
    lowStockThreshold: variant.lowStockThreshold,
    updatedAt: variant.updatedAt.toISOString()
  })), requestedLimit);
}

export async function getOrdersForAccounting(context: IntegrationAuthContext, query: PullQuery): Promise<SyncPullResponse<OrderSyncDTO>> {
  const requestedLimit = limit(query.limit);
  const since = dateFrom(query.cursor || query.since);
  const predicates = [orderStorePredicate(context, query.storeId), since ? gt(orders.updatedAt, since) : undefined].filter(Boolean) as any[];
  const orderRows = await db.select().from(orders).where(predicates.length ? and(...predicates) : undefined).orderBy(asc(orders.updatedAt), asc(orders.id)).limit(requestedLimit + 1);
  const orderIds = orderRows.map((order) => order.id);
  const itemRows = orderIds.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)).orderBy(asc(orderItems.createdAt)) : [];
  const byOrder = new Map<string, typeof itemRows>();
  for (const item of itemRows) byOrder.set(item.orderId, [...(byOrder.get(item.orderId) || []), item]);

  return page(orderRows.map((order) => ({
    orderId: order.id,
    orderNumber: order.orderNumber,
    storeId: order.storeId,
    customerId: order.customerId,
    statusCode: order.statusCode,
    paymentStatus: order.paymentStatus,
    currency: order.currency,
    subtotal: money(order.subtotal, order.currency),
    shippingFee: money(order.shippingFee, order.currency),
    discountTotal: money(order.discountTotal, order.currency),
    grandTotal: money(order.grandTotal, order.currency),
    deliveryAddress: order.deliveryAddress || {},
    customerNote: order.customerNote,
    lines: (byOrder.get(order.id) || []).map((item) => ({
      lineId: item.id,
      productId: item.productId,
      variantId: item.variantId,
      sku: item.sku,
      productCode: item.productCode,
      productName: item.productName,
      variantTitle: item.variantTitle,
      quantity: item.quantity,
      unitPrice: money(item.unitPrice, order.currency),
      totalPrice: money(item.totalPrice, order.currency)
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString()
  })), requestedLimit);
}

export async function getInvoicesForAccounting(context: IntegrationAuthContext, query: PullQuery): Promise<SyncPullResponse<InvoiceSyncDTO>> {
  const requestedLimit = limit(query.limit);
  const since = dateFrom(query.cursor || query.since);
  const predicates = [invoiceStorePredicate(context, query.storeId), since ? gt(orderInvoices.updatedAt, since) : undefined].filter(Boolean) as any[];
  const rows = await db
    .select({ invoice: orderInvoices, order: orders })
    .from(orderInvoices)
    .innerJoin(orders, eq(orderInvoices.orderId, orders.id))
    .where(predicates.length ? and(...predicates) : undefined)
    .orderBy(asc(orderInvoices.updatedAt), asc(orderInvoices.id))
    .limit(requestedLimit + 1);
  const orderIds = rows.map((row) => row.order.id);
  const itemRows = orderIds.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)).orderBy(asc(orderItems.createdAt)) : [];
  const byOrder = new Map<string, typeof itemRows>();
  for (const item of itemRows) byOrder.set(item.orderId, [...(byOrder.get(item.orderId) || []), item]);

  return page(rows.map(({ invoice, order }) => ({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    orderId: order.id,
    orderNumber: order.orderNumber,
    storeId: order.storeId,
    status: invoice.status,
    currency: order.currency,
    total: money(order.grandTotal, order.currency),
    issuedAt: invoice.invoiceDate.toISOString(),
    lines: (byOrder.get(order.id) || []).map((item) => ({
      lineId: item.id,
      productId: item.productId,
      variantId: item.variantId,
      sku: item.sku,
      productCode: item.productCode,
      productName: item.productName,
      variantTitle: item.variantTitle,
      quantity: item.quantity,
      unitPrice: money(item.unitPrice, order.currency),
      totalPrice: money(item.totalPrice, order.currency)
    })),
    sellerSnapshot: invoice.sellerSnapshot || {},
    buyerSnapshot: invoice.buyerSnapshot || {},
    totalsSnapshot: invoice.totalsSnapshot || {},
    updatedAt: invoice.updatedAt.toISOString()
  })), requestedLimit);
}

export async function enqueueAccountingPush(input: {
  context: IntegrationAuthContext;
  entityType: "products" | "inventory" | "orders" | "invoices" | "payments";
  eventType: string;
  storeId?: string | null;
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
}) {
  const items = Array.isArray(input.payload.items) ? input.payload.items as Array<Record<string, unknown>> : [];
  const payloadStoreIds = [...new Set(items.map((item) => typeof item.storeId === "string" ? item.storeId : "").filter(Boolean))];
  const explicitStoreId = input.storeId || (typeof input.payload.storeId === "string" ? input.payload.storeId : null) || (payloadStoreIds.length === 1 ? payloadStoreIds[0] : null) || (input.context.storeIds.length === 1 ? input.context.storeIds[0] : null);
  if (!explicitStoreId) throw new Error("يلزم إرسال storeId واحد لدفعة ERP الواردة");
  assertStoreAllowed(input.context, explicitStoreId);
  await assertAgentStoreEnabled(input.context, explicitStoreId);
  const dedupeKey = input.idempotencyKey || `${input.context.clientId}:${input.entityType}:${input.eventType}:${Date.now()}`;
  const [event] = await db
    .insert(integrationEvents)
    .values({
      provider: "accounting",
      direction: "inbound",
      eventType: input.eventType,
      entityType: input.entityType,
      storeId: explicitStoreId,
      payload: { ...input.payload, storeId: explicitStoreId, integrationClient: { id: input.context.clientId, source: input.context.source } },
      dedupeKey
    })
    .onConflictDoNothing()
    .returning();

  const [job] = await db
    .insert(backgroundJobs)
    .values({
      queue: "integrations",
      type: "integrations.accounting.sync",
      payload: { integrationEventId: event?.id || null, entityType: input.entityType, eventType: input.eventType, payload: input.payload },
      priority: 5,
      dedupeKey: `integration:${dedupeKey}`
    })
    .onConflictDoNothing()
    .returning({ id: backgroundJobs.id });

  await writeIntegrationAudit({
    context: input.context,
    action: `push.${input.entityType}`,
    entityType: input.entityType,
    entityId: event?.id || null,
    storeId: explicitStoreId,
    status: event || job ? "accepted" : "success",
    metadata: { eventId: event?.id || null, jobId: job?.id || null, dedupeKey, idempotentReplay: !event && !job }
  });
  return { eventId: event?.id || null, jobId: job?.id || null, dedupeKey, queued: Boolean(job || event), idempotentReplay: !event && !job };
}

export async function getIntegrationEventsForAccounting(context: IntegrationAuthContext, query: PullQuery & { status?: string | null }) {
  const requestedLimit = limit(query.limit);
  if (query.storeId) assertStoreAllowed(context, query.storeId);
  const since = dateFrom(query.cursor || query.since);
  const storeCondition = query.storeId ? eq(integrationEvents.storeId, query.storeId) : context.storeIds.length ? inArray(integrationEvents.storeId, context.storeIds) : undefined;
  const predicates = [
    eq(integrationEvents.provider, "accounting"),
    eq(integrationEvents.direction, "outbound"),
    query.status ? eq(integrationEvents.status, query.status) : undefined,
    storeCondition,
    since ? gte(integrationEvents.createdAt, since) : undefined
  ].filter(Boolean) as any[];
  const rows = await db.select().from(integrationEvents).where(predicates.length ? and(...predicates) : undefined).orderBy(desc(integrationEvents.createdAt)).limit(requestedLimit + 1);
  return page(rows.map((event) => ({
    id: event.id,
    provider: event.provider,
    direction: event.direction,
    eventType: event.eventType,
    entityType: event.entityType,
    entityId: event.entityId,
    storeId: event.storeId,
    status: event.status,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString()
  })), requestedLimit);
}
