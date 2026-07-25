import { pickPaymentInstructionConfig } from "@/lib/payments/config";

export type LocalPaymentProvider = "manual" | "cod" | "bank_transfer" | "wallet" | "remittance" | "local_gateway" | "stripe";

export const LOCAL_PAYMENT_PROVIDERS: Array<{ code: LocalPaymentProvider; label: string; market: string; requiresProof: boolean; description: string }> = [
  { code: "manual", label: "دفع يدوي / تحويل", market: "عام", requiresProof: true, description: "تعليمات دفع يدوية يكتبها التاجر." },
  { code: "cod", label: "الدفع عند الاستلام COD", market: "اليمن والخليج", requiresProof: false, description: "يدفع العميل عند تسليم الشحنة." },
  { code: "bank_transfer", label: "تحويل بنكي", market: "الخليج واليمن", requiresProof: true, description: "حساب بنكي/IBAN مع رفع إيصال." },
  { code: "wallet", label: "محفظة إلكترونية", market: "اليمن والخليج", requiresProof: true, description: "محافظ محلية مثل جوالي/كاش/إلكترونية." },
  { code: "remittance", label: "حوالة مالية / صرافة", market: "اليمن", requiresProof: true, description: "حوالة عبر شركة صرافة مع رقم الحوالة." },
  { code: "local_gateway", label: "بوابة دفع محلية API", market: "اليمن/الخليج", requiresProof: false, description: "تكامل API مُدار من إعدادات الخادم فقط." },
  { code: "stripe", label: "Stripe Cards", market: "دولي", requiresProof: false, description: "بوابة دفع إلكترونية بالبطاقات." }
];

export type PaymentInstructions = {
  provider: string;
  label: string;
  requiresProof: boolean;
  instructions: string;
  fields: Record<string, string>;
};

export function providerLabel(provider?: string | null) {
  return LOCAL_PAYMENT_PROVIDERS.find((item) => item.code === provider)?.label || provider || "دفع يدوي";
}

export function requiresPaymentProof(provider?: string | null, config?: Record<string, unknown> | null) {
  const safeConfig = pickPaymentInstructionConfig(config);
  if (typeof safeConfig.requiresProof === "boolean") return safeConfig.requiresProof;
  return LOCAL_PAYMENT_PROVIDERS.find((item) => item.code === provider)?.requiresProof ?? true;
}

/**
 * Creates the only payment configuration that may ever be returned to a
 * browser. Legacy config objects are allow-listed before scalar values are
 * exposed, so credentials/endpoints cannot leak through checkout responses.
 */
export function normalizePaymentConfig(provider: string, config: Record<string, unknown> = {}): PaymentInstructions {
  const safeConfig = pickPaymentInstructionConfig(config);
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(safeConfig)) {
    if (value == null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") fields[key] = String(value);
  }
  const label = providerLabel(provider);
  const instructions = String(safeConfig.instructions || buildDefaultInstructions(provider, fields));
  return { provider, label, requiresProof: requiresPaymentProof(provider, safeConfig), instructions, fields };
}

function buildDefaultInstructions(provider: string, fields: Record<string, string>) {
  if (provider === "cod") return "سيتم الدفع عند استلام الطلب. يرجى تجهيز المبلغ عند التسليم.";
  if (provider === "bank_transfer") return `حوّل المبلغ إلى الحساب البنكي ثم ارفع إيصال التحويل. ${fields.bankName ? `البنك: ${fields.bankName}.` : ""} ${fields.accountNumber ? `رقم الحساب: ${fields.accountNumber}.` : ""} ${fields.iban ? `IBAN: ${fields.iban}.` : ""}`;
  if (provider === "wallet") return `حوّل المبلغ إلى المحفظة الإلكترونية ثم ارفع الإيصال. ${fields.walletName ? `المحفظة: ${fields.walletName}.` : ""} ${fields.walletNumber ? `الرقم: ${fields.walletNumber}.` : ""}`;
  if (provider === "remittance") return `أرسل حوالة مالية ثم ارفع رقم الحوالة/الإيصال. ${fields.exchangeCompany ? `الشركة: ${fields.exchangeCompany}.` : ""} ${fields.recipientName ? `المستلم: ${fields.recipientName}.` : ""} ${fields.recipientPhone ? `هاتف المستلم: ${fields.recipientPhone}.` : ""}`;
  if (provider === "local_gateway") return "سيتم تحويلك إلى بوابة الدفع المحلية لإكمال العملية، ثم يعود النظام لتأكيد الدفع تلقائياً عند وصول webhook موثّق.";
  if (provider === "stripe") return "سيتم تحويلك لبوابة الدفع الإلكترونية لإكمال الدفع بأمان.";
  return fields.instructions || "اتبع تعليمات الدفع من المتجر ثم ارفع إثبات الدفع إن طُلب منك.";
}
