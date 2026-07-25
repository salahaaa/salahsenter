import crypto from "node:crypto";

export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";
export const GOOGLE_OAUTH_VERIFIER_COOKIE = "google_oauth_verifier";
const OAUTH_TTL_SECONDS = 10 * 60;

export function isProductionIdentityRuntime() {
  return process.env.APP_ENV === "production" || process.env.NEXT_PUBLIC_APP_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export function safePostLoginPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

export function resolveGoogleRedirectUri(requestUrl: string) {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  const fallbackBase = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(requestUrl).origin;
  const value = configured || `${fallbackBase.replace(/\/$/, "")}/api/auth/google/callback`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("GOOGLE_REDIRECT_URI ليس رابطاً صحيحاً");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("GOOGLE_REDIRECT_URI يجب أن يستخدم HTTP أو HTTPS");
  if (isProductionIdentityRuntime() && url.protocol !== "https:") throw new Error("GOOGLE_REDIRECT_URI يجب أن يستخدم HTTPS في الإنتاج");
  if (url.pathname !== "/api/auth/google/callback") throw new Error("GOOGLE_REDIRECT_URI يجب أن ينتهي بـ /api/auth/google/callback");
  return url.toString();
}

export function createGoogleOauthState(next: string | null | undefined) {
  const nonce = crypto.randomBytes(32).toString("base64url");
  const destination = Buffer.from(safePostLoginPath(next), "utf8").toString("base64url");
  return `${nonce}.${destination}`;
}

export function readPostLoginPathFromState(state: string) {
  const [, encodedPath, ...rest] = state.split(".");
  if (!encodedPath || rest.length) return "/";
  try {
    return safePostLoginPath(Buffer.from(encodedPath, "base64url").toString("utf8"));
  } catch {
    return "/";
  }
}

export function createPkcePair() {
  const verifier = crypto.randomBytes(64).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function constantTimeEqual(left: string | undefined, right: string | undefined) {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function googleOauthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" || isProductionIdentityRuntime(),
    path: "/",
    maxAge: OAUTH_TTL_SECONDS
  };
}
