export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { fail, handleApiError, ok } from "@/lib/api";
import { authenticateIntegrationRequest, IntegrationAuthError } from "@/lib/integrations/accounting/auth";
import { getIntegrationEventsForAccounting } from "@/lib/integrations/accounting/service";

function query(request: Request) {
  const url = new URL(request.url);
  return {
    storeId: url.searchParams.get("storeId"),
    since: url.searchParams.get("since"),
    cursor: url.searchParams.get("cursor"),
    status: url.searchParams.get("status") || "pending",
    limit: Number(url.searchParams.get("limit") || 100)
  };
}

export async function GET(request: Request) {
  try {
    const context = await authenticateIntegrationRequest(request, "events:read");
    return ok({ apiVersion: "2026-07-06.accounting.v1", resource: "events", ...(await getIntegrationEventsForAccounting(context, query(request))) });
  } catch (error) {
    if (error instanceof IntegrationAuthError) return fail(error.message, error.status);
    return handleApiError(error, "تعذر تحميل أحداث التكامل المحاسبي");
  }
}
