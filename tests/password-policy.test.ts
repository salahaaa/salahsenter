import { describe, expect, it } from "vitest";
import { strongPasswordSchema } from "@/lib/validators";

describe("password policy", () => {
  it("rejects short and common passwords", () => {
    expect(() => strongPasswordSchema.parse("short1!A")).toThrow();
    expect(() => strongPasswordSchema.parse("AdminPassword123!")).toThrow();
    expect(() => strongPasswordSchema.parse("DemoPassword123!")).toThrow();
  });

  it("accepts a strong mixed password or long passphrase", () => {
    expect(strongPasswordSchema.parse("Safe!Passphrase2026")).toBe("Safe!Passphrase2026");
    expect(strongPasswordSchema.parse("long secure arabic friendly phrase")).toBe("long secure arabic friendly phrase");
  });
});
