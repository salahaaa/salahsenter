import { refundLocalGatewayPayment } from "@/lib/payments/local-gateway";

type RefundInput = {
  provider: string;
  orderId: string;
  amount: number;
  currency: string;
  reason?: string;
  transactionReference?: string | null;
  providerResponse?: Record<string, any> | null;
};

export async function executePaymentRefund(input: RefundInput): Promise<{ status: string; providerReference?: string | null; providerResponse: Record<string, unknown> }> {
  const provider = (input.provider || "manual").toLowerCase();
  if (["manual", "cod", "bank_transfer", "wallet", "remittance"].includes(provider)) {
    return { status: "pending_manual", providerReference: input.transactionReference || null, providerResponse: { message: "يتطلب الاسترداد معالجة يدوية حسب وسيلة الدفع المحلية" } };
  }
  if (provider === "local_gateway") {
    const result = await refundLocalGatewayPayment({ reference: input.transactionReference, orderId: input.orderId, amount: input.amount, currency: input.currency, reason: input.reason });
    return { status: result.status, providerReference: result.reference, providerResponse: result.raw };
  }
  if (provider === "stripe") {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new Error("STRIPE_SECRET_KEY غير مضبوط");
    const paymentIntent = input.providerResponse?.payment_intent || input.providerResponse?.paymentIntent || input.providerResponse?.id;
    if (!paymentIntent) return { status: "pending_manual", providerReference: input.transactionReference || null, providerResponse: { message: "لا يوجد payment_intent محفوظ للاسترداد الآلي" } };
    const body = new URLSearchParams();
    body.set("payment_intent", String(paymentIntent));
    body.set("amount", String(Math.round(input.amount * 100)));
    if (input.reason) body.set("metadata[reason]", input.reason);
    body.set("metadata[orderId]", input.orderId);
    const response = await fetch("https://api.stripe.com/v1/refunds", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
    const json = await response.json() as Record<string, any>;
    if (!response.ok) throw new Error(json.error?.message || "فشل الاسترداد عبر Stripe");
    return { status: json.status === "succeeded" ? "succeeded" : "pending", providerReference: json.id, providerResponse: json };
  }
  return { status: "unsupported", providerReference: input.transactionReference || null, providerResponse: { message: `مزود غير مدعوم للاسترداد: ${provider}` } };
}
