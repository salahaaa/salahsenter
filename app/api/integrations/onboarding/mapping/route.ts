export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { z } from "zod";
import { created, fail, handleApiError } from "@/lib/api";
import { assertStoreAllowed, authenticateIntegrationRequest, IntegrationAuthError } from "@/lib/integrations/accounting/auth";
import { assertAgentOnboardingAccess } from "@/lib/integrations/erp/agent-access";
import { recordErpOnboardingMapping } from "@/lib/integrations/erp/onboarding";

const schema = z.object({
  requestId: z.string().uuid(), storeId: z.string().uuid(),
  links: z.array(z.object({ entityType: z.enum(["product", "variant", "warehouse", "branch", "customer", "payment_method", "price_list"]), platformEntityId: z.string().max(160).optional().nullable(), externalEntityId: z.string().min(1).max(180), externalCode: z.string().max(180).optional().nullable(), metadata: z.record(z.unknown()).default({}) })).max(500).default([]),
  summary: z.object({ mappedProducts: z.coerce.number().int().min(0), unmappedProducts: z.coerce.number().int().min(0), duplicateProducts: z.coerce.number().int().min(0).default(0), warehouses: z.coerce.number().int().min(0), branches: z.coerce.number().int().min(0), note: z.string().max(1_500).optional().nullable() })
});

/** Provisional-agent endpoint. It stores mapping identities but cannot sync production inventory/orders until ERP mode is activated. */
export async function POST(request: Request) {
  try {
    const context = await authenticateIntegrationRequest(request, "events:write");
    const payload = schema.parse(await request.json());
    assertStoreAllowed(context, payload.storeId);
    await assertAgentOnboardingAccess(context, payload.storeId);
    await recordErpOnboardingMapping({ clientKey: context.clientId, ...payload });
    return created({ accepted: true, message: "تم حفظ External IDs وملخص mapping بانتظار مراجعة الإدارة" });
  } catch (error) {
    if (error instanceof IntegrationAuthError) return fail(error.message, error.status);
    return handleApiError(error, "تعذر حفظ Mapping ERP الأولي");
  }
}
