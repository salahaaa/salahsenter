export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, notifications, orderPayments, orders, paymentReceipts } from "@/lib/db";
import { userHasStoreOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { enqueueJob } from "@/lib/queue/enqueue";
import { finalizePaidDeliveredStandaloneOrder } from "@/lib/commerce/order-inventory-completion";

const schema = z.object({ status: z.enum(["approved", "rejected"]), note: z.string().optional() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const [before] = await db.select().from(paymentReceipts).where(eq(paymentReceipts.id, id)).limit(1);
    if (!before) return fail("إثبات الدفع غير موجود", 404);
    if (!before.storeId || !hasStoreAccess(session, before.storeId)) return fail("لا تملك صلاحية المتجر", 403);
    if (!(await userHasStoreOperation(session.userId, before.storeId, "orders.payment"))) return fail("لا تملك صلاحية إدارة المدفوعات", 403);

    const result = await db.transaction(async (tx) => {
      const [receipt] = await tx.update(paymentReceipts).set({ status: payload.status, note: payload.note || before.note, reviewedBy: session.userId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(paymentReceipts.id, id)).returning();
      if (payload.status === "approved") {
        await tx.update(orderPayments).set({ status: "paid", transactionReference: before.transactionReference || undefined, providerResponse: { receiptId: id, approvedBy: session.userId, note: payload.note }, paidAt: new Date(), updatedAt: new Date() }).where(eq(orderPayments.id, before.orderPaymentId || ""));
        await tx.update(orders).set({ paymentStatus: "paid", updatedAt: new Date() }).where(eq(orders.id, before.orderId));
        await finalizePaidDeliveredStandaloneOrder(tx, { orderId: before.orderId, actorId: session.userId });
      } else {
        await tx.update(orderPayments).set({ status: "failed", providerResponse: { receiptId: id, rejectedBy: session.userId, note: payload.note }, updatedAt: new Date() }).where(eq(orderPayments.id, before.orderPaymentId || ""));
        await tx.update(orders).set({ paymentStatus: "failed", updatedAt: new Date() }).where(eq(orders.id, before.orderId));
      }
      return { receipt };
    });

    await db.insert(notifications).values({ userId: before.userId, storeId: before.storeId, title: payload.status === "approved" ? "تم قبول إثبات الدفع" : "تم رفض إثبات الدفع", body: payload.note || null, type: "payment_receipt_reviewed", data: { orderId: before.orderId, receiptId: id, status: payload.status, url: `/orders/${before.orderId}` } });
    if (before.senderPhone) {
      await enqueueJob(db, { type: "outbound.message", dedupeKey: `payment-proof-reviewed:${id}:sms`, payload: { channel: "sms", to: before.senderPhone, message: payload.status === "approved" ? "تم قبول إثبات الدفع وتأكيد الطلب." : `تم رفض إثبات الدفع. ${payload.note || "يرجى مراجعة بيانات التحويل."}` } });
    }
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "payment_receipt", entityId: id, beforeData: before, afterData: result });
    return ok({ ...result, message: payload.status === "approved" ? "تم تأكيد الدفع" : "تم رفض إثبات الدفع" });
  } catch (error) {
    return handleApiError(error, "تعذر مراجعة إثبات الدفع");
  }
}
