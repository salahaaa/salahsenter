import { describe, expect, it } from "vitest";
import { ERP_REQUIRED_CONTRACT_METHODS, erpInventoryUpdateSchema, erpOrderCommandSchema } from "@/lib/integrations/erp/connector-contract";
import { validateMappingProfile } from "@/lib/integrations/erp/mapping";

describe("ERP executable connector contract", () => {
  it("requires the core execution methods instead of adapter metadata only", () => {
    expect(ERP_REQUIRED_CONTRACT_METHODS).toEqual(expect.arrayContaining(["createOrder", "createInvoice", "syncInventory", "fetchWarehouses", "fetchBranches", "fetchPriceLists"]));
  });

  it("validates operational ERP payloads", () => {
    expect(erpInventoryUpdateSchema.parse({ storeId: "11111111-1111-4111-8111-111111111111", externalProductId: "ITEM-01", quantityOnHand: 12, availableQuantity: 10, updatedAt: "2026-07-13T00:00:00.000Z" }).quantityOnHand).toBe(12);
    expect(erpOrderCommandSchema.parse({ orderId: "11111111-1111-4111-8111-111111111111", orderNumber: "ORD-1", storeId: "22222222-2222-4222-8222-222222222222", lines: [{ productId: "33333333-3333-4333-8333-333333333333", variantId: "44444444-4444-4444-8444-444444444444", quantity: 1, unitPrice: 100 }] }).lines).toHaveLength(1);
  });

  it("keeps typed operational mappings inside a mapping profile", () => {
    const mapping = validateMappingProfile({ identity: { externalId: "ItemCode" }, fields: {}, matching: { strategy: "external_id_first", allowNameFallback: false }, operational: { warehouses: { MAIN: "warehouse-1" }, branches: {}, customers: {}, payments: {}, priceLists: {} } });
    expect(mapping.operational.warehouses.MAIN).toBe("warehouse-1");
  });
});
