export const dynamic = "force-dynamic";

import { fail, handleApiError, ok } from "@/lib/api";
import { getCronAuthorizationStatus } from "@/lib/cron/auth";
import { createFinancialCloseRun, utcDayRange } from "@/lib/finance/close";

/** Prepares yesterday's close as draft; a human admin must review and close it. */
export async function GET(request: Request) {
  try {
    const auth = getCronAuthorizationStatus(request);
    if (!auth.ok) return fail(auth.message, auth.status);
    const range = utcDayRange();
    const run = await createFinancialCloseRun({ periodStart: range.start, periodEnd: range.end, actorId: null, note: "لقطة آلية؛ تتطلب مراجعة بشرية قبل الإقفال" });
    return ok({ run, message: "تم إعداد لقطة الإقفال المالي كمسودة" });
  } catch (error) { return handleApiError(error, "تعذر إعداد لقطة الإقفال المالي"); }
}
