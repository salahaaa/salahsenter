import { getHomeData, getHomeDataFallback } from "@/lib/db/queries";
import { cachedJson } from "./public-cache";
import { PUBLIC_CACHE_KEYS, PUBLIC_CACHE_TAGS, PUBLIC_CACHE_TTL } from "./cache-tags";

class HomeDataTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Home data exceeded ${timeoutMs}ms`);
    this.name = "HomeDataTimeoutError";
  }
}

function homeReadTimeoutMs() {
  const configured = Number(process.env.HOME_DATA_TIMEOUT_MS || 5_000);
  return Number.isFinite(configured) ? Math.min(Math.max(Math.floor(configured), 1_000), 10_000) : 5_000;
}

async function withinHomeReadBudget<T>(loader: () => Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      loader(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new HomeDataTimeoutError(timeoutMs)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getCachedHomeData() {
  // Scheduled exposure and fair rotation are evaluated in minute-sized buckets.
  // Tags still invalidate immediately when an admin pauses or edits a campaign.
  // A slow DB miss must never turn the public home page into a Vercel 504.
  const timeBucket = String(Math.floor(Date.now() / 60_000));
  try {
    return await cachedJson({
      key: PUBLIC_CACHE_KEYS.home(timeBucket),
      tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.stores, PUBLIC_CACHE_TAGS.products, PUBLIC_CACHE_TAGS.wings, PUBLIC_CACHE_TAGS.offers, PUBLIC_CACHE_TAGS.settings],
      ttlSeconds: PUBLIC_CACHE_TTL.home,
      loader: () => withinHomeReadBudget(getHomeData, homeReadTimeoutMs())
    });
  } catch (error) {
    if (error instanceof HomeDataTimeoutError) {
      console.warn(`Home data timed out after ${error.timeoutMs}ms; serving safe fallback without caching it.`);
      return getHomeDataFallback();
    }
    throw error;
  }
}
