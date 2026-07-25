import { redisCommand, redisPipeline, RedisUnavailableError, getRedisConfig, namespaceRedisKey } from "./client";

type CacheEnvelope<T> = {
  value: T;
  storedAt: string;
  ttlSeconds: number;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const inFlight = new Map<string, Promise<unknown>>();

function reviveDates(_key: string, value: unknown) {
  if (typeof value === "string" && ISO_DATE_RE.test(value)) return new Date(value);
  return value;
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw, reviveDates) as T;
  } catch {
    return null;
  }
}

function normalizeKey(key: string) {
  return namespaceRedisKey(key.replace(/\s+/g, " ").trim().slice(0, 300));
}

function tagKey(tag: string) {
  return namespaceRedisKey(`cachetag:${tag}`);
}

function lockKey(key: string) {
  return namespaceRedisKey(`cachelock:${key}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type CacheRememberOptions = {
  ttlSeconds: number;
  tags?: string[];
  allowStaleWithoutRedisInBuild?: boolean;
  /** Prevent thundering-herd recomputation on Redis cache misses. */
  stampedeLockMs?: number;
  /** How long a loser waits for the lock holder to populate cache before computing itself. */
  stampedeWaitMs?: number;
};

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const normalized = normalizeKey(key);
  try {
    const raw = await redisCommand<string>(["GET", normalized], { context: `cache GET ${normalized}`, optional: true });
    if (!raw) return null;
    const envelope = safeJsonParse<CacheEnvelope<T>>(raw);
    return envelope ? envelope.value : null;
  } catch (error) {
    if (error instanceof RedisUnavailableError) {
      const config = getRedisConfig();
      if (!config.productionStrict || config.buildPhase) return null;
    }
    throw error;
  }
}

export async function cacheSetJson<T>(key: string, value: T, options: CacheRememberOptions): Promise<void> {
  const normalized = normalizeKey(key);
  const ttl = Math.max(1, Math.floor(options.ttlSeconds));
  const envelope: CacheEnvelope<T> = { value, storedAt: new Date().toISOString(), ttlSeconds: ttl };
  const commands: unknown[][] = [["SET", normalized, JSON.stringify(envelope), "EX", ttl]];

  for (const tag of options.tags || []) {
    commands.push(["SADD", tagKey(tag), normalized]);
    commands.push(["EXPIRE", tagKey(tag), ttl + 60]);
  }

  try {
    await redisPipeline(commands, { context: `cache SET ${normalized}`, optional: true });
  } catch (error) {
    if (error instanceof RedisUnavailableError) {
      const config = getRedisConfig();
      if (!config.productionStrict || config.buildPhase) return;
    }
    throw error;
  }
}

async function computeAndSet<T>(normalized: string, loader: () => Promise<T>, options: CacheRememberOptions) {
  const existing = inFlight.get(normalized) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = (async () => {
    const value = await loader();
    await cacheSetJson(normalized, value, options);
    return value;
  })();
  inFlight.set(normalized, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(normalized);
  }
}

async function tryAcquireRedisLock(key: string, lockMs: number) {
  const config = getRedisConfig();
  if (config.backend === "unconfigured") return true;
  try {
    const result = await redisCommand<string>(["SET", lockKey(key), "1", "PX", lockMs, "NX"], { context: "cache stampede lock", optional: true });
    return result === "OK";
  } catch (error) {
    if (error instanceof RedisUnavailableError && (!config.productionStrict || config.buildPhase)) return true;
    throw error;
  }
}

async function releaseRedisLock(key: string) {
  const config = getRedisConfig();
  if (config.backend === "unconfigured") return;
  await redisCommand(["DEL", lockKey(key)], { context: "cache stampede unlock", optional: true }).catch(() => undefined);
}

export async function cacheRememberJson<T>(key: string, loader: () => Promise<T>, options: CacheRememberOptions): Promise<T> {
  const normalized = normalizeKey(key);
  const cached = await cacheGetJson<T>(normalized);
  if (cached !== null) return cached;

  const lockMs = Math.max(1000, options.stampedeLockMs || 8000);
  const waitMs = Math.max(0, options.stampedeWaitMs || 1500);
  const acquired = await tryAcquireRedisLock(normalized, lockMs);

  if (!acquired && waitMs > 0) {
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      await sleep(150 + Math.floor(Math.random() * 100));
      const warm = await cacheGetJson<T>(normalized);
      if (warm !== null) return warm;
    }
  }

  try {
    return await computeAndSet(normalized, loader, options);
  } finally {
    if (acquired) await releaseRedisLock(normalized);
  }
}

export async function cacheDeleteKeys(keys: string[]) {
  const normalized = keys.map(normalizeKey).filter(Boolean);
  if (!normalized.length) return;
  await redisPipeline([normalized.length === 1 ? ["DEL", normalized[0]] : ["DEL", ...normalized]], {
    context: "cache DEL",
    optional: true
  });
}

export async function cacheDeleteByTags(tags: string[]) {
  const cleanTags = [...new Set(tags.filter(Boolean))];
  if (!cleanTags.length) return;

  const setKeys = cleanTags.map(tagKey);
  const members = await redisPipeline<string[]>(setKeys.map((key) => ["SMEMBERS", key]), {
    context: "cache tag SMEMBERS",
    optional: true
  });

  const keys = new Set<string>();
  for (const item of members) {
    const result = item?.result;
    if (Array.isArray(result)) for (const key of result) keys.add(key);
  }

  const commands: unknown[][] = [];
  if (keys.size) commands.push(["DEL", ...Array.from(keys)]);
  if (setKeys.length) commands.push(["DEL", ...setKeys]);
  if (commands.length) await redisPipeline(commands, { context: "cache tag DEL", optional: true });
}
