import { headers } from "next/headers";

function serializeError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  return { name: typeof error, message: String(error) };
}

export async function trackApiError(error: unknown, context: { fallback?: string } = {}) {
  const serialized = serializeError(error);
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(error, { tags: { source: "api", fallback: context.fallback || "api_error" } });
  } catch {
    // Sentry is optional; never break API responses because of error tracking.
  }

  try {
    const [{ writeStructuredLog }, h] = await Promise.all([import("@/lib/admin/platform-protection-center"), headers()]);
    await writeStructuredLog({
      level: "error",
      category: "api_error",
      service: "apis",
      message: serialized.message || context.fallback || "API error",
      requestPath: h.get("x-pathname") || h.get("next-url") || null,
      ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || h.get("cf-connecting-ip") || null,
      metadata: { error: serialized, userAgent: h.get("user-agent"), fallback: context.fallback }
    });
  } catch {
    // Structured log table may not exist before migration; console logging remains available.
  }
}
