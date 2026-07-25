type LocalGatewayServerConfig = {
  createPaymentUrl: string;
  refundUrl?: string;
  apiKey?: string;
  authorizationHeader: string;
  merchantId?: string;
};

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.APP_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function requireGatewayUrl(value: string | undefined, name: string) {
  if (!value) throw new Error(`بوابة الدفع المحلية غير مهيأة: ${name} غير موجود`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`بوابة الدفع المحلية غير مهيأة: ${name} يجب أن يكون رابطاً صحيحاً`);
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error(`${name} يجب أن يستخدم HTTP أو HTTPS`);
  if (isProductionRuntime() && url.protocol !== "https:") throw new Error(`${name} يجب أن يستخدم HTTPS في الإنتاج`);
  return url.toString();
}

/**
 * Gateway credentials and endpoints are intentionally read only from server
 * environment variables. They must never be stored in database payment JSON
 * because that object is used by UI/API flows.
 */
export function getLocalGatewayServerConfig(): LocalGatewayServerConfig {
  return {
    createPaymentUrl: requireGatewayUrl(process.env.LOCAL_GATEWAY_API_URL, "LOCAL_GATEWAY_API_URL"),
    refundUrl: process.env.LOCAL_GATEWAY_REFUND_URL ? requireGatewayUrl(process.env.LOCAL_GATEWAY_REFUND_URL, "LOCAL_GATEWAY_REFUND_URL") : undefined,
    apiKey: process.env.PAYMENT_PROVIDER_API_KEY || undefined,
    authorizationHeader: process.env.LOCAL_GATEWAY_AUTHORIZATION_HEADER || "Authorization",
    merchantId: process.env.LOCAL_GATEWAY_MERCHANT_ID || undefined
  };
}

function headers(config: LocalGatewayServerConfig) {
  return {
    "Content-Type": "application/json",
    ...(config.apiKey ? { [config.authorizationHeader]: config.authorizationHeader.toLowerCase() === "authorization" ? `Bearer ${config.apiKey}` : config.apiKey } : {})
  };
}

function safeRedirectUrl(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (isProductionRuntime() && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

export async function createLocalGatewayPayment(input: {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
}) {
  const config = getLocalGatewayServerConfig();
  const response = await fetch(config.createPaymentUrl, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({
      merchantId: config.merchantId,
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      amount: input.amount,
      currency: input.currency,
      customerEmail: input.customerEmail,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl
    }),
    redirect: "error",
    signal: AbortSignal.timeout(15_000)
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(json.message || json.error || "فشل إنشاء عملية الدفع لدى المزود المحلي"));
  return {
    reference: String(json.reference || json.transactionId || json.id || input.orderId),
    url: safeRedirectUrl(json.redirectUrl || json.paymentUrl || json.url),
    raw: json
  };
}

export async function refundLocalGatewayPayment(input: { reference?: string | null; orderId: string; amount: number; currency: string; reason?: string }) {
  const config = getLocalGatewayServerConfig();
  if (!config.refundUrl) return { status: "pending_manual" as const, reference: input.reference || null, raw: { message: "لا يوجد LOCAL_GATEWAY_REFUND_URL، يحتاج الاسترداد معالجة يدوية" } };
  const response = await fetch(config.refundUrl, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({ merchantId: config.merchantId, reference: input.reference, orderId: input.orderId, amount: input.amount, currency: input.currency, reason: input.reason }),
    redirect: "error",
    signal: AbortSignal.timeout(15_000)
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(json.message || json.error || "فشل تنفيذ الاسترداد لدى المزود المحلي"));
  return { status: "succeeded" as const, reference: String(json.reference || json.refundId || json.id || input.reference || ""), raw: json };
}
