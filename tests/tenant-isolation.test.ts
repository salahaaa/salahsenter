import { describe, expect, it } from "vitest";
import { assertTenantStoreMembership, normalizeTenantHost } from "@/lib/tenancy/context";
import { tenantVerificationRecord } from "@/lib/tenancy/domain-verification";

const context = { tenant: { id: "tenant-a" }, storeIds: ["store-a", "store-b"] } as any;

describe("tenant host and store isolation", () => {
  it("normalizes trusted host input before resolving a tenant", () => {
    expect(normalizeTenantHost("HTTPS://Shop.Example.YE:443/path")).toBe("shop.example.ye");
    expect(tenantVerificationRecord("Shop.Example.YE")).toBe("_salah-tenant-verification.shop.example.ye");
  });

  it("allows only stores explicitly attached to the tenant", () => {
    expect(assertTenantStoreMembership(context, "store-a")).toBe(true);
    expect(() => assertTenantStoreMembership(context, "store-other")).toThrow("خارج نطاق tenant");
  });
});
