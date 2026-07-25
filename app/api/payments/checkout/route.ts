export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { assertPublicCommerceOperationAllowed } from "@/lib/platform-operation-guard";
import { requireAuth } from "@/lib/auth";
import { db, orderPayments, orders, paymentMethods, users } from "@/lib/db";
import { createPaymentGatewaySession } from "@/lib/payments/gateway";

export async function POST(request: Request) {
  try {
    await assertPublicCommerceOperationAllowed("payment_initiation");
    const session = await requireAuth();
    const { orderId } = await request.json();
    if (!orderId) return fail("orderId مطلوب", 422);
    const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.customerId, session.userId))).limit(1);
    if (!order) return fail("الطلب غير موجود", 404);
    if (order.paymentStatus === "paid") return ok({ mode: "paid", message: "الطلب مدفوع بالفعل" });

    const [payment] = await db.select().from(orderPayments).where(eq(orderPayments.orderId, order.id)).limit(1);
    if (!payment?.paymentMethodId) return fail("لا توجد وسيلة دفع مرتبطة بهذا الطلب", 409);
    const [method] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, payment.paymentMethodId)).limit(1);
    if (!method || !method.isActive) return fail("وسيلة الدفع غير متاحة", 409);
    const [customer] = await db.select({ email: users.email }).from(users).where(eq(users.id, session.userId)).limit(1);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const result = await createPaymentGatewaySession({
      provider: method.provider,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: Number(order.grandTotal || 0),
      currency: order.currency,
      customerEmail: customer?.email || session.email,
      successUrl: `${appUrl}/orders/${order.id}?payment=success`,
      cancelUrl: `${appUrl}/checkout/payment/${order.id}?payment=cancelled`,
      config: method.config as Record<string, unknown>
    });

    await db.update(orderPayments).set({ transactionReference: result.reference || payment.transactionReference, providerResponse: result as any, updatedAt: new Date() }).where(eq(orderPayments.id, payment.id));
    return ok(result);
  } catch (error) {
    return handleApiError(error, "تعذر بدء الدفع");
  }
}
