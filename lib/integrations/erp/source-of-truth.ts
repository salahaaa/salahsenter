export type SourceAuthority = "erp" | "platform" | "merchant";

/**
 * Approved operating policy. It is deliberately not merchant-configurable:
 * switching ERP mode changes only inventory and invoice authority after admin
 * certification; customer settlement remains merchant-direct while the
 * platform retains only its own billing records in all modes.
 */
export const ERP_SOURCE_OF_TRUTH_POLICY = {
  inventory: { standalone: "platform", erp: "erp" },
  invoice: { standalone: "platform", erp: "erp" },
  accountingRevenuePosting: { standalone: "platform", erp: "erp" },
  settlements: "merchant",
  price: "merchant",
  productData: "platform",
  bankAccounts: "platform",
  customers: "platform"
} as const;

export function sourceOfTruthForMode(mode: "ERP" | "STANDALONE") {
  return {
    inventory: ERP_SOURCE_OF_TRUTH_POLICY.inventory[mode === "ERP" ? "erp" : "standalone"],
    invoice: ERP_SOURCE_OF_TRUTH_POLICY.invoice[mode === "ERP" ? "erp" : "standalone"],
    accountingRevenuePosting: ERP_SOURCE_OF_TRUTH_POLICY.accountingRevenuePosting[mode === "ERP" ? "erp" : "standalone"],
    settlements: ERP_SOURCE_OF_TRUTH_POLICY.settlements,
    price: ERP_SOURCE_OF_TRUTH_POLICY.price,
    productData: ERP_SOURCE_OF_TRUTH_POLICY.productData,
    bankAccounts: ERP_SOURCE_OF_TRUTH_POLICY.bankAccounts,
    customers: ERP_SOURCE_OF_TRUTH_POLICY.customers
  } as const;
}

export function agentCapabilitiesForMode(mode: "ERP" | "STANDALONE") {
  return mode === "ERP"
    ? { inventoryPull: true, invoicePush: true, productMetadataPush: false, pricePush: false, customerPush: false, settlementPush: false }
    : { inventoryPull: false, invoicePush: false, productMetadataPush: false, pricePush: false, customerPush: false, settlementPush: false };
}
