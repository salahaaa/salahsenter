/**
 * Infrastructure Abstractions — Foundation for Future Scaling
 * ===========================================================
 * Provider-agnostic interfaces for cross-cutting infrastructure (cache, queue,
 * background jobs, rate-limit store). Implementations live behind these
 * contracts so the app never couples to a specific vendor.
 *
 * Today these resolve to in-process fallbacks (memory / no-op). When the
 * platform needs to scale, drop in Redis/Upstash/BullMQ implementations that
 * satisfy the same interface — zero changes to calling code.
 *
 * This is the seam Phase 7 explicitly asks to prepare without building out.
 */

import type { SessionPayload } from "@/lib/auth";

/* ------------------------------------------------------------------ *
 * Cache abstraction
 * ------------------------------------------------------------------ */

export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** Invalidate every key sharing a tag (namespace). */
  invalidateTag?(tag: string): Promise<void>;
}

/** In-memory cache — dev/single-instance fallback. NOT for multi-instance prod. */
export const memoryCache: CacheProvider = (() => {
  const store = new Map<string, { value: unknown; expiresAt: number }>();
  return {
    async get<T>(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value as T;
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      store.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0 });
      if (store.size > 5000) {
        // crude eviction to bound memory in dev
        const firstKey = store.keys().next().value;
        if (firstKey) store.delete(firstKey);
      }
    },
    async delete(key: string) {
      store.delete(key);
    },
    async invalidateTag(tag: string) {
      for (const key of store.keys()) if (key.startsWith(`${tag}:`)) store.delete(key);
    }
  };
})();

/**
 * Resolve the active cache provider. When UPSTASH_REDIS_REST_URL is configured
 * (already supported by the rate limiter), a Redis adapter can be wired here.
 */
export function getCache(): CacheProvider {
  // Future: if (process.env.UPSTASH_REDIS_REST_URL) return upstashCache;
  return memoryCache;
}

/** Typed cache key builders — keep key construction centralized. */
export const cacheKeys = {
  storeList: (page: number, q: string) => `stores:list:${page}:${q}`,
  productDetail: (id: string) => `products:detail:${id}`,
  merchantContext: (userId: string) => `merchant:ctx:${userId}`,
  userPermissions: (userId: string) => `rbac:perms:${userId}`
};

/* ------------------------------------------------------------------ *
 * Background job / queue abstraction
 * ------------------------------------------------------------------ */

export interface JobQueue {
  enqueue<T>(name: string, payload: T, opts?: { delayMs?: number }): Promise<void>;
}

/** No-op queue — jobs run inline (fire-and-forget). Swap for BullMQ/QStash later. */
export const inlineQueue: JobQueue = {
  async enqueue(name, payload, opts) {
    // In dev we execute the handler immediately via the registry below.
    const handler = jobHandlers.get(name);
    if (handler) {
      try {
        await handler(payload);
      } catch (err) {
        console.error(`[inlineQueue] job "${name}" failed:`, err);
      }
    }
  }
};

export function getQueue(): JobQueue {
  // Future: if (process.env.QSTASH_URL || process.env.REDIS_URL) return realQueue;
  return inlineQueue;
}

const jobHandlers = new Map<string, (payload: any) => Promise<void>>();
export function registerJobHandler(name: string, handler: (payload: any) => Promise<void>) {
  jobHandlers.set(name, handler);
}

/* ------------------------------------------------------------------ *
 * Audit / observability seam
 * ------------------------------------------------------------------ */

export interface AuditEvent {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
  meta?: Record<string, unknown>;
}

/** Hook point for shipping audit events to an external sink (e.g. Sentry/DataDog). */
export function emitAudit(event: AuditEvent) {
  // The existing writeAuditLog persists to DB; this seam lets us also fan-out
  // to an external stream without touching call sites.
  if (process.env.NODE_ENV !== "production") return;
  // Future: await getQueue().enqueue("audit.persist", event);
}

/* ------------------------------------------------------------------ *
 * Feature flags seam — decouple rollout from code
 * ------------------------------------------------------------------ */

export type FeatureFlag = "redis_cache" | "object_storage" | "background_jobs" | "cdn_media";

export function isEnabled(flag: FeatureFlag): boolean {
  switch (flag) {
    case "redis_cache":
      return Boolean(process.env.UPSTASH_REDIS_REST_URL);
    case "object_storage":
      return ["cloudinary", "s3", "r2"].includes(process.env.MEDIA_PROVIDER || "local");
    case "background_jobs":
      return Boolean(process.env.QSTASH_URL || process.env.REDIS_URL);
    case "cdn_media":
      return Boolean(process.env.NEXT_PUBLIC_CDN_URL);
  }
}

/** Reserved for type re-export so consumers don't need a second import line. */
export type { SessionPayload };
