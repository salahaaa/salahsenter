import { describe, expect, it } from "vitest";
import { calculateBundleRestoration, calculateBundleTotals } from "@/lib/offers/bundle-calculations";

describe("bundle offer calculations", () => {
  it("restores component quantities based on remaining bundle count", () => {
    const restored = calculateBundleRestoration([
      { productId: "rice", variantId: "rice-40kg", quantity: 1, title: "أرز أبيض 40kg" },
      { productId: "sugar", variantId: "sugar-5kg", quantity: 2, title: "سكر أبيض 5kg" },
      { productId: "oil", variantId: "oil-2l", quantity: 3, title: "زيت 2L" }
    ], 100);
    expect(restored).toEqual([
      expect.objectContaining({ variantId: "rice-40kg", restoreQuantity: 100 }),
      expect.objectContaining({ variantId: "sugar-5kg", restoreQuantity: 200 }),
      expect.objectContaining({ variantId: "oil-2l", restoreQuantity: 300 })
    ]);
  });

  it("calculates bundle totals using item quantities", () => {
    const totals = calculateBundleTotals([
      { productId: "rice", variantId: "rice", quantity: 2, originalPrice: 100, offerPrice: 90 },
      { productId: "oil", variantId: "oil", quantity: 3, originalPrice: 50, offerPrice: 40 }
    ]);
    expect(totals).toEqual({ original: 350, offer: 300, quantity: 5 });
  });
});
