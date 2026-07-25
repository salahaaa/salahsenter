import { describe, expect, it } from "vitest";
import { filterPlatformPermissionCodes, filterStorePermissionCodes, isPlatformPermission, isStorePermission } from "@/lib/permission-scopes";

describe("permission scope separation", () => {
  it("keeps store-bound permissions out of platform employee grants", () => {
    expect(isPlatformPermission("admin.access")).toBe(true);
    expect(isPlatformPermission("store_offers.manage")).toBe(false);
    expect(isPlatformPermission("store_finance.view")).toBe(false);
    expect(filterPlatformPermissionCodes(["admin.access", "products.manage", "store_returns.manage", "offers.manage"])).toEqual(["admin.access", "offers.manage"]);
  });

  it("only allows merchant employee permissions from the store-scoped allowlist", () => {
    expect(isStorePermission("merchant.access")).toBe(true);
    expect(isStorePermission("store_coupons.manage")).toBe(true);
    expect(isStorePermission("admin.access")).toBe(false);
    expect(filterStorePermissionCodes(["merchant.access", "admin.access", "store_coupons.manage", "unknown.manage"])).toEqual(["merchant.access", "store_coupons.manage"]);
  });
});
