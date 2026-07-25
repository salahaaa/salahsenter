export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { fail, handleApiError, ok } from "@/lib/api";
import { getCronAuthorizationStatus } from "@/lib/cron/auth";
import { processScheduledReports } from "@/lib/reports/scheduled";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const authorization = getCronAuthorizationStatus(request);
    if (!authorization.ok) return fail(authorization.message, authorization.status);
    const result = await processScheduledReports(Number(new URL(request.url).searchParams.get("limit") || 25));
    await writeAuditLog({ action: "create", category: "financial", entityType: "system.scheduled_reports", afterData: result });
    return ok({ result, message: "تمت معالجة التقارير المجدولة" });
  } catch (error) { return handleApiError(error, "تعذر تشغيل التقارير المجدولة"); }
}
