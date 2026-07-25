export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { fail, handleApiError, ok } from "@/lib/api";
import { authenticateIntegrationRequest, IntegrationAuthError } from "@/lib/integrations/accounting/auth";
import { INTEGRATION_API_VERSION } from "@/lib/integrations/accounting/dtos";

export async function GET(request: Request) {
  try {
    const context = await authenticateIntegrationRequest(request);
    return ok({
      status: "ok",
      apiVersion: INTEGRATION_API_VERSION,
      architecture: "API ↔ Integration Layer ↔ Local Sync Agent",
      client: { id: context.clientId, name: context.name, provider: context.provider, source: context.source, scopes: context.scopes, storeScope: context.storeIds.length ? "restricted" : "all" },
      resources: ["products", "inventory", "orders", "invoices", "payments", "events", "onboarding_mapping", "sales_reports"],
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof IntegrationAuthError) return fail(error.message, error.status);
    return handleApiError(error, "تعذر فحص طبقة التكامل");
  }
}
