import { asc, desc, eq } from "drizzle-orm";
import { hasRole, hasStoreAccess, type SessionPayload } from "@/lib/auth";
import { db, orderDisputeMessages, orderDisputes, orderInvoices, orderItems, orderPayments, orders, orderShipments, orderStatusHistory, paymentReceipts, returnRequestItems, returnRequests, stores, users } from "@/lib/db";

export async function getOrderDetails(orderId: string, session: SessionPayload) {
  const [row] = await db
    .select({ order: orders, store: stores, customer: users })
    .from(orders)
    .innerJoin(stores, eq(orders.storeId, stores.id))
    .innerJoin(users, eq(orders.customerId, users.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) return null;
  const canAccess = hasRole(session, "super_admin") || row.order.customerId === session.userId || hasStoreAccess(session, row.order.storeId);
  if (!canAccess) return null;

  const [items, invoices, payments, shipments, history, disputes, returns, receipts] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, row.order.id)).orderBy(asc(orderItems.createdAt)),
    db.select().from(orderInvoices).where(eq(orderInvoices.orderId, row.order.id)).limit(1),
    db.select().from(orderPayments).where(eq(orderPayments.orderId, row.order.id)),
    db.select().from(orderShipments).where(eq(orderShipments.orderId, row.order.id)),
    db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, row.order.id)).orderBy(asc(orderStatusHistory.createdAt)),
    db.select().from(orderDisputes).where(eq(orderDisputes.orderId, row.order.id)).orderBy(desc(orderDisputes.createdAt)),
    db.select().from(returnRequests).where(eq(returnRequests.orderId, row.order.id)).orderBy(desc(returnRequests.createdAt)),
    db.select().from(paymentReceipts).where(eq(paymentReceipts.orderId, row.order.id)).orderBy(desc(paymentReceipts.createdAt))
  ]);

  const disputeMessages = disputes.length
    ? await db.select().from(orderDisputeMessages).where(eq(orderDisputeMessages.disputeId, disputes[0].id)).orderBy(asc(orderDisputeMessages.createdAt))
    : [];

  const returnItems = returns.length
    ? await db.select().from(returnRequestItems).where(eq(returnRequestItems.returnRequestId, returns[0].id)).orderBy(asc(returnRequestItems.createdAt))
    : [];

  return { ...row, items, invoice: invoices[0] || null, payments, shipments, paymentReceipts: receipts, history, disputes, disputeMessages, returns, returnItems };
}

export function canOpenDispute(statusCode: string) {
  return ["delivered", "closed"].includes(statusCode);
}

export const orderStatusLabels: Record<string, string> = {
  new: "جديد",
  confirmed: "مؤكد",
  preparing: "قيد التجهيز",
  ready_to_ship: "جاهز للشحن",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  closed: "مغلق",
  cancelled: "ملغي"
};
