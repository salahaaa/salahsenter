import { z } from "zod";

/**
 * Fields that are safe to persist as customer-facing payment instructions.
 * Gateway credentials, endpoint URLs and arbitrary headers are deliberately
 * excluded: they belong in server-only environment variables.
 */
export const paymentInstructionConfigSchema = z
  .object({
    accountName: z.string().trim().max(180).optional(),
    bankName: z.string().trim().max(180).optional(),
    accountNumber: z.string().trim().max(180).optional(),
    iban: z.string().trim().max(80).optional(),
    walletName: z.string().trim().max(180).optional(),
    walletNumber: z.string().trim().max(180).optional(),
    exchangeCompany: z.string().trim().max(180).optional(),
    recipientName: z.string().trim().max(180).optional(),
    recipientPhone: z.string().trim().max(60).optional(),
    instructions: z.string().trim().max(2_000).optional(),
    requiresProof: z.boolean().optional()
  })
  .strict();

export type PaymentInstructionConfig = z.infer<typeof paymentInstructionConfigSchema>;

const safeInstructionKeys = new Set<keyof PaymentInstructionConfig>([
  "accountName",
  "bankName",
  "accountNumber",
  "iban",
  "walletName",
  "walletNumber",
  "exchangeCompany",
  "recipientName",
  "recipientPhone",
  "instructions",
  "requiresProof"
]);

/**
 * Extracts only allow-listed customer payment instruction fields. This is
 * intentionally forgiving for legacy database rows so a previously stored
 * secret can never escape through a response while the data-cleanup migration
 * is being rolled out.
 */
export function pickPaymentInstructionConfig(value: unknown): PaymentInstructionConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  for (const key of safeInstructionKeys) {
    const item = raw[key];
    if (typeof item === "string" || typeof item === "boolean") safe[key] = item;
  }
  return paymentInstructionConfigSchema.parse(safe);
}

/** Strict API parser: no arbitrary config keys are accepted on new writes. */
export function parsePaymentInstructionConfig(value: unknown): PaymentInstructionConfig {
  return paymentInstructionConfigSchema.parse(value ?? {});
}

type PaymentMethodClientShape = {
  id: string;
  storeId: string | null;
  financialProviderId?: string | null;
  merchantFinancialAccountId?: string | null;
  name: string;
  code: string;
  description: string | null;
  provider: string;
  isActive: boolean;
  sortOrder: number;
};

/**
 * Deliberately omits `config` and all credential-bearing internals. Use this
 * for every route or server-component prop that crosses into a browser.
 */
export function toPaymentMethodClientDto(method: PaymentMethodClientShape) {
  return {
    id: method.id,
    storeId: method.storeId,
    financialProviderId: method.financialProviderId || null,
    name: method.name,
    code: method.code,
    description: method.description,
    provider: method.provider,
    isActive: method.isActive,
    sortOrder: method.sortOrder
  };
}

type FinancialAccountClientShape = {
  id: string;
  storeId: string;
  merchantId: string;
  financialProviderId: string;
  accountNumber?: string | null;
  walletNumber?: string | null;
  beneficiaryName?: string | null;
  iban?: string | null;
  branchName?: string | null;
  status: string;
};

/** Account metadata may be returned to its owner, but never the JSON config. */
export function toMerchantFinancialAccountClientDto(account: FinancialAccountClientShape) {
  return {
    id: account.id,
    storeId: account.storeId,
    merchantId: account.merchantId,
    financialProviderId: account.financialProviderId,
    accountNumber: account.accountNumber || null,
    walletNumber: account.walletNumber || null,
    beneficiaryName: account.beneficiaryName || null,
    iban: account.iban || null,
    branchName: account.branchName || null,
    status: account.status
  };
}
