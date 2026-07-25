import { describe, expect, it } from "vitest";
import {
  calculateRentalEntitlements,
  evaluateRentalResourceLimit
} from "@/lib/rentals/entitlements";

const planLimits = {
  maxProducts: 10,
  maxEmployees: 2,
  maxBranches: 1,
  maxAnnouncements: 3,
  maxNews: 4
};

describe("rental entitlement calculation", () => {
  it("merges additive capacity add-ons by their assigned quantity", () => {
    const entitlements = calculateRentalEntitlements({
      hasAgreement: true,
      agreementStatus: "active",
      planLimits,
      planFeatures: ["basic_reports"],
      addons: [
        {
          entitlementKey: "extra_branches",
          quantity: 2,
          metadata: { limitKey: "maxBranches", limitIncrease: 3, features: ["branch_dashboard"] }
        },
        {
          entitlementKey: "advanced_reports",
          quantity: 1,
          metadata: { features: ["custom_exports"] }
        }
      ]
    });

    expect(entitlements.limits?.maxBranches).toBe(7);
    expect(entitlements.features).toEqual(expect.arrayContaining(["basic_reports", "advanced_reports", "branch_dashboard", "custom_exports"]));
    expect(entitlements.addons).toEqual(expect.arrayContaining(["extra_branches", "advanced_reports"]));
  });

  it("supports the entitlement-key shorthand and unlimited capacity", () => {
    const entitlements = calculateRentalEntitlements({
      hasAgreement: true,
      agreementStatus: "grace",
      planLimits,
      addons: [
        { entitlementKey: "maxEmployees", quantity: 2, metadata: { limitIncrease: 4 } },
        { entitlementKey: "maxProducts", metadata: { unlimited: true } }
      ]
    });

    expect(entitlements.limits?.maxEmployees).toBe(10);
    expect(entitlements.limits?.maxProducts).toBeNull();
    expect(entitlements.resourceCreationAllowed).toBe(true);
  });

  it("keeps legacy stores operational without inventing a hard cap", () => {
    const entitlements = calculateRentalEntitlements({ hasAgreement: false });
    const result = evaluateRentalResourceLimit({ entitlements, resource: "products", currentCount: 50_000 });

    expect(entitlements.source).toBe("legacy");
    expect(entitlements.limits).toBeNull();
    expect(result.allowed).toBe(true);
  });

  it("rejects an expansion at the exact plan limit and frozen agreements", () => {
    const active = calculateRentalEntitlements({ hasAgreement: true, agreementStatus: "active", planLimits });
    const reached = evaluateRentalResourceLimit({ entitlements: active, resource: "employees", currentCount: 2 });
    expect(reached).toMatchObject({ allowed: false, reason: "limit_reached", limit: 2 });

    const frozen = calculateRentalEntitlements({ hasAgreement: true, agreementStatus: "frozen", planLimits });
    const blocked = evaluateRentalResourceLimit({ entitlements: frozen, resource: "products", currentCount: 0 });
    expect(blocked).toMatchObject({ allowed: false, reason: "agreement_inactive" });
  });
});
