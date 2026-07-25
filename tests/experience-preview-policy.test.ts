import { describe, expect, it } from "vitest";
import { __experiencePreviewInternals } from "@/lib/experience-preview";

describe("admin experience preview policy", () => {
  it("keeps preview payloads typed and safe before they can render", () => {
    expect(__experiencePreviewInternals.normalizeExperiencePreviewPayload("welcome_popup", { enabled: true, showOnce: true, delayMs: 700, imageUrl: "", badgeText: "", title: "أهلاً", message: "رسالة", couponCode: "", buttonText: "ابدأ", buttonUrl: "/", closeOnBackdrop: true })).toMatchObject({ enabled: true, title: "أهلاً" });
    expect(() => __experiencePreviewInternals.normalizeExperiencePreviewPayload("home_sections", { sections: [{ code: "unsafe", title: "غير آمن", type: "custom_banner", isVisible: true, sortOrder: 1, config: { imageUrl: "javascript:alert(1)" } }] })).toThrow();
  });
});
