import { describe, expect, it } from "vitest";
import { analyzeSmartQuery, mergeChatContext } from "@/lib/smart-search";

describe("smart search intent", () => {
  it("normalizes dialect and expands shoe synonyms", () => {
    const intent = analyzeSmartQuery("أبغى جزمة رياضيه سوداء أقل من 50 دولار");
    expect(intent.semanticLabels).toContain("أحذية");
    expect(intent.expandedTerms.join(" ")).toContain("جزمة");
    expect(intent.filters.colors).toContain("black");
    expect(intent.filters.maxPriceBase).toBe(26500);
  });

  it("keeps chat context and applies follow-up filters", () => {
    const previous = { query: "أريد حذاء رياضي", filters: {} };
    const next = mergeChatContext("بس يكون أسود", previous);
    expect(next.query).toContain("حذاء رياضي");
    expect(next.filters.colors).toContain("black");
  });

  it("detects sorting preferences", () => {
    const intent = analyzeSmartQuery("اعرض الأحذية الأرخص أولاً");
    expect(intent.filters.sort).toBe("price_asc");
  });
});
