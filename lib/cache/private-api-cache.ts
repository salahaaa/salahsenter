import crypto from "node:crypto";
import { redis, isUpstashRedisConfigured } from "@/lib/redis";

type CacheEnvelope = {
  v: 1;
  encrypted: boolean;
  storedAt: string;
  ttlSeconds: number;
  payload: string;
  iv?: string;
  tag?: string;
};

type CacheResult<T> = { value: T; hit: boolean; key: string };

type CacheOptions = {
  ttlSeconds: number;
  tags?: string[];
  namespace?: string;
  /** Keep private/admin cache encrypted at rest inside Redis. */
  encrypted?: boolean;
};

const VERSION = "v1";

function sha(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function apiCacheKey(parts: Array<string | number | boolean | null | undefined>) {
  const raw = parts.map((part) => String(part ?? "")).join("|");
  return `api-cache:${VERSION}:${sha(raw)}`;
}

function tagKey(tag: string) {
  return `api-cache-tag:${VERSION}:${tag}`;
}

function getEncryptionKey() {
  const secret = process.env.PRIVATE_API_CACHE_SECRET || process.env.JWT_SECRET || "";
  if (!secret || secret.length < 16) return null;
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptPayload(raw: string) {
  const key = getEncryptionKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { payload: encrypted.toString("base64"), iv: iv.toString("base64"), tag: tag.toString("base64") };
}

function decryptPayload(envelope: CacheEnvelope) {
  const key = getEncryptionKey();
  if (!key || !envelope.iv || !envelope.tag) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(envelope.payload, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function serialize(value: unknown, options: CacheOptions): CacheEnvelope {
  const raw = JSON.stringify(value);
  const shouldEncrypt = options.encrypted !== false;
  if (shouldEncrypt) {
    const encrypted = encryptPayload(raw);
    if (encrypted) return { v: 1, encrypted: true, storedAt: new Date().toISOString(), ttlSeconds: options.ttlSeconds, ...encrypted };
  }
  return { v: 1, encrypted: false, storedAt: new Date().toISOString(), ttlSeconds: options.ttlSeconds, payload: raw };
}

function deserialize<T>(raw: unknown): T | null {
  if (!raw) return null;
  const envelope = typeof raw === "string" ? JSON.parse(raw) as CacheEnvelope : raw as CacheEnvelope;
  const payload = envelope.encrypted ? decryptPayload(envelope) : envelope.payload;
  if (!payload) return null;
  return JSON.parse(payload) as T;
}

export async function getCachedPrivateApi<T>(key: string, loader: () => Promise<T>, options: CacheOptions): Promise<CacheResult<T>> {
  if (!isUpstashRedisConfigured() || !redis) return { value: await loader(), hit: false, key };
  try {
    const cached = await redis.get<CacheEnvelope>(key);
    const value = deserialize<T>(cached);
    if (value !== null) return { value, hit: true, key };
  } catch (error) {
    console.error("private api cache get failed", { key, error });
  }

  const value = await loader();
  try {
    const envelope = serialize(value, options);
    await redis.set(key, envelope, { ex: Math.max(1, Math.floor(options.ttlSeconds)) });
    for (const tag of options.tags || []) {
      await redis.sadd(tagKey(tag), key);
      await redis.expire(tagKey(tag), Math.max(60, Math.floor(options.ttlSeconds) + 120));
    }
  } catch (error) {
    console.error("private api cache set failed", { key, error });
  }
  return { value, hit: false, key };
}

export async function invalidatePrivateApiCacheTags(tags: string[]) {
  if (!isUpstashRedisConfigured() || !redis) return;
  const clean = [...new Set(tags.filter(Boolean))];
  for (const tag of clean) {
    const setKey = tagKey(tag);
    try {
      const keys = await redis.smembers<string[]>(setKey);
      if (keys?.length) await redis.del(...keys);
      await redis.del(setKey);
    } catch (error) {
      console.error("private api cache invalidation failed", { tag, error });
    }
  }
}

export function cacheHeader(hit: boolean) {
  return hit ? "HIT" : isUpstashRedisConfigured() ? "MISS" : "BYPASS";
}
