type RedisBackend = "upstash-rest" | "unconfigured";

type RedisPipelineItem<T = unknown> = { result?: T; error?: string };

export class RedisUnavailableError extends Error {
  constructor(message = "Redis is not configured") {
    super(message);
    this.name = "RedisUnavailableError";
  }
}

export type RedisConfig = {
  backend: RedisBackend;
  url?: string;
  token?: string;
  productionStrict: boolean;
  buildPhase: boolean;
};

function isProductionBuildPhase() {
  return process.env.NEXT_PHASE === "phase-production-build" || process.env.VERCEL_ENV === "preview" && process.env.NEXT_RUNTIME === undefined;
}

function envFlag(value: string | undefined, defaultValue: boolean) {
  if (value == null || value === "") return defaultValue;
  const normalized = value.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
  if (["false", "0", "no", "off", "disabled"].includes(normalized)) return false;
  if (["true", "1", "yes", "on", "enabled"].includes(normalized)) return true;
  return defaultValue;
}

/**
 * Prefixes application-owned Redis keys so an accidental shared Redis endpoint
 * cannot mix Staging cache/rate-limit state with another environment. Commands
 * without a key (PING/DBSIZE) are intentionally left untouched.
 */
export function getRedisKeyPrefix() {
  return (process.env.REDIS_KEY_PREFIX || "").trim();
}

export function namespaceRedisKey(key: string) {
  const prefix = getRedisKeyPrefix();
  if (!prefix) return key;
  return key.startsWith(prefix) ? key : `${prefix}${key}`;
}

export function getRedisConfig(): RedisConfig {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.VERCEL_KV_REST_API_URL ||
    "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.VERCEL_KV_REST_API_TOKEN ||
    "";
  const redisRequired = envFlag(process.env.REDIS_REQUIRED, false);

  return {
    backend: url && token ? "upstash-rest" : "unconfigured",
    url: url ? url.replace(/\/$/, "") : undefined,
    token: token || undefined,
    productionStrict: process.env.NODE_ENV === "production" && redisRequired,
    buildPhase: isProductionBuildPhase()
  };
}

export function isRedisConfigured() {
  return getRedisConfig().backend !== "unconfigured";
}

export function assertRedisAvailable(context = "Redis operation") {
  const config = getRedisConfig();
  if (config.backend !== "unconfigured") return config;
  if (config.productionStrict && !config.buildPhase) {
    throw new RedisUnavailableError(
      `${context} requires Redis in production. Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or compatible KV_REST_API_* variables).`
    );
  }
  return config;
}

export async function redisPipeline<T = unknown>(commands: unknown[][], options: { context?: string; optional?: boolean } = {}) {
  if (!commands.length) return [] as RedisPipelineItem<T>[];
  const config = assertRedisAvailable(options.context || "Redis pipeline");
  if (config.backend === "unconfigured") return [] as RedisPipelineItem<T>[];

  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(commands),
    cache: "no-store"
  });

  if (!response.ok) {
    const message = `Redis pipeline failed with ${response.status}`;
    if (options.optional && !config.productionStrict) return [] as RedisPipelineItem<T>[];
    throw new RedisUnavailableError(message);
  }

  const data = (await response.json()) as RedisPipelineItem<T>[];
  const failed = data.find((item) => item?.error);
  if (failed?.error) {
    if (options.optional && !config.productionStrict) return data;
    throw new RedisUnavailableError(`Redis command failed: ${failed.error}`);
  }
  return data;
}

export async function redisCommand<T = unknown>(command: unknown[], options: { context?: string; optional?: boolean } = {}) {
  const [item] = await redisPipeline<T>([command], options);
  return item?.result as T | undefined;
}
