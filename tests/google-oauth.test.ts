import { afterEach, describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  createGoogleOauthState,
  createPkcePair,
  readPostLoginPathFromState,
  resolveGoogleRedirectUri,
  safePostLoginPath
} from "@/lib/google-oauth";

describe("Google OAuth security helpers", () => {
  const previousRedirectUri = process.env.GOOGLE_REDIRECT_URI;
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const previousAppEnv = process.env.APP_ENV;

  afterEach(() => {
    process.env.GOOGLE_REDIRECT_URI = previousRedirectUri;
    process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
    process.env.APP_ENV = previousAppEnv;
  });

  it("binds a safe post-login path into state and rejects open redirects", () => {
    const state = createGoogleOauthState("/merchant/orders");
    expect(readPostLoginPathFromState(state)).toBe("/merchant/orders");
    expect(safePostLoginPath("//evil.example")).toBe("/");
    expect(safePostLoginPath("https://evil.example")).toBe("/");
    expect(safePostLoginPath("/\\evil")).toBe("/");
  });

  it("creates a PKCE verifier/challenge pair and compares state values safely", () => {
    const { verifier, challenge } = createPkcePair();
    expect(verifier.length).toBeGreaterThan(40);
    expect(challenge.length).toBeGreaterThan(40);
    expect(constantTimeEqual("state", "state")).toBe(true);
    expect(constantTimeEqual("state", "other")).toBe(false);
  });

  it("uses the configured callback URI and requires HTTPS in production", () => {
    process.env.GOOGLE_REDIRECT_URI = "https://mall.example/api/auth/google/callback";
    process.env.APP_ENV = "production";
    expect(resolveGoogleRedirectUri("http://localhost:3000/api/auth/google")).toBe("https://mall.example/api/auth/google/callback");

    process.env.GOOGLE_REDIRECT_URI = "http://mall.example/api/auth/google/callback";
    expect(() => resolveGoogleRedirectUri("http://localhost:3000/api/auth/google")).toThrow(/HTTPS/);
  });
});
