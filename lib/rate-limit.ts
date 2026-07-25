import { headers } from "next/headers";
import { getRedisConfig, namespaceRedisKey, redisCommand, RedisUnavailableError } from "@/lib/redis/client";

type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number; backend: "upstash" | "memory" };
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let warnedAboutMemoryFallback = false;

export async function getClientIp() {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "unknown"
  );
}

function allowMemoryFallback() {
  const config = getRedisConfig();
  return !config.productionStrict || config.buildPhase;
}

async function checkRedisRateLimit(input: { key: string; limit: number; windowMs: number }): Promise<RateLimitResult> {
  const now = Date.now();
  const key = namespaceRedisKey(`rate:${input.key}`);
  const count = Number((await redisCommand<number>(["INCR", key], { context: "rate limit INCR" })) || 0);
  if (count === 1) await redisCommand(["PEXPIRE", key, input.windowMs], { context: "rate limit PEXPIRE" });
  const ttl = Number((await redisCommand<number>(["PTTL", key], { context: "rate limit PTTL" })) || input.windowMs);
  const resetAt = now + Math.max(0, ttl);
  return { allowed: count <= input.limit, remaining: Math.max(0, input.limit - count), resetAt, backend: "upstash" };
}

function checkMemoryRateLimit(input: { key: string; limit: number; windowMs: number }): RateLimitResult {
  if (!allowMemoryFallback()) {
    throw new RedisUnavailableError("Redis rate limiter is required in production; memory fallback is disabled.");
  }

  if (!warnedAboutMemoryFallback) {
    warnedAboutMemoryFallback = true;
    console.warn("Redis is not configured. Using in-memory rate limiting only for local/build environments. Production requires Redis.");
  }

  const now = Date.now();
  const bucket = buckets.get(input.key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(input.key, { count: 1, resetAt: now + input.windowMs });
    return { allowed: true, remaining: input.limit - 1, resetAt: now + input.windowMs, backend: "memory" };
  }
  if (bucket.count >= input.limit) return { allowed: false, remaining: 0, resetAt: bucket.resetAt, backend: "memory" };
  bucket.count += 1;
  return { allowed: true, remaining: input.limit - bucket.count, resetAt: bucket.resetAt, backend: "memory" };
}

export async function checkRateLimit(input: { key: string; limit: number; windowMs: number }): Promise<RateLimitResult> {
  const config = getRedisConfig();
  if (config.backend === "unconfigured") return checkMemoryRateLimit(input);
  try {
    return await checkRedisRateLimit(input);
  } catch (error) {
    if (allowMemoryFallback()) {
      console.error("Redis rate limiter failed; using memory fallback outside production", error);
      return checkMemoryRateLimit(input);
    }
    throw error;
  }
}

export async function checkIpRateLimit(scope: string, limit: number, windowMs: number) {
  const ip = await getClientIp();
  return checkRateLimit({ key: `${scope}:${ip}`, limit, windowMs });
}

export async function requireIpRateLimit(scope: string, limit: number, windowMs: number) {
  const rate = await checkIpRateLimit(scope, limit, windowMs);
  if (!rate.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000));
    const error = new Error("محاولات كثيرة، حاول لاحقاً") as Error & { statusCode?: number; retryAfterSeconds?: number };
    error.statusCode = 429;
    error.retryAfterSeconds = retryAfterSeconds;
    throw error;
  }
  return rate;
}

export async function progressiveDelay(scope: string, maxDelayMs = 5000) {
  const ip = await getClientIp();
  const rate = await checkRateLimit({ key: `delay:${scope}:${ip}`, limit: 1_000_000, windowMs: 15 * 60 * 1000 });
  const used = 1_000_000 - rate.remaining;
  const delay = Math.min(maxDelayMs, Math.max(0, used - 1) * 250);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  return delay;
}
