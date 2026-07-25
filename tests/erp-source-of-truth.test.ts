import { describe, expect, it } from "vitest";
import { createFinancialServices } from "@/lib/commerce/financial-services";
import { normalizeIntegrationSettings } from "@/lib/commerce/financial-strategy";
import { sourceOfTruthForMode } from "@/lib/integrations/erp/source-of-truth";

describe("ERP source-of-truth policy", () => {
  it("keeps customer settlement merchant-direct and merchant pricing in both modes", () => {
    expect(sourceOfTruthForMode("STANDALONE")).toMatchObject({ inventory: "platform", invoice: "platform", accountingRevenuePosting: "platform", settlements: "merchant", price: "merchant", productData: "platform", bankAccounts: "platform", customers: "platform" });
    expect(sourceOfTruthForMode("ERP")).toMatchObject({ inventory: "erp", invoice: "erp", accountingRevenuePosting: "erp", settlements: "merchant", price: "merchant", productData: "platform", bankAccounts: "platform", customers: "platform" });
  });

  it("does not accept merchant-requested ERP mode without an admin connector grant", () => {
    const settings = normalizeIntegrationSettings({ integrationEnabled: true, integrationMode: "ERP", erpProvider: "generic" });
    expect(settings).toMatchObject({ integrationEnabled: false, integrationMode: "STANDALONE", erpAccess: "disabled", accountingRevenueAuthority: "platform", settlementAuthority: "merchant" });
  });

  it("uses ERP only for invoice and inventory while default customer money remains merchant-direct", () => {
    const settings = normalizeIntegrationSettings({ integrationEnabled: true, integrationMode: "ERP", erpAccess: "admin_enabled", integrationClientKey: "certified-agent", erpProvider: "accounting" });
    const services = createFinancialServices(settings);
    expect(services.mode).toBe("ERP");
    expect(services.invoice.mode).toBe("ERP");
    expect(services.inventory.mode).toBe("ERP");
    expect(services.revenue.mode).toBe("STANDALONE");
  });
});
