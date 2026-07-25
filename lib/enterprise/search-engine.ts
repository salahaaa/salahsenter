import { db, searchAnalytics } from "@/lib/db";
import { smartSearch, type SmartSearchResult } from "@/lib/smart-search";

export type AdvancedSearchOptions = {
  query: string;
  limit?: number;
  filters?: Record<string, unknown>;
  source?: string;
  sessionId?: string;
};

function meiliConfig() {
  const host = process.env.MEILI_HOST || process.env.MEILISEARCH_HOST;
  const key = process.env.MEILI_MASTER_KEY || process.env.MEILI_SEARCH_KEY;
  return host ? { host: host.replace(/\/$/, ""), key } : null;
}

function analyticsSampleRate() {
  const configured = Number(process.env.SEARCH_ANALYTICS_SAMPLE_RATE);
  if (Number.isFinite(configured)) return Math.max(0, Math.min(configured, 1));
  return process.env.NODE_ENV === "production" ? 0.05 : 1;
}

export async function advancedSearch(options: AdvancedSearchOptions): Promise<SmartSearchResult & { engine: "meilisearch" | "postgres-smart" }> {
  const config = meiliConfig();
  if (config) {
    try {
      // Meilisearch is optional. Product/store/category/tenant indexing can be triggered by background jobs later.
      const response = await fetch(`${config.host}/multi-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(config.key ? { Authorization: `Bearer ${config.key}` } : {}) },
        body: JSON.stringify({
          queries: [
            { indexUid: "products", q: options.query, limit: options.limit || 10 },
            { indexUid: "stores", q: options.query, limit: 6 },
            { indexUid: "wings", q: options.query, limit: 6 },
            { indexUid: "categories", q: options.query, limit: 6 }
          ]
        }),
        cache: "no-store"
      });
      if (response.ok) {
        // Keep response shape stable by still using PostgreSQL mapper until full Meili index contract is enabled.
        const result = await smartSearch(options.query, { limit: options.limit || 10 });
        await logSearch(options, result.products.length + result.stores.length + result.wings.length + result.categories.length);
        return { ...result, engine: "meilisearch" };
      }
    } catch (error) {
      console.error("Meilisearch unavailable; falling back to PostgreSQL smart search", error);
    }
  }

  const result = await smartSearch(options.query, { limit: options.limit || 10 });
  await logSearch(options, result.products.length + result.stores.length + result.wings.length + result.categories.length);
  return { ...result, engine: "postgres-smart" };
}

async function logSearch(options: AdvancedSearchOptions, resultCount: number) {
  const query = options.query.trim();
  if (!query) return;
  if (Math.random() > analyticsSampleRate()) return;
  try {
    await db.insert(searchAnalytics).values({
      query,
      normalizedQuery: query.toLowerCase(),
      resultCount,
      filters: options.filters || {},
      source: options.source || "site",
      sessionId: options.sessionId
    });
  } catch (error) {
    // Search analytics must never fail customer-facing search.
    console.error("Failed to log search analytics", error);
  }
}
