import { describe, expect, it } from "vitest";
import { catalogPermissionCodes, isCatalogPermissionForDomain } from "@/lib/permissions/catalog";
import { EMPLOYEE_ACCOUNT_STATUSES, isEmployeeAccountStatus, mustRevokeEmployeeSessions, normalizePermissionOverrides, normalizeUsername, resolveEffectivePermission } from "@/lib/employees/policy";

describe("employee account lifecycle", () => {
  it("uses exactly ACTIVE, SUSPENDED and INACTIVE as employee-facing states", () => {
    expect(EMPLOYEE_ACCOUNT_STATUSES).toEqual(["active", "suspended", "inactive"]);
    expect(isEmployeeAccountStatus("active")).toBe(true);
    expect(isEmployeeAccountStatus("pending")).toBe(false);
    expect(mustRevokeEmployeeSessions("active")).toBe(false);
    expect(mustRevokeEmployeeSessions("suspended")).toBe(true);
    expect(mustRevokeEmployeeSessions("inactive")).toBe(true);
  });

  it("normalizes the account username safely", () => {
    expect(normalizeUsername("  Sale.Agent_01 ")).toBe("sale.agent_01");
  });
});

describe("grant/deny permission overrides", () => {
  it("gives an explicit deny precedence over a role permission", () => {
    expect(resolveEffectivePermission({ inherited: true, override: "deny" })).toBe(false);
    expect(resolveEffectivePermission({ inherited: false, override: "grant" })).toBe(true);
    expect(resolveEffectivePermission({ inherited: true, override: undefined })).toBe(true);
    expect(resolveEffectivePermission({ inherited: false, override: undefined })).toBe(false);
  });

  it("drops inherited state and deduplicates direct overrides", () => {
    expect(normalizePermissionOverrides([
      { code: "ads.view", effect: "grant" },
      { code: "ads.view", effect: "deny" },
      { code: "stores.view", effect: "inherit" }
    ])).toEqual([{ code: "ads.view", effect: "deny" }]);
  });
});

describe("granular permission catalogue", () => {
  it("keeps platform and merchant permissions separate", () => {
    expect(isCatalogPermissionForDomain("ads.approve", "platform")).toBe(true);
    expect(isCatalogPermissionForDomain("ads.approve", "store")).toBe(false);
    expect(isCatalogPermissionForDomain("store.orders.status.change", "store")).toBe(true);
    expect(isCatalogPermissionForDomain("store.orders.status.change", "platform")).toBe(false);
    expect(catalogPermissionCodes("platform")).toContain("employees.permissions.manage");
    expect(catalogPermissionCodes("store")).toContain("store.employees.permissions.manage");
  });
});
