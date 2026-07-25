import { describe, expect, it } from "vitest";
import { ADMIN_OPERATION_PERMISSIONS, STORE_OPERATION_PERMISSIONS } from "@/lib/rbac";

describe("operation-level permission policies", () => {
  it("maps admin high-risk actions to a granular capability with a legacy fallback", () => {
    expect(ADMIN_OPERATION_PERMISSIONS["ads.approve"]).toEqual(["ads.approve", "ads.manage"]);
    expect(ADMIN_OPERATION_PERMISSIONS["stores.suspend"]).toEqual(["stores.suspend", "stores.manage"]);
    expect(ADMIN_OPERATION_PERMISSIONS["finance.withdrawals.manage"]).toContain("finance.withdrawals.manage");
    expect(ADMIN_OPERATION_PERMISSIONS["system.erp.manage"]).toContain("system.erp.manage");
  });

  it("keeps sensitive store operations in one-store permission candidates", () => {
    expect(STORE_OPERATION_PERMISSIONS["products.export"]).toContain("store.products.export");
    expect(STORE_OPERATION_PERMISSIONS["inventory.stock_count"]).toContain("store.inventory.stock_count");
    expect(STORE_OPERATION_PERMISSIONS["orders.shipment"]).toContain("store.orders.shipment.manage");
    expect(STORE_OPERATION_PERMISSIONS["orders.payment"]).toContain("store.orders.payment.manage");
    expect(STORE_OPERATION_PERMISSIONS["finance.withdrawals"]).toContain("store.finance.withdrawals.manage");
  });
});
