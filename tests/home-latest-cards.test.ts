import { describe, expect, it } from "vitest";
import { buildLatestHomeCards } from "@/lib/home/latest-cards";

const productFallbackImages = ["/electronics.jpg", "/fashion.jpg", "/computers.jpg"];
const fallbackWings = [
  { id: "w1", slug: "fashion", name: "الأزياء" },
  { id: "w2", slug: "electronics", name: "الإلكترونيات" },
  { id: "w3", slug: "computers", name: "الكمبيوترات" },
  { id: "w4", slug: "perfumes", name: "العطور" }
];

describe("homepage latest cards fallback", () => {
  it("uses the fallback wings once when the database has no published products", () => {
    const cards = buildLatestHomeCards({ latestAdditions: [], trendingProducts: [] }, fallbackWings, productFallbackImages);

    expect(cards).toEqual(fallbackWings);
    expect(new Set(cards.map((card) => card.id || card.slug)).size).toBe(cards.length);
  });

  it("keeps real product cards ahead of the wing fallback", () => {
    const cards = buildLatestHomeCards({
      latestAdditions: [{ id: "p1", name: "منتج فعلي", slug: "real-product", storeSlug: "real-store", mainImageUrl: "/product.jpg" }]
    }, fallbackWings, productFallbackImages);

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ id: "p1", kind: "product", name: "منتج فعلي" });
  });
});
