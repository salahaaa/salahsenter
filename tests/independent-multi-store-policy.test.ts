import { describe, expect, it } from "vitest";
import { documentPlanForIndependentStore, independentStoreEligibility, isIndependentStoreApplication } from "@/lib/merchant/independent-store-policy";

describe("independent multi-store activity policy", () => {
  it("requires an existing merchant store and approved identity before an independent activity", () => {
    expect(independentStoreEligibility({ hasExistingStore: false, hasApprovedIdentity: true })).toEqual({ allowed: false, reason: "first_store_required" });
    expect(independentStoreEligibility({ hasExistingStore: true, hasApprovedIdentity: false })).toEqual({ allowed: false, reason: "approved_identity_required" });
    expect(independentStoreEligibility({ hasExistingStore: true, hasApprovedIdentity: true })).toEqual({ allowed: true, reason: null });
    expect(isIndependentStoreApplication("independent_store")).toBe(true);
  });

  it("reuses the approved identity but requires business documents for the new activity", () => {
    const plan = documentPlanForIndependentStore("application-1");
    expect(plan).toEqual(expect.arrayContaining([
      expect.objectContaining({ documentType: "identity", isRequired: false, status: "waived" }),
      expect.objectContaining({ documentType: "commercial_register", isRequired: true, status: "requested" }),
      expect.objectContaining({ documentType: "tax_card", isRequired: true, status: "requested" })
    ]));
  });
});
