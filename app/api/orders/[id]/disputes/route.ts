export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, notifications, orderDisputeMessages, orderDisputes, orders } from "@/lib/db";
import { canOpenDispute } from "@/lib/order-details";
import { writeAuditLog } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";

const schema = z.object({ reason: z.string().min(2).max(120), description: z.string().min(10).max(2000) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return fail("الطلب غير موجود", 404);
    if (order.customerId !== session.userId) return fail("يمكن للعميل صاحب الطلب فقط فتح نزاع", 403);
    if (!canOpenDispute(order.statusCode)) return fail("يمكن فتح نزاع بعد التسليم أو الإغلاق فقط", 409);

    const result = await db.transaction(async (tx) => {
      const [dispute] = await tx.insert(orderDisputes).values({ orderId: order.id, customerId: session.userId, storeId: order.storeId, reason: payload.reason, description: payload.description }).returning();
      await tx.insert(orderDisputeMessages).values({ disputeId: dispute.id, actorId: session.userId, message: payload.description });
      return dispute;
    });

    await db.insert(notifications).values({ userId: null, storeId: order.storeId, title: "تم فتح نزاع على طلب", body: `العميل فتح نزاعاً على الطلب ${order.orderNumber}`, type: "order_dispute_opened", data: { orderId: order.id, disputeId: result.id } });
    await notifyAdmins({ title: "نزاع جديد على طلب", body: `تم فتح نزاع على الطلب ${order.orderNumber}`, type: "admin_order_dispute_opened", data: { orderId: order.id, disputeId: result.id } });
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "order_dispute", entityId: result.id, afterData: result });
    return created({ dispute: result, message: "تم فتح النزاع بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر فتح النزاع");
  }
}
