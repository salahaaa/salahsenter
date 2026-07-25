import { describe, expect, it } from "vitest";
import { buildImportRepairPlan } from "@/lib/ai/import-repair";

describe("AI import repair plan", () => {
  it("creates suggestions without mutating preview rows or inventing a price", () => {
    const rows = [{ sourceRow: 7, name: "قميص أسود مقاس M", basePrice: null, stockQuantity: 4, description: "قميص أسود" }];
    const before = JSON.parse(JSON.stringify(rows));
    const plan = buildImportRepairPlan({ rows, storeId: "store-1", storeNumber: "YTC-001" });

    expect(rows).toEqual(before);
    expect(plan.summary).toEqual({ rows: 1, valid: 0, invalid: 1 });
    expect(plan.repairs[0]).toMatchObject({ sourceRow: 7, issues: ["سعر البيع مفقود أو غير صالح"] });
    expect(plan.repairs[0]?.fixes).toMatchObject({ sku: expect.any(String), internalBarcode: expect.stringMatching(/^YTC/) });
    expect(plan.repairs[0]?.fixes).not.toHaveProperty("price");
  });

  it("caps a review plan at one thousand rows", () => {
    const rows = Array.from({ length: 1_001 }, (_, index) => ({ name: `منتج ${index + 1}`, basePrice: 100, stockQuantity: 0 }));
    const plan = buildImportRepairPlan({ rows, storeId: "store-1", storeNumber: "YTC-001" });

    expect(plan.summary).toEqual({ rows: 1_000, valid: 1_000, invalid: 0 });
    expect(plan.repairs.at(-1)?.sourceRow).toBe(1_000);
  });
});
