export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, notifications, orderPayments, orders, paymentMethods, paymentReceipts } from "@/lib/db";
import { requiresPaymentProof } from "@/lib/payments/methods";
import { writeAuditLog } from "@/lib/audit";
import { enqueueJob } from "@/lib/queue/enqueue";

const proofSchema = z.object({
  orderId: z.string().uuid(),
  transactionReference: z.string().optional(),
  senderName: z.string().optional(),
  senderPhone: z.string().optional(),
  amount: z.coerce.number().min(0).optional(),
  proofUrl: z.string().optional(),
  note: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = proofSchema.parse(await request.json());
    const [order] = await db.select().from(orders).where(and(eq(orders.id, payload.orderId), eq(orders.customerId, session.userId))).limit(1);
    if (!order) return fail("الطلب غير موجود", 404);
    if (order.paymentStatus === "paid") return fail("الطلب مدفوع بالفعل", 409);
    const [payment] = await db.select().from(orderPayments).where(eq(orderPayments.orderId, order.id)).limit(1);
    if (!payment?.paymentMethodId) return fail("لا توجد وسيلة دفع مرتبطة", 409);
    const [method] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, payment.paymentMethodId)).limit(1);
    if (!method) return fail("وسيلة الدفع غير موجودة", 404);
    if (requiresPaymentProof(method.provider, method.config as Record<string, unknown>) && !payload.proofUrl && !payload.transactionReference) return fail("أدخل رقم العملية أو ارفع إثبات الدفع", 422);

    const [receipt] = await db.insert(paymentReceipts).values({
      orderId: order.id,
      orderPaymentId: payment.id,
      userId: session.userId,
      storeId: order.storeId,
      provider: method.provider,
      transactionReference: payload.transactionReference,
      senderName: payload.senderName,
      senderPhone: payload.senderPhone,
      amount: (payload.amount ?? Number(order.grandTotal || 0)).toString(),
      currency: order.currency,
      proofUrl: payload.proofUrl,
      note: payload.note,
      status: "pending"
    }).returning();

    await db.insert(notifications).values({ userId: null, storeId: order.storeId, title: "إثبات دفع جديد", body: `تم رفع إثبات دفع للطلب ${order.orderNumber}`, type: "payment_receipt_submitted", data: { orderId: order.id, paymentReceiptId: receipt.id, url: `/merchant/orders/${order.id}` } });
    if (payload.senderPhone) {
      await enqueueJob(db, { type: "outbound.message", dedupeKey: `payment-proof:${receipt.id}:sms`, payload: { channel: "sms", to: payload.senderPhone, message: `تم استلام إثبات الدفع للطلب ${order.orderNumber} وهو قيد مراجعة التاجر.` } });
    }
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "payment_receipt", entityId: receipt.id, afterData: receipt });
    return created({ receipt, message: "تم إرسال إثبات الدفع للتاجر" });
  } catch (error) {
    return handleApiError(error, "تعذر إرسال إثبات الدفع");
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const orderId = new URL(request.url).searchParams.get("orderId") || "";
    if (!orderId) return ok({ receipts: [] });
    const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.customerId, session.userId))).limit(1);
    if (!order) return fail("الطلب غير موجود", 404);
    const receipts = await db.select().from(paymentReceipts).where(eq(paymentReceipts.orderId, order.id));
    return ok({ receipts });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل إثباتات الدفع");
  }
}
