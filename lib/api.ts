import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  readonly statusCode: number;
  readonly expose: boolean;
  constructor(message: string, statusCode = 400, expose = statusCode < 500) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.expose = expose;
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = "يجب تسجيل الدخول أولاً") { super(message, 401); this.name = "AuthenticationError"; }
}

export class ForbiddenError extends ApiError {
  constructor(message = "لا تملك الصلاحية لتنفيذ هذه العملية") { super(message, 403); this.name = "ForbiddenError"; }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ success: false, message, details }, { status });
}

export function handleApiError(error: unknown, fallback = "حدث خطأ غير متوقع") {
  console.error(error);
  // Error tracking is intentionally non-blocking: observability failures must
  // never change the API response or keep a request open.
  void import("@/lib/observability/error-tracking")
    .then(({ trackApiError }) => trackApiError(error, { fallback }))
    .catch(() => undefined);

  if (error instanceof ZodError) {
    const first = error.issues[0];
    const path = first?.path?.length ? first.path.join(".") : "field";
    const reason = first?.message || "قيمة غير صحيحة";
    return fail(`البيانات المرسلة غير صحيحة: ${path} - ${reason}`, 422, error.flatten());
  }

  const statusCode = error && typeof error === "object" && "statusCode" in error ? Number((error as { statusCode?: unknown }).statusCode) : 0;
  const expose = error instanceof ApiError ? error.expose : statusCode >= 400 && statusCode < 500;
  if (error instanceof Error && statusCode >= 400 && statusCode < 600) {
    return fail(expose ? error.message : fallback, statusCode);
  }

  // Never expose arbitrary server/database error messages to a client.
  return fail(fallback, 500);
}
