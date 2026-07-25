import { and, asc, eq } from "drizzle-orm";
import { db, financialProviders } from "@/lib/db";

export const financialProviderTypes = ["bank", "wallet", "gateway", "hawala", "cod"] as const;
export const financialProviderStatuses = ["active", "disabled", "restricted", "blocked", "maintenance"] as const;

export function isProviderUsableForMerchants(provider: typeof financialProviders.$inferSelect | null | undefined) {
  return Boolean(provider && provider.status === "active" && provider.isEnabled && provider.isVisibleToMerchants);
}

export async function getVisibleFinancialProviders(options: { type?: string | null; customerPaymentsOnly?: boolean } = {}) {
  const conditions = [eq(financialProviders.status, "active"), eq(financialProviders.isEnabled, true), eq(financialProviders.isVisibleToMerchants, true)];
  if (options.type) conditions.push(eq(financialProviders.type, options.type));
  if (options.customerPaymentsOnly) conditions.push(eq(financialProviders.supportsDeposits, true));
  return db.select().from(financialProviders).where(and(...conditions)).orderBy(asc(financialProviders.sortOrder), asc(financialProviders.name));
}

export async function assertMerchantProviderAllowed(providerId: string) {
  const [provider] = await db.select().from(financialProviders).where(eq(financialProviders.id, providerId)).limit(1);
  if (!provider) throw new Error("مزود الدفع غير موجود");
  if (!isProviderUsableForMerchants(provider)) throw new Error("مزود الدفع غير مفعل أو غير مسموح للتجار");
  return provider;
}

export function providerPaymentCode(provider: typeof financialProviders.$inferSelect) {
  if (provider.type === "cod") return "cod";
  if (provider.type === "bank") return "bank_transfer";
  if (provider.type === "wallet") return "wallet";
  if (provider.type === "hawala") return "remittance";
  if (provider.type === "gateway") return "local_gateway";
  return provider.type;
}
