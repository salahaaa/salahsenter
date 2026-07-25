export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, notifications, orderPayments, orders, paymentMethods, paymentRefunds, returnRequests } from "@/lib/db";
import { userHasStoreOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { recordRefundLedger } from "@/lib/finance/settlements";
import { executePaymentRefund } from "@/lib/payments/refunds";

const schema = z.object({ status: z.enum(["requested", "approved", "rejected", "received", "refunded", "closed"]), resolution: z.string().optional(), refundAmount: z.coerce.number().min(0).optional() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const [before] = await db.select().from(returnRequests).where(eq(returnRequests.id, id)).limit(1);
    if (!before) return fail("طلب الإرجاع غير موجود", 404);
    if (!hasStoreAccess(session, before.storeId)) return fail("لا تملك صلاحية هذا المتجر", 403);
    if (!(await userHasStoreOperation(session.userId, before.storeId, "orders.returns"))) return fail("لا تملك صلاحية إدارة الطلبات", 403);

    let refundExecution: Awaited<ReturnType<typeof executePaymentRefund>> | null = null;
    let refundPayment: typeof orderPayments.$inferSelect | null = null;
    let refundProvider: typeof paymentMethods.$inferSelect | null = null;
    const [refundOrder] = await db.select({ currency: orders.currency }).from(orders).where(eq(orders.id, before.orderId)).limit(1);
    const refundAmount = payload.refundAmount ?? Number(before.refundAmount || 0);
    const refundCurrency = refundOrder?.currency || "YER";
    if (payload.status === "refunded") {
      [refundPayment] = await db.select().from(orderPayments).where(eq(orderPayments.orderId, before.orderId)).limit(1);
      if (refundPayment?.paymentMethodId) [refundProvider] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, refundPayment.paymentMethodId)).limit(1);
      refundExecution = await executePaymentRefund({
        provider: refundProvider?.provider || "manual",
        orderId: before.orderId,
        amount: refundAmount,
        currency: refundCurrency,
        reason: payload.resolution || `Return refund ${id}`,
        transactionReference: refundPayment?.transactionReference,
        providerResponse: (refundPayment?.providerResponse || {}) as Record<string, any>
      });
    }

    const result = await db.transaction(async (tx) => {
      const [returnRequest] = await tx.update(returnRequests).set({
        status: payload.status,
        resolution: payload.resolution ?? before.resolution,
        refundAmount: payload.refundAmount !== undefined ? payload.refundAmount.toString() : before.refundAmount,
        reviewedBy: session.userId,
        reviewedAt: ["approved", "rejected"].includes(payload.status) ? new Date() : before.reviewedAt,
        receivedAt: payload.status === "received" ? new Date() : before.receivedAt,
        refundedAt: payload.status === "refunded" ? new Date() : before.refundedAt,
        updatedAt: new Date()
      }).where(eq(returnRequests.id, id)).returning();

      if (payload.status === "refunded") {
        const finalRefundStatus = refundExecution?.status || "pending_manual";
        const paymentStatus = finalRefundStatus === "succeeded" || finalRefundStatus === "pending_manual" ? "refunded" : "pending";
        await tx.insert(paymentRefunds).values({
          orderId: before.orderId,
          orderPaymentId: refundPayment?.id || null,
          returnRequestId: id,
          provider: refundProvider?.provider || "manual",
          amount: refundAmount.toString(),
          currency: refundCurrency,
          status: finalRefundStatus,
          providerReference: refundExecution?.providerReference || null,
          providerResponse: refundExecution?.providerResponse || {},
          reason: payload.resolution || `Return refund ${id}`,
          requestedBy: session.userId,
          processedAt: finalRefundStatus === "succeeded" || finalRefundStatus === "pending_manual" ? new Date() : null
        });
        await tx.update(orderPayments).set({ status: paymentStatus, updatedAt: new Date(), providerResponse: { returnRequestId: id, refund: refundExecution } }).where(eq(orderPayments.orderId, before.orderId));
        await tx.update(orders).set({ paymentStatus, updatedAt: new Date() }).where(eq(orders.id, before.orderId));
        if (paymentStatus === "refunded") await recordRefundLedger(tx, { orderId: before.orderId, amount: refundAmount, reason: `Return refund ${id}` });
      }
      return { returnRequest };
    });

    await db.insert(notifications).values({ userId: before.customerId, storeId: before.storeId, title: "تم تحديث طلب الإرجاع", body: `الحالة الجديدة: ${payload.status}`, type: "return_status_updated", data: { returnRequestId: id, orderId: before.orderId, status: payload.status, url: `/orders/${before.orderId}` } });
    await writeAuditLog({ actorId: session.userId, action: "update", category: "administrative", entityType: "return_request", entityId: id, beforeData: before, afterData: result });
    if (payload.status === "refunded") {
      await writeAuditLog({ actorId: session.userId, action: "create", category: "financial", entityType: "financial.refund_processed", entityId: id, afterData: { orderId: before.orderId, amount: refundAmount, currency: refundCurrency, execution: refundExecution } });
    }
    return ok({ ...result, message: "تم تحديث طلب الإرجاع" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث طلب الإرجاع");
  }
}
