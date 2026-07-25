export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { fail, handleApiError, ok } from "@/lib/api";
import { authenticateIntegrationRequest, IntegrationAuthError } from "@/lib/integrations/accounting/auth";
import { accountingPushEnvelopeSchema } from "@/lib/integrations/accounting/dtos";
import { enqueueAccountingPush, getOrdersForAccounting } from "@/lib/integrations/accounting/service";

function query(request: Request) {
  const url = new URL(request.url);
  return { storeId: url.searchParams.get("storeId"), since: url.searchParams.get("since"), cursor: url.searchParams.get("cursor"), limit: Number(url.searchParams.get("limit") || 100) };
}

export async function GET(request: Request) {
  try {
    const context = await authenticateIntegrationRequest(request, "orders:read");
    return ok({ apiVersion: "2026-07-06.accounting.v1", resource: "orders", ...(await getOrdersForAccounting(context, query(request))) });
  } catch (error) {
    if (error instanceof IntegrationAuthError) return fail(error.message, error.status);
    return handleApiError(error, "تعذر تحميل طلبات التكامل المحاسبي");
  }
}

export async function POST(request: Request) {
  try {
    const context = await authenticateIntegrationRequest(request, "orders:write");
    const payload = accountingPushEnvelopeSchema.parse(await request.json());
    const result = await enqueueAccountingPush({ context, entityType: "orders", eventType: "accounting.orders.push", payload, idempotencyKey: payload.idempotencyKey || request.headers.get("idempotency-key") || payload.batchId });
    return ok({ accepted: true, result, message: "تم قبول دفعة الطلبات للمعالجة الخلفية" }, { status: 202 });
  } catch (error) {
    if (error instanceof IntegrationAuthError) return fail(error.message, error.status);
    return handleApiError(error, "تعذر قبول دفعة الطلبات من النظام المحاسبي");
  }
}
