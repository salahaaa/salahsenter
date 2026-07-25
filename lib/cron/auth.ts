import { timingSafeEqual } from "node:crypto";

export function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function getCronAuthorizationStatus(request: Request) {
  const secret = process.env.CRON_SECRET || "";
  const production = isProductionRuntime();

  if (!secret) {
    return production
      ? { ok: false, status: 503, message: "CRON_SECRET is required in production" }
      : { ok: true, status: 200, message: "Cron allowed without secret outside production" };
  }

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const headerSecret = request.headers.get("x-cron-secret") || "";
  const vercelCron = request.headers.get("x-vercel-cron") === "1";

  if (bearer && safeEqual(bearer, secret)) return { ok: true, status: 200, message: "Authorized" };
  if (headerSecret && safeEqual(headerSecret, secret)) return { ok: true, status: 200, message: "Authorized" };

  // Vercel Cron still needs our secret unless explicitly allowed for a private preview/staging setup.
  if (!production && vercelCron && process.env.ALLOW_UNSIGNED_VERCEL_CRON === "true") {
    return { ok: true, status: 200, message: "Authorized unsigned Vercel cron outside production" };
  }

  return { ok: false, status: 401, message: "Unauthorized cron request" };
}
