export const branchRevenueModels = ["monthly_rent", "sales_commission", "hybrid"] as const;
export type BranchRevenueModel = (typeof branchRevenueModels)[number];

export function isBranchRevenueModel(value: string): value is BranchRevenueModel {
  return (branchRevenueModels as readonly string[]).includes(value);
}

/** A branch becomes financially active only after its signed addendum PDF is ready. */
export function canActivateBranchFinancialCycle(input: { branchStatus: string; addendumStatus: string; signedPdfReady: boolean }) {
  return input.branchStatus === "awaiting_addendum_signature" && input.addendumStatus === "signed" && input.signedPdfReady;
}

export function branchFinancialSource(mode: string) {
  return mode === "platform_revenue" ? "unified_platform_revenue" : "legacy_branch_invoice";
}
