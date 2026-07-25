export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { cachedSmartSearch } from "@/lib/search/cache";
import { checkIpRateLimit } from "@/lib/rate-limit";
import { buildSearchFallback } from "@/lib/search/fallback";

export async function GET(request: NextRequest) {
  try {
    const rate = await checkIpRateLimit("search:smart", 120, 60 * 1000);
    if (!rate.allowed) return fail("طلبات بحث كثيرة، حاول بعد قليل", 429);
    const query = request.nextUrl.searchParams.get("q") || "";
    const limit = Number(request.nextUrl.searchParams.get("limit") || 8);
    const result = await cachedSmartSearch(query, limit);
    return ok(result);
  } catch (error) {
    console.error("smart search degraded", error);
    const url = new URL(request.url);
    return ok(buildSearchFallback(url.searchParams.get("q") || "", { engine: "degraded-smart" }));
  }
}
