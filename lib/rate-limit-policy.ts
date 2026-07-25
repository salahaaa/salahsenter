import { checkIpRateLimit } from "@/lib/rate-limit";

export type RateLimitClass = "public_read" | "auth" | "search" | "upload" | "webhook" | "authenticated_write" | "integration";
export type RateLimitPolicy = { limit: number; windowMs: number; scope: string };

/** Central policy for new routes. Existing explicit limits remain valid until migrated. */
export const RATE_LIMIT_POLICIES: Record<RateLimitClass, RateLimitPolicy> = {
  public_read: { limit: 240, windowMs: 60_000, scope: "public" },
  auth: { limit: 20, windowMs: 15 * 60_000, scope: "auth" },
  search: { limit: 120, windowMs: 60_000, scope: "search" },
  upload: { limit: 30, windowMs: 10 * 60_000, scope: "upload" },
  webhook: { limit: 600, windowMs: 60_000, scope: "webhook" },
  authenticated_write: { limit: 90, windowMs: 60_000, scope: "authenticated_write" },
  integration: { limit: 300, windowMs: 60_000, scope: "integration" }
};

export function classifyRouteRateLimit(pathname: string, method = "GET"): RateLimitClass {
  if (/^\/api\/auth\//.test(pathname)) return "auth";
  if (/^\/api\/(?:search|products\/compare|products\/[^/]+\/discovery)/.test(pathname)) return "search";
  if (/^\/api\/media\/upload/.test(pathname)) return "upload";
  if (/webhook/.test(pathname)) return "webhook";
  if (/^\/api\/integrations\//.test(pathname)) return "integration";
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase()) ? "authenticated_write" : "public_read";
}

export async function enforceRouteRateLimit(pathname: string, method = "GET") {
  const category = classifyRouteRateLimit(pathname, method);
  const policy = RATE_LIMIT_POLICIES[category];
  const result = await checkIpRateLimit(`${policy.scope}:${pathname}`, policy.limit, policy.windowMs);
  if (!result.allowed) {
    const error = new Error("تم تجاوز حد الطلبات؛ حاول لاحقاً") as Error & { statusCode?: number; retryAfterSeconds?: number };
    error.statusCode = 429;
    error.retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    throw error;
  }
  return { category, ...result };
}
