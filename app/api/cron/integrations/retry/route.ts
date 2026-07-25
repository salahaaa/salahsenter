export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { fail, handleApiError, ok } from "@/lib/api";
import { getCronAuthorizationStatus } from "@/lib/cron/auth";
import { processIntegrationRetryQueue } from "@/lib/integrations/accounting/reliability";

export async function GET(request: Request) {
  try {
    const auth = getCronAuthorizationStatus(request);
    if (!auth.ok) return fail(auth.message, auth.status);
    const limit = Number(new URL(request.url).searchParams.get("limit") || 25);
    return ok(await processIntegrationRetryQueue(limit));
  } catch (error) {
    return handleApiError(error, "تعذر معالجة Retry Queue للتكاملات");
  }
}
