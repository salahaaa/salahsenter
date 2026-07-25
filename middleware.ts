import { jwtVerify } from "jose";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { isMachineIntegrationRequest, isSignedPaymentWebhook } from "@/lib/security-request-policy";
import { getEnvironmentIsolationReport } from "@/lib/environment/isolation";

const protectedPrefixes = ["/admin", "/merchant"];
const cookieName = process.env.SESSION_COOKIE_NAME || "mall_session";
const csrfCookieName = "mall_csrf";
const csrfHeaderName = "x-csrf-token";
const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Third-party payment providers cannot supply browser CSRF cookies. Keep this
// list exact and small; each route is required to perform signature validation.
const csrfExemptWebhookPaths = new Set([
  "/api/payments/stripe/webhook",
  "/api/payments/local-gateway/webhook"
]);

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return new TextEncoder().encode(secret);
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function monitoringRate() {
  const value = Number(process.env.MONITORING_REQUEST_SAMPLE_RATE || "1");
  return Number.isFinite(value) && value > 0 ? Math.max(0.01, Math.min(1, value)) : 1;
}

function monitoringBucket() {
  return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
}

function namespacedRedisKey(key: string) {
  const prefix = (process.env.REDIS_KEY_PREFIX || "").trim();
  return prefix && !key.startsWith(prefix) ? `${prefix}${key}` : key;
}

async function recordRequestMetric(request: NextRequest) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.VERCEL_KV_REST_API_TOKEN;
  if (!url || !token) return;
  const rate = monitoringRate();
  if (rate < 1 && Math.random() > rate) return;
  const weight = Math.max(1, Math.round(1 / rate));
  const bucket = monitoringBucket();
  const keys = [namespacedRedisKey(`obs:req:${bucket}:total`)];
  if (request.nextUrl.pathname.startsWith("/api/")) keys.push(namespacedRedisKey(`obs:req:${bucket}:api`));
  const commands = keys.flatMap((key) => [["INCRBY", key, weight], ["EXPIRE", key, 7200]]);
  await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store"
  }).catch(() => undefined);
}

function parseCspOrigins(value: string | undefined, defaultProtocol = "https:") {
  const origins = new Set<string>();
  for (const raw of String(value || "").split(",").map((item) => item.trim()).filter(Boolean)) {
    try {
      const url = raw.includes("://") ? new URL(raw) : new URL(`${defaultProtocol}//${raw}`);
      if (["https:", "wss:"].includes(url.protocol)) origins.add(url.origin);
    } catch {
      // Invalid CSP config is ignored rather than weakening the policy.
    }
  }
  return [...origins];
}

function sentryOrigins() {
  return [process.env.SENTRY_DSN, process.env.NEXT_PUBLIC_SENTRY_DSN]
    .flatMap((dsn) => parseCspOrigins(dsn))
    .filter(Boolean);
}

