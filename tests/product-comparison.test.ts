import { describe, expect, it } from "vitest";
import { buildComparisonRows } from "@/lib/discovery/product-comparison";

const base = {
  storeId: "store",
  storeSlug: "store",
  slug: "product",
  storeLogoUrl: null,
  imageUrl: null,
  minPrice: "100",
  maxPrice: "120",
  ratingAverage: "4.5",
  ratingCount: 12,
  inStock: true,
  href: "/product"
};

describe("structured product comparison", () => {
  it("merges merchant-defined specification keys into an explainable matrix", () => {
    const rows = buildComparisonRows([
      { ...base, id: "one", name: "هاتف أ", storeName: "متجر أ", categoryName: "هواتف", brand: "Brand", warranty: "سنة", originCountry: "كوريا", specifications: { "RAM": "8GB", "السعة": "256GB" } },
      { ...base, id: "two", name: "هاتف ب", storeName: "متجر ب", categoryName: "هواتف", brand: "Brand", warranty: null, originCountry: "الصين", specifications: { "RAM": "12GB", "الشاشة": "6.5 بوصة" } }
    ]);

    expect(rows.find((row) => row.key === "price")?.values.one).toBe("100 – 120");
    expect(rows.find((row) => row.key === "spec:ram")?.values).toEqual({ one: "8GB", two: "12GB" });
    expect(rows.find((row) => row.key === "spec:الشاشة")?.values.two).toBe("6.5 بوصة");
    expect(rows.find((row) => row.key === "warranty")?.values.two).toBe("—");
  });
});
