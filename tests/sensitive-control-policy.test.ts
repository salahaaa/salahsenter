import { describe, expect, it } from "vitest";
import { assertSensitivePasswordPolicy, hashOpaqueToken } from "@/lib/sensitive-control";

describe("sensitive control policy", () => {
  it("requires a non-demo sensitive password of at least 16 characters", () => {
    expect(() => assertSensitivePasswordPolicy("short-password")).toThrow();
    expect(() => assertSensitivePasswordPolicy("demo-password-that-is-long-enough")).toThrow();
    expect(() => assertSensitivePasswordPolicy("OwnerSensitivePassphrase2026!")).not.toThrow();
  });

  it("hashes bootstrap/session tokens rather than persisting raw values", () => {
    const token = "one-time-bootstrap-token";
    expect(hashOpaqueToken(token)).toHaveLength(64);
    expect(hashOpaqueToken(token)).not.toContain(token);
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
  });
});