function securityHeaders(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";
  const imageOrigins = parseCspOrigins(`${process.env.NEXT_IMAGE_REMOTE_HOSTS || ""},${process.env.CSP_IMG_SRC || ""}`);
  const connectOrigins = [...new Set([...parseCspOrigins(process.env.CSP_CONNECT_SRC), ...sentryOrigins()])];
  const imgSources = isDev ? "'self' data: blob: https:" : ["'self'", "data:", "blob:", ...imageOrigins].join(" ");
  const connectSources = isDev ? "'self' https: wss:" : ["'self'", ...connectOrigins].join(" ");
  const mediaSources = isDev ? "'self' blob: https:" : ["'self'", "blob:", ...imageOrigins].join(" ");
  const csp = [
    "default-src 'self'",
    // Next.js currently requires inline bootstrap scripts/styles; production
    // origins are nevertheless strict for connect/img/media requests.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSources}`,
    "font-src 'self' data:",
    `connect-src ${connectSources}`,
    `media-src ${mediaSources}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join("; ");

  const headers: Record<string, string> = {
    "Content-Security-Policy": csp,
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), browsing-topics=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-site",
    "Cross-Origin-Embedder-Policy": "credentialless",
    "X-DNS-Prefetch-Control": "on",
    "X-Permitted-Cross-Domain-Policies": "none"
  };

  if (request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production") {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }

  return headers;
}

function applySecurity(request: NextRequest, response: NextResponse, csrfToken?: string, requestId?: string) {
  const headers = securityHeaders(request);
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  response.headers.set("x-pathname", request.nextUrl.pathname);
  response.headers.set("x-request-id", requestId || request.headers.get("x-request-id") || randomToken());

  if (csrfToken) {
    response.cookies.set(csrfCookieName, csrfToken, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });
  }

  return response;
}

function isCrossOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.nextUrl.host;
  } catch {
    return true;
  }
}

function isCsrfExemptApiRequest(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  return isMachineIntegrationRequest(pathname, request.headers) || isSignedPaymentWebhook(pathname) || csrfExemptWebhookPaths.has(pathname);
}

function validateCsrf(request: NextRequest, csrfToken: string | undefined) {
  if (!request.nextUrl.pathname.startsWith("/api/")) return null;
  if (isCsrfExemptApiRequest(request)) return null;
  if (!mutatingMethods.has(request.method.toUpperCase())) return null;

  if (isCrossOrigin(request)) {
    return NextResponse.json({ success: false, message: "Cross-origin requests are not allowed" }, { status: 403 });
  }

  const submitted = request.headers.get(csrfHeaderName);
  if (!csrfToken || !submitted || submitted !== csrfToken) {
    return NextResponse.json({ success: false, message: "Invalid CSRF token" }, { status: 403 });
  }

  return null;
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  event.waitUntil(recordRequestMetric(request));
  const requestHeaders = new Headers(request.headers);
  const requestId = request.headers.get("x-request-id")?.trim().slice(0, 160) || randomToken();
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-request-id", requestId);

  const existingCsrf = request.cookies.get(csrfCookieName)?.value;
  const csrfToken = existingCsrf || randomToken();
  const isolation = getEnvironmentIsolationReport();
  if (isolation.enforced && !isolation.ok) {
    // Do not disclose bucket names, hosts or other configuration details to a
    // public request. Operators receive the exact failed checks in CI/readiness.
    return applySecurity(request, NextResponse.json({ success: false, message: "Environment configuration is incomplete" }, { status: 503 }), csrfToken, requestId);
  }
  const csrfFailure = validateCsrf(request, existingCsrf);
  if (csrfFailure) return applySecurity(request, csrfFailure, csrfToken, requestId);

  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return applySecurity(request, NextResponse.next({ request: { headers: requestHeaders } }), csrfToken, requestId);

  const token = request.cookies.get(cookieName)?.value;
  if (!token) return applySecurity(request, redirectToLogin(request), csrfToken, requestId);

  const secret = getJwtSecret();
  try {
    const { payload } = await jwtVerify(token, secret);
    const roles = (payload.roles as Array<{ code: string; scope?: string; storeId?: string | null }>) || [];

    if (pathname.startsWith("/admin") && !roles.some((role) => role.code === "super_admin" || role.code.startsWith("platform_employee_") || role.code.startsWith("qa_staging_platform_"))) {
      return applySecurity(request, NextResponse.redirect(new URL("/", request.url)), csrfToken, requestId);
    }

    // صفحات /merchant تحتاج فقط جلسة صالحة في الـ middleware.
    // الصلاحيات التفصيلية تُفحص داخل الصفحات وواجهات API بقراءة أحدث الأدوار من قاعدة البيانات،
    // حتى لا يضطر التاجر لتسجيل خروج/دخول بعد الموافقة النهائية وتحديث دوره.
    return applySecurity(request, NextResponse.next({ request: { headers: requestHeaders } }), csrfToken, requestId);
  } catch {
    return applySecurity(request, redirectToLogin(request), csrfToken, requestId);
  }
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads|.*\\..*).*)", "/api/:path*"]
};
