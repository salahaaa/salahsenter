import { describe, expect, it } from "vitest";
import { assertNoNameOnlyMatching, mapExternalRow, validateMappingProfile } from "@/lib/integrations/erp/mapping";

describe("ERP mapping profiles", () => {
  it("maps external rows by configured fields and identity", () => {
    const mapping = validateMappingProfile({
      identity: { externalId: "ItemCode", externalCode: "ItemCode", barcode: "Barcode" },
      fields: { name: "ItemName", basePrice: "SalePrice", stockQuantity: "Qty" },
      transforms: { basePrice: { type: "number" }, stockQuantity: { type: "integer" } },
      matching: { strategy: "external_id_first", allowNameFallback: false }
    });
    const result = mapExternalRow({ ItemCode: "A-100", Barcode: "628", ItemName: "سكر", SalePrice: "1500", Qty: "7" }, mapping);
    expect(result.externalIdentity).toEqual(expect.objectContaining({ externalId: "A-100", barcode: "628" }));
    expect(result.basePrice).toBe(1500);
    expect(result.stockQuantity).toBe(7);
  });

  it("rejects name-only matching for accounting integrations", () => {
    const mapping = validateMappingProfile({ identity: { externalId: "ItemCode" }, fields: { name: "Name" }, matching: { strategy: "external_id_first", allowNameFallback: true } });
    expect(() => assertNoNameOnlyMatching(mapping)).toThrow(/Name fallback/);
  });
});
