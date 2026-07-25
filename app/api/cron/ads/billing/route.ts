export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { handleApiError, ok } from "@/lib/api";
import { getCronAuthorizationStatus } from "@/lib/cron/auth";
import { issueAdInvoicesForDay } from "@/lib/ads/billing";

/** Issues yesterday's accrued ad-ledger lines; safe to replay due to source_key. */
export async function GET(request: Request) {
  try {
    const auth = getCronAuthorizationStatus(request);
    if (!auth.ok) return new Response(JSON.stringify({ success: false, message: auth.message }), { status: auth.status, headers: { "Content-Type": "application/json" } });
    const limit = Number(new URL(request.url).searchParams.get("limit") || 100);
    return ok(await issueAdInvoicesForDay({ limit }));
  } catch (error) {
    return handleApiError(error, "تعذر إصدار فواتير الإعلانات الدورية");
  }
}
