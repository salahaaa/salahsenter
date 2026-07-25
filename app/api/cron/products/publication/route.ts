export const dynamic = "force-dynamic";

import { fail, handleApiError, ok } from "@/lib/api";
import { getCronAuthorizationStatus } from "@/lib/cron/auth";
import { processProductPublicationSchedules } from "@/lib/products/lifecycle";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

export async function GET(request: Request) {
  try {
    const auth = getCronAuthorizationStatus(request);
    if (!auth.ok) return fail(auth.message, auth.status);
    const limit = Number(new URL(request.url).searchParams.get("limit") || 200);
    const result = await processProductPublicationSchedules(limit);
    if (result.changed.length) await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.products, PUBLIC_CACHE_TAGS.home], paths: ["/"] });
    return ok({ result, message: "تمت مراجعة جدولة نشر المنتجات" });
  } catch (error) {
    return handleApiError(error, "تعذر تشغيل جدولة المنتجات");
  }
}
