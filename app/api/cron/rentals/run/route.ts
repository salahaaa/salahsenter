export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { fail, handleApiError, ok } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { getCronAuthorizationStatus } from "@/lib/cron/auth";
import { processRentalBillingCycle } from "@/lib/rentals/service";

export async function GET(request: Request) {
  try {
    const authorization = getCronAuthorizationStatus(request);
    if (!authorization.ok) return fail(authorization.message, authorization.status);
    const result = await processRentalBillingCycle(Number(new URL(request.url).searchParams.get("limit") || 100));
    await writeAuditLog({ action: "create", category: "system", entityType: "system.rental_billing_cycle", afterData: { issuedCount: result.issuedCount, overdueCount: result.overdueCount } });
    return ok({ result, message: "تمت معالجة دورة فواتير الإيجار" });
  } catch (error) {
    return handleApiError(error, "تعذر معالجة دورة إيجار المتاجر");
  }
}
