/**
 * Order Service
 * =============
 * Order reads/writes with role-aware scoping. Customers see only their own
 * orders; merchants/employees see only their store's; admins see all.
 * Detail access uses `requireOrderAccess` so IDOR is impossible.
 */

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, orders } from "@/lib/db";
import { parseListQuery } from "@/lib/api-list-utils";
import { hasRole, type SessionPayload } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { requireOrderAccess } from "@/lib/authorization";

export interface OrderListItem {
  id: string;
  orderNumber: string;
  customerId: string;
  storeId: string;
  statusCode: string;
  paymentStatus: string;
  currency: string;
  subtotal: string;
  shippingFee: string;
  discountTotal: string;
  grandTotal: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Build the role-aware scope condition for the current session. */
async function scopeForSession(session: SessionPayload): Promise<{ where?: SQL; empty: boolean }> {
  if (hasRole(session, "super_admin")) return { where: undefined, empty: false };
  if (hasRole(session, ["merchant", "store_employee"])) {
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return { where: undefined, empty: true };
    return { where: eq(orders.storeId, store.id), empty: false };
  }
  return { where: eq(orders.customerId, session.userId), empty: false };
}

export async function listOrders(
  request: Request,
  session: SessionPayload,
  opts: { q?: string; status?: string; paymentStatus?: string } = {}
) {
  const { page, pageSize, offset, q } = parseListQuery(request, { defaultPageSize: 20 });
  const scope = await scopeForSession(session);
  if (scope.empty) return { items: [], page, pageSize, totalCount: 0, hasNext: false };

  const conditions: SQL[] = [];
  if (scope.where) conditions.push(scope.where);
  const term = opts.q ?? q;
  if (term) conditions.push(or(ilike(orders.orderNumber, `%${term}%`)) as SQL);
  const status = opts.status ?? new URL(request.url).searchParams.get("status");
  if (status) conditions.push(eq(orders.statusCode, status as any));
  const paymentStatus = opts.paymentStatus ?? new URL(request.url).searchParams.get("paymentStatus");
  if (paymentStatus) conditions.push(eq(orders.paymentStatus, paymentStatus as any));
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ count: totalCount }]] = await Promise.all([
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerId: orders.customerId,
        storeId: orders.storeId,
        statusCode: orders.statusCode,
        paymentStatus: orders.paymentStatus,
        currency: orders.currency,
        subtotal: orders.subtotal,
        shippingFee: orders.shippingFee,
        discountTotal: orders.discountTotal,
        grandTotal: orders.grandTotal,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt
      })
      .from(orders)
      .where(where ?? sql`true`)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(orders).where(where ?? sql`true`)
  ]);

  return { items: rows as OrderListItem[], page, pageSize, totalCount, hasNext: offset + rows.length < totalCount };
}

/** Fetch order detail with enforced role-scoped access. */
export async function getOrderDetail(orderId: string, session: SessionPayload) {
  const access = await requireOrderAccess(orderId);
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  return { order, role: access.role, session };
}
