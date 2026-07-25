import { describe, expect, it } from "vitest";
import { activityTemplates, recommendedActivityTemplateKeys } from "@/lib/merchant/activity-templates";
import { starterProductCommerceTypeAt, templatesForStoreActivity } from "@/lib/merchant/activity-template-policy";

describe("merchant activity templates", () => {
  it("covers core retail verticals with unique, non-empty taxonomy plans", () => {
    const keys = activityTemplates.map((template) => template.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const template of activityTemplates) {
      expect(template.categories.length).toBeGreaterThan(0);
      expect(template.units.length).toBeGreaterThan(0);
      expect(template.attributes.length).toBeGreaterThan(0);
    }
    expect(keys).toEqual(expect.arrayContaining(["grocery", "fashion", "electronics", "hardware-building", "auto-parts", "books-stationery", "baby-kids", "home-appliances", "decor-carpets", "fabrics-sewing", "mobile-accessories", "computers-gaming", "jewelry-accessories", "agriculture-irrigation", "wholesale-distribution"]));
  });

  it("recommends a relevant template without creating products or stock", () => {
    expect(recommendedActivityTemplateKeys("سوبرماركت مواد غذائية ومشروبات")).toContain("grocery");
    expect(recommendedActivityTemplateKeys("قطع غيار سيارات وزيوت")).toContain("auto-parts");
    expect(activityTemplates.find((template) => template.key === "pharmacy")?.notice).toContain("وصفات");
  });

  it("limits a newly onboarded store to its explicitly selected sector", () => {
    const selected = templatesForStoreActivity(activityTemplates, "jewelry-accessories");
    expect(selected.map((template) => template.key)).toEqual(["jewelry-accessories"]);
    // Legacy merchants have no stored key and are not silently reclassified.
    expect(templatesForStoreActivity(activityTemplates, null)).toHaveLength(activityTemplates.length);
  });

  it("uses a safe online-sales default for starter drafts but honours per-product showcase choices", () => {
    expect(starterProductCommerceTypeAt(undefined, 0)).toBe("ONLINE_SALES");
    expect(starterProductCommerceTypeAt(["SHOWCASE_ONLY"], 0)).toBe("SHOWCASE_ONLY");
    expect(starterProductCommerceTypeAt(["SHOWCASE_ONLY"], 1)).toBe("ONLINE_SALES");
  });
});
