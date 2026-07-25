import crypto from "crypto";
import { normalizePaymentConfig } from "@/lib/payments/methods";
import { createLocalGatewayPayment } from "@/lib/payments/local-gateway";

export type PaymentGatewayResult = { mode: "redirect"; url: string; reference: string } | { mode: "manual"; message: string; reference?: string; instructions?: ReturnType<typeof normalizePaymentConfig> };

const stripeSupportedCurrencies = new Set(["usd", "eur", "gbp", "sar", "aed"]);
const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export async function createPaymentGatewaySession(input: {
  provider: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  config?: Record<string, unknown> | null;
}): Promise<PaymentGatewayResult> {
  const provider = (input.provider || "manual").toLowerCase();
  if (provider === "local_gateway") {
    // Endpoint and credentials are server-only environment variables. `config`
    // remains limited to customer instructions and is never used for egress.
    const result = await createLocalGatewayPayment({ orderId: input.orderId, orderNumber: input.orderNumber, amount: input.amount, currency: input.currency, customerEmail: input.customerEmail, successUrl: input.successUrl, cancelUrl: input.cancelUrl });
    if (result.url) return { mode: "redirect", url: result.url, reference: result.reference };
    return { mode: "manual", message: "تم إنشاء عملية دفع لدى المزود المحلي، انتظر تأكيد الدفع.", reference: result.reference, instructions: normalizePaymentConfig(provider, input.config || {}) };
  }

  if (provider !== "stripe") {
    const instructions = normalizePaymentConfig(provider, input.config || {});
    const message = provider === "cod"
      ? "الدفع عند الاستلام. سيؤكد التاجر الطلب ثم يتم الدفع عند تسليم الشحنة."
      : "وسيلة دفع محلية/يدوية. اتبع التعليمات وارفع إثبات الدفع عند الحاجة.";
    return { mode: "manual", message, reference: `${provider || "manual"}-${input.orderId}`, instructions };
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("بوابة Stripe غير مهيأة: STRIPE_SECRET_KEY غير موجود");
  const currency = input.currency.toLowerCase();
  if (!stripeSupportedCurrencies.has(currency)) throw new Error(`عملة ${input.currency} غير مدعومة في Stripe. استخدم عملة مدعومة أو وسيلة دفع يدوية.`);

  const amount = Math.round(input.amount * 100);
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  body.set("client_reference_id", input.orderId);
  body.set("metadata[orderId]", input.orderId);
  body.set("metadata[orderNumber]", input.orderNumber);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", currency);
  body.set("line_items[0][price_data][unit_amount]", String(amount));
  body.set("line_items[0][price_data][product_data][name]", `Order ${input.orderNumber}`);
  if (input.customerEmail) body.set("customer_email", input.customerEmail);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const json = await response.json() as { id?: string; url?: string; error?: { message?: string } };
  if (!response.ok || !json.url || !json.id) throw new Error(json.error?.message || "تعذر إنشاء جلسة الدفع في Stripe");
  return { mode: "redirect", url: json.url, reference: json.id };
}

/**
 * Validates Stripe's signed raw payload and rejects stale signatures. Multiple
 * v1 entries are supported because Stripe can send a signature during key
 * rotation.
 */
export function verifyStripeSignature(input: { body: string; signature: string; secret: string; nowMs?: number; toleranceSeconds?: number }) {
  const parts = input.signature.split(",").map((part) => {
    const index = part.indexOf("=");
    return index > 0 ? [part.slice(0, index).trim(), part.slice(index + 1).trim()] as const : null;
  }).filter((item): item is readonly [string, string] => Boolean(item));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  const timestampSeconds = Number(timestamp);
  const nowMs = input.nowMs ?? Date.now();
  const toleranceSeconds = input.toleranceSeconds ?? STRIPE_SIGNATURE_TOLERANCE_SECONDS;
  if (!timestamp || !Number.isFinite(timestampSeconds) || !signatures.length) return false;
  if (Math.abs(Math.floor(nowMs / 1000) - timestampSeconds) > toleranceSeconds) return false;

  const signedPayload = `${timestamp}.${input.body}`;
  const expected = crypto.createHmac("sha256", input.secret).update(signedPayload).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return signatures.some((signature) => {
    try {
      const candidate = Buffer.from(signature, "hex");
      return candidate.length === expectedBuffer.length && crypto.timingSafeEqual(candidate, expectedBuffer);
    } catch {
      return false;
    }
  });
}

export const __paymentGatewayInternals = { STRIPE_SIGNATURE_TOLERANCE_SECONDS };
