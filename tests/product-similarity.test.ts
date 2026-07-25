import { describe, expect, it } from "vitest";
import { normalizeProductText, productTokens, scoreProductSimilarity } from "@/lib/discovery/product-similarity";

const reference = {
  id: "reference",
  storeId: "store-a",
  name: "هاتف سامسونج جالاكسي A55",
  brand: "Samsung",
  categoryName: "هواتف",
  barcode: "880000000001",
  inStock: true
};

describe("explainable product similarity", () => {
  it("normalizes Arabic variants before building product tokens", () => {
    expect(normalizeProductText("هاتف أَبيض ـ جَديد")).toBe("هاتف ابيض جديد");
    expect(productTokens("هاتف أَبيض جديد")).toContain("هاتف");
  });

  it("treats a shared barcode as an exact cross-store match", () => {
    const match = scoreProductSimilarity(reference, { ...reference, id: "candidate", storeId: "store-b", name: "Samsung A55", barcode: "880000000001" });
    expect(match).toMatchObject({ score: 100, confidence: "exact" });
    expect(match.reasons).toContain("نفس الباركود");
  });

  it("distinguishes a strong name-and-brand match from a broad category alternative", () => {
    const strong = scoreProductSimilarity(reference, { ...reference, id: "strong", storeId: "store-b", barcode: null, name: "هاتف سامسونج جالاكسي A55", brand: "Samsung" });
    const broad = scoreProductSimilarity(reference, { id: "broad", storeId: "store-c", name: "هاتف ذكي اقتصادي", brand: "Other", categoryName: "هواتف", barcode: null, inStock: true });

    expect(strong.confidence).toBe("exact");
    expect(broad.score).toBeLessThan(strong.score);
    expect(["similar", "weak"]).toContain(broad.confidence);
  });
});
