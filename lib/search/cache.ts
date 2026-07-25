import { advancedSearch } from "@/lib/enterprise/search-engine";
import { smartSearch } from "@/lib/smart-search";
import { cacheRememberJson } from "@/lib/redis/cache";

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase().slice(0, 120);
}

function safeLimit(value: number, fallback = 8, max = 50) {
  return Math.max(1, Math.min(Number.isFinite(value) ? value : fallback, max));
}

export async function cachedSmartSearch(query: string, limit: number) {
  const q = normalize(query);
  const l = safeLimit(limit, 8, 30);
  return cacheRememberJson(`search:v1:smart:${q}:limit:${l}`, () => smartSearch(q, { limit: l }), {
    ttlSeconds: q ? 60 : 20,
    tags: ["search", "search:smart"]
  });
}

export async function cachedAdvancedSearch(input: { query: string; limit: number; source: string }) {
  const q = normalize(input.query);
  const l = safeLimit(input.limit, 10, 50);
  const source = normalize(input.source || "advanced_search");
  return cacheRememberJson(`search:v1:advanced:${source}:${q}:limit:${l}`, () => advancedSearch({ query: q, limit: l, source }), {
    ttlSeconds: q ? 45 : 15,
    tags: ["search", "search:advanced"]
  });
}
