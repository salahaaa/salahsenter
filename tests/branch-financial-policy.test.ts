import { describe, expect, it } from "vitest";
import { branchFinancialSource, canActivateBranchFinancialCycle, isBranchRevenueModel } from "@/lib/branches/financial-policy";

describe("branch financial cycle policy", () => {
  it("requires a signed PDF-backed addendum before the branch financial cycle can activate", () => {
    expect(canActivateBranchFinancialCycle({ branchStatus: "awaiting_addendum_signature", addendumStatus: "signed", signedPdfReady: true })).toBe(true);
    expect(canActivateBranchFinancialCycle({ branchStatus: "awaiting_addendum_signature", addendumStatus: "signed", signedPdfReady: false })).toBe(false);
    expect(canActivateBranchFinancialCycle({ branchStatus: "approved", addendumStatus: "signed", signedPdfReady: true })).toBe(false);
  });

  it("recognizes platform revenue models separately from legacy branch invoices", () => {
    expect(isBranchRevenueModel("hybrid")).toBe(true);
    expect(isBranchRevenueModel("legacy_branch_invoice")).toBe(false);
    expect(branchFinancialSource("platform_revenue")).toBe("unified_platform_revenue");
    expect(branchFinancialSource("legacy_branch_invoice")).toBe("legacy_branch_invoice");
  });
});
