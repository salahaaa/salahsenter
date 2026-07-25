export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasRole, hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, orderShipments, orders, users } from "@/lib/db";
import { userHasStoreOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { enqueueJob } from "@/lib/queue/enqueue";

const schema = z.object({ trackingNumber: z.string().optional().nullable(), carrierName: z.string().optional().nullable(), status: z.string().min(2).optional().default("pending"), metadata: z.record(z.unknown()).optional().default({}) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return fail("الطلب غير موجود", 404);
    if (!hasRole(session, "super_admin") && !hasStoreAccess(session, order.storeId)) return fail("لا تملك صلاحية هذا الطلب", 403);
    if (!hasRole(session, "super_admin") && !(await userHasStoreOperation(session.userId, order.storeId, "orders.shipment"))) return fail("لا تملك صلاحية إدارة الطلبات", 403);
    const [before] = await db.select().from(orderShipments).where(eq(orderShipments.orderId, id)).limit(1);
    let shipment;
    if (before) {
      [shipment] = await db.update(orderShipments).set({ trackingNumber: payload.trackingNumber || null, carrierName: payload.carrierName || null, status: payload.status, metadata: payload.metadata, shippedAt: payload.status === "shipped" ? new Date() : before.shippedAt, deliveredAt: payload.status === "delivered" ? new Date() : before.deliveredAt, updatedAt: new Date() }).where(eq(orderShipments.id, before.id)).returning();
    } else {
      [shipment] = await db.insert(orderShipments).values({ orderId: id, trackingNumber: payload.trackingNumber || null, carrierName: payload.carrierName || null, status: payload.status, metadata: payload.metadata, shippedAt: payload.status === "shipped" ? new Date() : null, deliveredAt: payload.status === "delivered" ? new Date() : null }).returning();
    }
    const [customer] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, order.customerId)).limit(1);
    if (customer?.phone && ["shipped", "delivered"].includes(payload.status)) {
      await enqueueJob(db, { type: "outbound.message", dedupeKey: `shipment:${order.id}:${payload.status}:sms`, payload: { channel: "sms", to: customer.phone, message: payload.status === "shipped" ? `تم شحن طلبك ${order.orderNumber}. رقم التتبع: ${payload.trackingNumber || "غير متوفر"}` : `تم تسليم طلبك ${order.orderNumber}. شكراً لتسوقك.` } });
    }
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "order_shipment", entityId: shipment.id, beforeData: before || null, afterData: shipment });
    return ok({ shipment, message: "تم تحديث بيانات الشحن" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث بيانات الشحن");
  }
}
