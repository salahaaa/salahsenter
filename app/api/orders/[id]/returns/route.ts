export const dynamic = "force-dynamic";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, notifications, orderItems, orders, returnRequestItems, returnRequests } from "@/lib/db";
import { canOpenDispute } from "@/lib/order-details";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  reason: z.string().min(2),
  description: z.string().optional(),
  items: z.array(z.object({ orderItemId: z.string().uuid(), quantity: z.coerce.number().int().positive(), reason: z.string().optional(), condition: z.string().optional() })).min(1)
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return fail("الطلب غير موجود", 404);
    if (order.customerId !== session.userId && !hasStoreAccess(session, order.storeId)) return fail("لا تملك صلاحية هذا الطلب", 403);
    const requests = await db.select().from(returnRequests).where(eq(returnRequests.orderId, id));
    return ok({ returnRequests: requests });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل طلبات الإرجاع");
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return fail("الطلب غير موجود", 404);
    if (order.customerId !== session.userId) return fail("لا يمكنك فتح إرجاع لهذا الطلب", 403);
    if (!canOpenDispute(order.statusCode)) return fail("يمكن طلب الإرجاع بعد التسليم أو الإغلاق فقط", 409);

    const orderItemIds = payload.items.map((item) => item.orderItemId);
    const itemRows = await db.select().from(orderItems).where(and(eq(orderItems.orderId, order.id), inArray(orderItems.id, orderItemIds)));
    if (itemRows.length !== orderItemIds.length) return fail("بعض عناصر الإرجاع غير صحيحة", 422);
    for (const item of payload.items) {
      const row = itemRows.find((r) => r.id === item.orderItemId)!;
      if (item.quantity > row.quantity) return fail(`كمية الإرجاع أكبر من كمية المنتج: ${row.productName}`, 422);
    }
    const refundAmount = payload.items.reduce((sum, item) => {
      const row = itemRows.find((r) => r.id === item.orderItemId)!;
      return sum + Number(row.unitPrice || 0) * item.quantity;
    }, 0);

    const result = await db.transaction(async (tx) => {
      const [returnRequest] = await tx.insert(returnRequests).values({ orderId: order.id, customerId: session.userId, storeId: order.storeId, reason: payload.reason, description: payload.description, refundAmount: refundAmount.toString(), status: "requested" }).returning();
      await tx.insert(returnRequestItems).values(payload.items.map((item) => ({ returnRequestId: returnRequest.id, orderItemId: item.orderItemId, quantity: item.quantity, reason: item.reason, condition: item.condition })));
      return { returnRequest };
    });

    await db.insert(notifications).values({ userId: null, storeId: order.storeId, title: "طلب إرجاع جديد", body: `تم فتح طلب إرجاع للطلب ${order.orderNumber}`, type: "return_requested", data: { orderId: order.id, returnRequestId: result.returnRequest.id, url: `/merchant/orders/${order.id}` } });
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "return_request", entityId: result.returnRequest.id, afterData: result });
    return created({ ...result, message: "تم إرسال طلب الإرجاع للتاجر" });
  } catch (error) {
    return handleApiError(error, "تعذر إرسال طلب الإرجاع");
  }
}
