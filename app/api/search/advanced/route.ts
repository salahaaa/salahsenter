export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { cachedAdvancedSearch } from "@/lib/search/cache";
import { checkIpRateLimit } from "@/lib/rate-limit";
import { buildSearchFallback } from "@/lib/search/fallback";
import { getSponsoredProductsForPlacement } from "@/lib/ads/marketplace";

export async function GET(request: NextRequest) {
  try {
    const source = request.nextUrl.searchParams.get("source") || "advanced_search";
    const limit = Number(request.nextUrl.searchParams.get("limit") || 10);
    const query = request.nextUrl.searchParams.get("q") || "";
    const rateLimit = source === "instant_search" ? 180 : 90;
    const rate = await checkIpRateLimit(`search:${source}`, rateLimit, 60 * 1000);
    if (!rate.allowed) return fail("طلبات بحث كثيرة، حاول بعد قليل", 429);
    const [result, sponsoredProducts] = await Promise.all([
      cachedAdvancedSearch({ query, limit, source }),
      query.trim().length >= 2 ? getSponsoredProductsForPlacement({ placement: "search_results", limit: Math.min(3, Math.max(1, limit)), query }) : Promise.resolve([])
    ]);
    return ok({
      ...result,
      sponsoredProducts: sponsoredProducts.map((product) => ({
        ...product,
        type: "product" as const,
        href: `/store/${product.storeSlug}/products/${product.slug}`,
        price: product.basePrice,
        categoryName: null,
        wingName: null,
        matchReason: "إعلان ممول مطابق للبحث"
      }))
    });
  } catch (error) {
    console.error("advanced search degraded", error);
    const url = new URL(request.url);
    return ok(buildSearchFallback(url.searchParams.get("q") || "", { engine: "degraded-advanced" }));
  }
}
