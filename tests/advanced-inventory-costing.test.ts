import { describe, expect, it } from "vitest";
import { calculateWeightedAverageCost, PRODUCT_OS_CAPABILITIES } from "@/lib/products/advanced-inventory";

describe("advanced inventory costing", () => {
  it("calculates weighted average cost after a receipt", () => {
    expect(calculateWeightedAverageCost({ previousQuantity: 10, previousAverageCost: 100, receivedQuantity: 5, unitCost: 160 })).toBe(120);
  });

  it("uses receipt cost for an empty stock balance", () => {
    expect(calculateWeightedAverageCost({ previousQuantity: 0, previousAverageCost: 0, receivedQuantity: 7, unitCost: 250 })).toBe(250);
  });

  it("keeps batches and expiry behind explicit sector capabilities", () => {
    expect(PRODUCT_OS_CAPABILITIES).toContain("inventory_batches");
    expect(PRODUCT_OS_CAPABILITIES).toContain("inventory_expiry");
  });
});
