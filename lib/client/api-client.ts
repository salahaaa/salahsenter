export type ApiEnvelope<T> = { success: true; data: T } | { success: false; message: string; details?: unknown };

export type ApiCachePolicy = "no-store" | "default" | "force-cache";
export const API_CACHE_POLICY: Record<string, ApiCachePolicy> = {
  // Authenticated/admin/merchant reads must not use a browser-shared cache.
  authenticated: "no-store",
  public: "default",
  static: "force-cache"
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly requestId: string | null;
  readonly details?: unknown;
  readonly retryable: boolean;
  constructor(input: { message: string; status: number; requestId?: string | null; details?: unknown }) {
    super(input.message);
    this.name = "ApiClientError";
    this.status = input.status;
    this.requestId = input.requestId || null;
    this.details = input.details;
    this.retryable = input.status === 0 || input.status === 408 || input.status === 429 || input.status >= 500;
  }
}

export type ApiRequestOptions = Omit<RequestInit, "body" | "headers"> & {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
  retry?: number;
  cachePolicy?: ApiCachePolicy;
  /** Notify local query/UI consumers after a successful mutation. */
  invalidateTags?: string[];
  idempotencyKey?: string;
};

function makeRequestId() {
  return globalThis.crypto?.randomUUID?.() || `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function shouldRetry(method: string, error: unknown, attempt: number, allowed: number) {
  if (attempt >= allowed || !["GET", "HEAD"].includes(method)) return false;
  return error instanceof ApiClientError ? error.retryable : true;
}

function wait(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function invalidate(tags: string[]) {
  if (!tags.length || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("mall:api-invalidate", { detail: { tags } }));
}

/**
 * Typed API gateway for browser clients. It standardizes request IDs, CSRF-aware
 * same-origin calls, API error mapping, safe GET retry and UI cache invalidation.
 */
export async function apiRequest<T>(url: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const retry = options.retry ?? (method === "GET" ? 2 : 0);
  const requestId = makeRequestId();
  let lastError: unknown;

  for (let attempt = 0; attempt <= retry; attempt += 1) {
    try {
      const headers = new Headers(options.headers);
      headers.set("accept", "application/json");
      headers.set("x-request-id", requestId);
      if (options.idempotencyKey) headers.set("idempotency-key", options.idempotencyKey);
      const hasBody = options.body !== undefined && options.body !== null;
      if (hasBody && !headers.has("content-type")) headers.set("content-type", "application/json");
      const response = await fetch(url, {
        ...options,
        method,
        headers,
        body: hasBody ? JSON.stringify(options.body) : undefined,
        cache: options.cachePolicy || API_CACHE_POLICY.authenticated
      });
      const responseRequestId = response.headers.get("x-request-id") || requestId;
      const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null;
      if (!response.ok || !payload?.success) {
        throw new ApiClientError({
          message: payload && !payload.success ? payload.message : `فشل الطلب (${response.status})`,
          status: response.status,
          requestId: responseRequestId,
          details: payload && !payload.success ? payload.details : undefined
        });
      }
      invalidate(options.invalidateTags || []);
      return payload.data;
    } catch (error) {
      lastError = error;
      if (!shouldRetry(method, error, attempt, retry)) break;
      await wait(Math.min(1_500, 200 * 2 ** attempt + Math.floor(Math.random() * 100)));
    }
  }

  if (lastError instanceof ApiClientError) throw lastError;
  throw new ApiClientError({ message: "تعذر الاتصال بالخدمة. حاول مرة أخرى.", status: 0, requestId });
}

export const apiClient = {
  get: <T>(url: string, options: Omit<ApiRequestOptions, "method" | "body"> = {}) => apiRequest<T>(url, { ...options, method: "GET" }),
  post: <T>(url: string, body?: unknown, options: Omit<ApiRequestOptions, "method" | "body"> = {}) => apiRequest<T>(url, { ...options, method: "POST", body }),
  put: <T>(url: string, body?: unknown, options: Omit<ApiRequestOptions, "method" | "body"> = {}) => apiRequest<T>(url, { ...options, method: "PUT", body }),
  patch: <T>(url: string, body?: unknown, options: Omit<ApiRequestOptions, "method" | "body"> = {}) => apiRequest<T>(url, { ...options, method: "PATCH", body }),
  delete: <T>(url: string, body?: unknown, options: Omit<ApiRequestOptions, "method" | "body"> = {}) => apiRequest<T>(url, { ...options, method: "DELETE", body })
};
