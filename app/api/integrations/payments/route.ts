export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { fail, handleApiError, ok } from "@/lib/api";
import { authenticateIntegrationRequest, IntegrationAuthError } from "@/lib/integrations/accounting/auth";
import { accountingPushEnvelopeSchema } from "@/lib/integrations/accounting/dtos";
import { enqueueAccountingPush } from "@/lib/integrations/accounting/service";

export async function POST(request: Request) {
  try {
    const context = await authenticateIntegrationRequest(request, "invoices:write");
    const payload = accountingPushEnvelopeSchema.parse(await request.json());
    const result = await enqueueAccountingPush({ context, entityType: "payments", eventType: "payment.updated", payload, idempotencyKey: payload.idempotencyKey || request.headers.get("idempotency-key") || payload.batchId });
    return ok({ accepted: true, result, message: "تم قبول تحديثات المدفوعات من ERP" }, { status: 202 });
  } catch (error) {
    if (error instanceof IntegrationAuthError) return fail(error.message, error.status);
    return handleApiError(error, "تعذر قبول تحديثات المدفوعات من ERP");
  }
}
