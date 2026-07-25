import { describe, expect, it } from "vitest";
import { PLATFORM_TEXT_CATALOG } from "@/lib/text-center/catalog";

describe("platform text center catalog", () => {
  it("has unique stable keys limited to shopper-visible static copy", () => {
    const keys = PLATFORM_TEXT_CATALOG.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("header.trust.shipping");
    expect(keys).toContain("welcome.decorative_offer");
    expect(keys).toContain("auth.login.google");
    expect(keys).toContain("customer.cart.empty");
    expect(PLATFORM_TEXT_CATALOG.every((entry) => ["public", "customer"].includes(entry.audience))).toBe(true);
  });

  it("does not duplicate text owned by specialised public content managers", () => {
    const keys = PLATFORM_TEXT_CATALOG.map((entry) => entry.key);
    expect(keys.some((key) => key.startsWith("home.content."))).toBe(false);
    expect(keys.some((key) => key.startsWith("platform.identity."))).toBe(false);
    expect(keys.some((key) => key.startsWith("welcome.popup."))).toBe(false);
    expect(PLATFORM_TEXT_CATALOG.every((entry) => !("binding" in entry))).toBe(true);
  });
});
