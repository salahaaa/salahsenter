export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { fail, handleApiError, ok } from "@/lib/api";
import { authenticateIntegrationRequest, IntegrationAuthError } from "@/lib/integrations/accounting/auth";
import { getMerchantIntegrationSettings } from "@/lib/commerce/financial-strategy";
import { INTEGRATION_API_VERSION } from "@/lib/integrations/accounting/dtos";

export async function GET(request: Request) {
  try {
    const context = await authenticateIntegrationRequest(request);
    const origin = new URL(request.url).origin;
    const storeModes = Object.fromEntries(await Promise.all(context.storeIds.map(async (storeId) => [storeId, await getMerchantIntegrationSettings(storeId)] as const)));
    return ok({
      apiVersion: INTEGRATION_API_VERSION,
      serverTime: new Date().toISOString(),
      client: {
        id: context.clientId,
        name: context.name,
        provider: context.provider,
        source: context.source,
        scopes: context.scopes,
        storeIds: context.storeIds,
        storeScope: context.storeIds.length ? "restricted" : "all"
      },
      storeModes,
      endpoints: {
        health: `${origin}/api/integrations/health`,
        register: `${origin}/api/integrations/agents/register`,
        heartbeat: `${origin}/api/integrations/agents/heartbeat`,
        products: `${origin}/api/integrations/products`,
        inventory: `${origin}/api/integrations/inventory`,
        orders: `${origin}/api/integrations/orders`,
        invoices: `${origin}/api/integrations/invoices`,
        payments: `${origin}/api/integrations/payments`,
        events: `${origin}/api/integrations/events`,
        eventsAck: `${origin}/api/integrations/events/ack`,
        syncRuns: `${origin}/api/integrations/sync-runs`,
        onboardingMapping: `${origin}/api/integrations/onboarding/mapping`,
        salesReports: `${origin}/api/integrations/sales-reports`
      },
      recommendedSchedule: {
        heartbeatSeconds: 60,
        inventoryPushSeconds: 300,
        productsPushSeconds: 900,
        ordersPullSeconds: 300,
        eventsPullSeconds: 120,
        maxBatchSize: 500
      }
    });
  } catch (error) {
    if (error instanceof IntegrationAuthError) return fail(error.message, error.status);
    return handleApiError(error, "تعذر تحميل إعدادات التكامل");
  }
}
