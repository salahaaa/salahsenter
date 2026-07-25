import { analyzeSmartQuery } from "@/lib/smart-search";

export function buildSearchFallback(query: string, extra: Record<string, unknown> = {}) {
  const intent = analyzeSmartQuery(query || "");
  return {
    query: query || "",
    correctedQuery: intent.correctedQuery,
    normalizedQuery: intent.normalizedQuery,
    intent,
    suggestions: intent.semanticLabels.length ? intent.semanticLabels : ["جرّب كلمات بحث أخرى"],
    products: [],
    stores: [],
    wings: [],
    categories: [],
    degraded: true,
    ...extra
  };
}
