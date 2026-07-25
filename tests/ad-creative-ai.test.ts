import { describe, expect, it } from "vitest";
import { suggestAdBanner } from "@/lib/ai/ad-banner-suggester";

describe("AI-assisted ad creative studio", () => {
  it("returns three mobile-aware creative concepts with safe image prompts", () => {
    const suggestion = suggestAdBanner({
      storeName: "متجر اليمن",
      campaignType: "homepage_banner",
      productNames: ["قهوة يمنية"],
      objective: "زيادة الطلبات",
      offerText: "خصم 20%",
      audience: "عشاق القهوة",
      tone: "seasonal"
    });

    expect(suggestion.creativeConcepts.map((concept) => concept.id)).toEqual(["product_hero", "offer_focus", "trust_story"]);
    expect(suggestion.creativeConcepts.every((concept) => concept.visualPrompt.includes("1200×400") && concept.mobileSafeArea.length > 10)).toBe(true);
    expect(suggestion.imageGenerationPrompt).not.toContain("data:image");
    expect(suggestion.reviewChecklist.length).toBeGreaterThan(3);
  });
});
