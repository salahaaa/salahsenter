import { describe, expect, it } from "vitest";
import { hasMerchantAccess, hasStoreAccess, type SessionPayload } from "@/lib/auth";
import { assertMerchant } from "@/lib/rbac";
import {
  STAGING_TEST_TEAM_ACCOUNT_KEYS,
  STAGING_TEST_TEAM_PROFILES,
  validateStagingTestTeamProfiles
} from "@/lib/qa/staging-test-team";

describe("parallel Staging test team policy", () => {
  it("keeps a complete named team with no shared super-admin profile", () => {
    expect(validateStagingTestTeamProfiles()).toBe(true);
    expect(STAGING_TEST_TEAM_PROFILES).toHaveLength(STAGING_TEST_TEAM_ACCOUNT_KEYS.length);
    expect(new Set(STAGING_TEST_TEAM_PROFILES.map((profile) => profile.key)).size).toBe(STAGING_TEST_TEAM_ACCOUNT_KEYS.length);
    expect(STAGING_TEST_TEAM_PROFILES.some((profile) => profile.kind === "platform_employee" && profile.permissionCodes.includes("super_admin"))).toBe(false);
  });

  it("keeps the finance profile read-only for the merchant_collects customer-money model", () => {
    const finance = STAGING_TEST_TEAM_PROFILES.find((profile) => profile.key === "platformFinance");
    expect(finance?.permissionCodes).toContain("finance.reports.view");
    expect(finance?.permissionCodes).not.toContain("finance.settlements.manage");
    expect(finance?.permissionCodes).not.toContain("finance.withdrawals.manage");
    expect(finance?.permissionCodes).not.toContain("platform_revenue.statements.issue");
    expect(finance?.permissionCodes).not.toContain("platform_revenue.statements.settle");
  });

  it("makes customer profiles permissionless and gives each merchant side two separate stores", () => {
    const customers = STAGING_TEST_TEAM_PROFILES.filter((profile) => profile.kind === "customer");
    expect(customers).toHaveLength(3);
    expect(customers.every((profile) => profile.permissionCodes.length === 0)).toBe(true);

    const storeSlots = STAGING_TEST_TEAM_PROFILES
      .filter((profile) => profile.kind === "merchant_owner" || profile.kind === "store_employee")
      .map((profile) => profile.storeSlot);
    expect(storeSlots.filter((slot) => slot === 1)).toHaveLength(3);
    expect(storeSlots.filter((slot) => slot === 2)).toHaveLength(3);
  });
});

describe("custom store employee role compatibility", () => {
  const customStoreEmployee: SessionPayload = {
    userId: "qa-store-worker",
    email: "worker@staging.invalid",
    fullName: "QA Store Worker",
    roles: [{ code: "qa_staging_store_employee_catalog", scope: "store", storeId: "store-one" }]
  };

  it("recognizes a bound custom store role without requiring the broad legacy store_employee role", () => {
    expect(hasMerchantAccess(customStoreEmployee)).toBe(true);
    expect(hasStoreAccess(customStoreEmployee, "store-one")).toBe(true);
    expect(hasStoreAccess(customStoreEmployee, "store-two")).toBe(false);
    expect(() => assertMerchant(customStoreEmployee)).not.toThrow();
  });

  it("does not treat a system role or an unbound store role as merchant access", () => {
    const platformOnly: SessionPayload = { ...customStoreEmployee, roles: [{ code: "qa_staging_platform_operations", scope: "system", storeId: null }] };
    const unboundStoreRole: SessionPayload = { ...customStoreEmployee, roles: [{ code: "broken-store-role", scope: "store", storeId: null }] };
    expect(hasMerchantAccess(platformOnly)).toBe(false);
    expect(hasMerchantAccess(unboundStoreRole)).toBe(false);
    expect(() => assertMerchant(platformOnly)).toThrow();
  });
});
