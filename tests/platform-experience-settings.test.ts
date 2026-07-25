import { describe, expect, it } from "vitest";
import { defaultPlatformIdentity, normalizePlatformIdentity, platformIdentitySchema } from "@/lib/platform-identity";
import { customHomeSectionConfigSchema, isCustomHomeSectionType, normalizeHomeSectionCode } from "@/lib/home-section-templates";

describe("platform experience settings", () => {
  it("normalizes a safe platform identity without accepting unknown control fields", () => {
    expect(platformIdentitySchema.parse({})).toEqual(defaultPlatformIdentity);
    expect(platformIdentitySchema.safeParse({ platformName: "منصتي", security: { lockdown: true } }).success).toBe(false);
    expect(normalizePlatformIdentity({ platformName: "منصتي", socialLinks: { whatsapp: "https://wa.me/9671" } })).toMatchObject({ platformName: "منصتي", whatsappUrl: "https://wa.me/9671" });
  });

  it("accepts supported custom section config and rejects unsafe URLs", () => {
    const config = customHomeSectionConfigSchema.parse({ text: "عرض خاص", imageUrl: "/uploads/banner.jpg", ctaUrl: "/offers", links: [{ label: "العروض", url: "/offers" }] });
    expect(config.links).toHaveLength(1);
    expect(customHomeSectionConfigSchema.safeParse({ imageUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(normalizeHomeSectionCode("Summer Campaign 2026")).toBe("summer_campaign_2026");
    expect(isCustomHomeSectionType("custom_banner")).toBe(true);
  });
});
