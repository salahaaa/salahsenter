export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { fail, handleApiError, ok } from "@/lib/api";
import { getCronAuthorizationStatus } from "@/lib/cron/auth";
import { processAdBudgetPacing } from "@/lib/ads/budget-pacing";
import { refreshAdPerformanceReports } from "@/lib/ads/performance";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

export async function GET(request: Request) {
  try {
    const auth = getCronAuthorizationStatus(request);
    if (!auth.ok) return fail(auth.message, auth.status);
    const limit = Number(new URL(request.url).searchParams.get("limit") || 100);
    const summary = await processAdBudgetPacing(limit);
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [todayReports, yesterdayReports] = await Promise.all([
      refreshAdPerformanceReports({ date: now, limit }),
      refreshAdPerformanceReports({ date: yesterday, limit })
    ]);
    if (summary.pausedCount) await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home], paths: ["/"] });
    return ok({ summary, todayReports, yesterdayReports, message: "تمت مراجعة ميزانيات الحملات وتقارير أدائها" });
  } catch (error) {
    return handleApiError(error, "تعذر تشغيل فحص ميزانيات الإعلانات");
  }
}
