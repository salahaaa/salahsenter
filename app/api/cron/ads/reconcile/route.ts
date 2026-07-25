export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { handleApiError, ok } from "@/lib/api";
import { getCronAuthorizationStatus } from "@/lib/cron/auth";
import { reconcileAdFinancialState } from "@/lib/ads/reconciliation";
import { notifyAdmins } from "@/lib/notifications";

export async function GET(request: Request) {
  try {
    const auth = getCronAuthorizationStatus(request);
    if (!auth.ok) return new Response(JSON.stringify({ success: false, message: auth.message }), { status: auth.status, headers: { "Content-Type": "application/json" } });
    const limit = Number(new URL(request.url).searchParams.get("limit") || 300);
    const result = await reconcileAdFinancialState(limit);
    if (!result.ok) await notifyAdmins({ title: "تنبيه reconciliation للإعلانات", body: `تم رصد ${result.campaignMismatches.length} اختلاف حملة و${result.invoiceMismatches.length} اختلاف فاتورة. راجع منصة الإعلانات قبل أي تسوية.`, type: "admin_ads_reconciliation_mismatch", data: { campaignMismatches: result.campaignMismatches.slice(0, 20), invoiceMismatches: result.invoiceMismatches.slice(0, 20), url: "/admin/ads-platform" } });
    return ok(result);
  } catch (error) { return handleApiError(error, "تعذر تنفيذ reconciliation الإعلانات"); }
}
