import { describe, expect, it } from "vitest";
import {
  assertTestExperienceEnvironment,
  assertTestExperiencePassword,
  normalizeTestExperienceSlug,
  TEST_EXPERIENCE_CONFIRMATION
} from "@/lib/test-experience/policy";

describe("minimal test experience bootstrap policy", () => {
  it("requires an explicit confirmation and blocks every production-like environment", () => {
    expect(() => assertTestExperienceEnvironment({ APP_ENV: "development" })).toThrow(/TEST_EXPERIENCE_CONFIRM/);
    expect(() => assertTestExperienceEnvironment({ APP_ENV: "production", TEST_EXPERIENCE_CONFIRM: TEST_EXPERIENCE_CONFIRMATION })).toThrow(/Production/);
    expect(() => assertTestExperienceEnvironment({ APP_ENV: "staging", TEST_EXPERIENCE_CONFIRM: TEST_EXPERIENCE_CONFIRMATION })).not.toThrow();
  });

  it("accepts only safe test slugs and strong non-default passwords", () => {
    expect(normalizeTestExperienceSlug(" Test-Store-01 ", "TEST")).toBe("test-store-01");
    expect(() => normalizeTestExperienceSlug("متجر اختبار", "TEST")).toThrow();
    expect(assertTestExperiencePassword("TestMerchantPassphrase2026!", "TEST_PASSWORD")).toContain("2026");
    expect(() => assertTestExperiencePassword("demo-password-which-is-long", "TEST_PASSWORD")).toThrow();
  });
});
