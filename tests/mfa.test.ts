import { describe, expect, it } from "vitest";
import { buildTotpUrl, generateBackupCodes, generateTotpSecret, verifyTotp } from "@/lib/mfa";

describe("mfa utilities", () => {
  it("generates base32 TOTP secrets and otpauth urls", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(buildTotpUrl({ secret, accountName: "admin@example.com" })).toContain("otpauth://totp/");
  });

  it("generates recovery codes", () => {
    const codes = generateBackupCodes(3);
    expect(codes).toHaveLength(3);
    expect(codes[0]).toMatch(/^[A-F0-9]{5}-[A-F0-9]{5}$/);
  });

  it("rejects malformed TOTP tokens", () => {
    expect(verifyTotp("abc", generateTotpSecret())).toBe(false);
  });
});
