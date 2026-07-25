export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { fail, handleApiError, ok } from "@/lib/api";
import { authenticateIntegrationRequest, IntegrationAuthError } from "@/lib/integrations/accounting/auth";
import { accountingPushEnvelopeSchema } from "@/lib/integrations/accounting/dtos";
import { enqueueAccountingPush, getInvoicesForAccounting } from "@/lib/integrations/accounting/service";

function query(request: Request) {
  const url = new URL(request.url);
  return { storeId: url.searchParams.get("storeId"), since: url.searchParams.get("since"), cursor: url.searchParams.get("cursor"), limit: Number(url.searchParams.get("limit") || 100) };
}

export async function GET(request: Request) {
  try {
    const context = await authenticateIntegrationRequest(request, "invoices:read");
    return ok({ apiVersion: "2026-07-06.accounting.v1", resource: "invoices", ...(await getInvoicesForAccounting(context, query(request))) });
  } catch (error) {
    if (error instanceof IntegrationAuthError) return fail(error.message, error.status);
    return handleApiError(error, "تعذر تحميل فواتير التكامل المحاسبي");
  }
}

export async function POST(request: Request) {
  try {
    const context = await authenticateIntegrationRequest(request, "invoices:write");
    const payload = accountingPushEnvelopeSchema.parse(await request.json());
    const result = await enqueueAccountingPush({ context, entityType: "invoices", eventType: "accounting.invoices.push", payload, idempotencyKey: payload.idempotencyKey || request.headers.get("idempotency-key") || payload.batchId });
    return ok({ accepted: true, result, message: "تم قبول دفعة الفواتير للمعالجة الخلفية" }, { status: 202 });
  } catch (error) {
    if (error instanceof IntegrationAuthError) return fail(error.message, error.status);
    return handleApiError(error, "تعذر قبول دفعة الفواتير من النظام المحاسبي");
  }
}
