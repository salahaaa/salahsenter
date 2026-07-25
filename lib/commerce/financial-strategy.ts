import { and, eq } from "drizzle-orm";
import { db, systemSettings } from "@/lib/db";
import { sourceOfTruthForMode } from "@/lib/integrations/erp/source-of-truth";

export type IntegrationMode = "ERP" | "STANDALONE";
export type ErpAccessState = "admin_enabled" | "disabled";

export type MerchantIntegrationSettings = {
  integrationEnabled: boolean;
  integrationMode: IntegrationMode;
  erpProvider: string;
  erpAccess: ErpAccessState;
  integrationClientKey: string | null;
  certificationId: string | null;
  inventoryAuthority: "erp" | "platform";
  invoiceAuthority: "erp" | "platform";
  accountingRevenueAuthority: "erp" | "platform";
  settlementAuthority: "platform" | "merchant";
  priceAuthority: "merchant";
  productDataAuthority: "platform";
  bankAccountsAuthority: "platform";
  customerDataAuthority: "platform";
  updatedAt?: string;
};

export const defaultMerchantIntegrationSettings: MerchantIntegrationSettings = {
  integrationEnabled: false,
  integrationMode: "STANDALONE",
  erpProvider: "none",
  erpAccess: "disabled",
  integrationClientKey: null,
  certificationId: null,
  inventoryAuthority: "platform",
  invoiceAuthority: "platform",
  accountingRevenueAuthority: "platform",
  settlementAuthority: "merchant",
  priceAuthority: "merchant",
  productDataAuthority: "platform",
  bankAccountsAuthority: "platform",
  customerDataAuthority: "platform"
};

/** Only an admin-created setting with a certified connector can resolve to ERP mode. */
export function normalizeIntegrationSettings(value: unknown): MerchantIntegrationSettings {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const requestedMode = raw.integrationMode === "ERP" ? "ERP" : "STANDALONE";
  const erpAccess = raw.erpAccess === "admin_enabled" ? "admin_enabled" : "disabled";
  const erpMode = Boolean(raw.integrationEnabled) && requestedMode === "ERP" && erpAccess === "admin_enabled" && typeof raw.integrationClientKey === "string" && Boolean(raw.integrationClientKey.trim());
  const mode: IntegrationMode = erpMode ? "ERP" : "STANDALONE";
  const policy = sourceOfTruthForMode(mode);
  return {
    integrationEnabled: erpMode,
    integrationMode: mode,
    erpProvider: typeof raw.erpProvider === "string" && raw.erpProvider.trim() ? raw.erpProvider.trim() : erpMode ? "generic" : "none",
    erpAccess: erpMode ? "admin_enabled" : "disabled",
    integrationClientKey: erpMode ? String(raw.integrationClientKey) : null,
    certificationId: erpMode && typeof raw.certificationId === "string" ? raw.certificationId : null,
    inventoryAuthority: policy.inventory,
    invoiceAuthority: policy.invoice,
    accountingRevenueAuthority: policy.accountingRevenuePosting,
    settlementAuthority: policy.settlements,
    priceAuthority: policy.price,
    productDataAuthority: policy.productData,
    bankAccountsAuthority: policy.bankAccounts,
    customerDataAuthority: policy.customers,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined
  };
}

export async function getMerchantIntegrationSettings(storeId: string): Promise<MerchantIntegrationSettings> {
  const [setting] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(and(eq(systemSettings.group, `store:${storeId}`), eq(systemSettings.key, "integration_settings")))
    .limit(1);
  return normalizeIntegrationSettings(setting?.value || defaultMerchantIntegrationSettings);
}

export function isErpMode(settings: MerchantIntegrationSettings) {
  return settings.integrationEnabled && settings.integrationMode === "ERP" && settings.erpAccess === "admin_enabled";
}
