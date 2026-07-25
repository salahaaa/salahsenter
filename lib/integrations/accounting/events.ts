import crypto from "node:crypto";
import { db, backgroundJobs, integrationEvents } from "@/lib/db";

export type AccountingIntegrationEventType =
  | "product.created"
  | "product.updated"
  | "inventory.updated"
  | "price.updated"
  | "order.created"
  | "order.updated"
  | "invoice.issued"
  | "invoice.cancelled"
  | "payment.updated"
  | "return.created"
  | "return.updated";

export type AccountingIntegrationEventInput = {
  eventType: AccountingIntegrationEventType;
  entityType: "product" | "inventory" | "order" | "invoice" | "payment" | "return";
  entityId?: string | null;
  storeId?: string | null;
  payload: Record<string, unknown>;
  dedupeKey?: string;
};

export async function enqueueAccountingIntegrationEvent(input: AccountingIntegrationEventInput) {
  const dedupeKey = input.dedupeKey || `accounting:${input.eventType}:${input.entityId || crypto.randomUUID()}`;
  const [event] = await db
    .insert(integrationEvents)
    .values({
      provider: "accounting",
      direction: "outbound",
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId || null,
      storeId: input.storeId || null,
      payload: input.payload,
      dedupeKey
    })
    .onConflictDoNothing()
    .returning();

  const [job] = await db
    .insert(backgroundJobs)
    .values({
      queue: "integrations",
      type: "integrations.accounting.dispatch",
      payload: { integrationEventId: event?.id || null, eventType: input.eventType, entityType: input.entityType, entityId: input.entityId || null },
      priority: 3,
      dedupeKey: `dispatch:${dedupeKey}`
    })
    .onConflictDoNothing()
    .returning({ id: backgroundJobs.id });

  return { eventId: event?.id || null, jobId: job?.id || null, dedupeKey };
}

/**
 * Hook facade for future direct domain usage. Domain transactions should call this
 * after their own DB write succeeds, never expose DB-to-DB access to local ERP/POS.
 */
export const accountingIntegrationHooks = {
  productUpdated: (payload: { productId: string; storeId: string; snapshot: Record<string, unknown> }) =>
    enqueueAccountingIntegrationEvent({ eventType: "product.updated", entityType: "product", entityId: payload.productId, storeId: payload.storeId, payload: payload.snapshot }),
  inventoryUpdated: (payload: { variantId: string; productId: string; storeId: string; snapshot: Record<string, unknown> }) =>
    enqueueAccountingIntegrationEvent({ eventType: "inventory.updated", entityType: "inventory", entityId: payload.variantId, storeId: payload.storeId, payload: payload.snapshot }),
  orderCreated: (payload: { orderId: string; storeId: string; snapshot: Record<string, unknown> }) =>
    enqueueAccountingIntegrationEvent({ eventType: "order.created", entityType: "order", entityId: payload.orderId, storeId: payload.storeId, payload: payload.snapshot }),
  invoiceIssued: (payload: { invoiceId: string; orderId: string; storeId: string; snapshot: Record<string, unknown> }) =>
    enqueueAccountingIntegrationEvent({ eventType: "invoice.issued", entityType: "invoice", entityId: payload.invoiceId, storeId: payload.storeId, payload: { ...payload.snapshot, orderId: payload.orderId } })
};
