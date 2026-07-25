import { and, eq, inArray } from "drizzle-orm";
import { getMerchantIntegrationSettings } from "@/lib/commerce/financial-strategy";
import { db, erpIntegrationRequests, integrationClients } from "@/lib/db";
import { IntegrationAuthError, type IntegrationAuthContext } from "@/lib/integrations/accounting/auth";

/** Local agents may move production data only after an admin certified and explicitly opened ERP mode. */
export async function assertAgentStoreEnabled(context: IntegrationAuthContext, storeId: string) {
  const settings = await getMerchantIntegrationSettings(storeId);
  if (!settings.integrationEnabled || settings.integrationMode !== "ERP" || settings.erpAccess !== "admin_enabled") {
    throw new IntegrationAuthError("ERP Mode غير مفتوح من الإدارة لهذا المتجر", 403);
  }
  if (settings.integrationClientKey && settings.integrationClientKey !== context.clientId) {
    throw new IntegrationAuthError("عميل التكامل لا يطابق الموصل المعتمد للمتجر", 403);
  }
  return settings;
}

/**
 * Narrow pre-activation access for onboarding: allows only agent registration,
 * heartbeat and mapping-readiness reporting. It must never be used by order,
 * invoice, inventory or payment data APIs before ERP mode activation.
 */
export async function assertAgentOnboardingAccess(context: IntegrationAuthContext, storeId: string) {
  try {
    return { kind: "active" as const, settings: await assertAgentStoreEnabled(context, storeId) };
  } catch (error) {
    if (!(error instanceof IntegrationAuthError) || error.status !== 403) throw error;
  }
  const [row] = await db
    .select({ request: erpIntegrationRequests, clientKey: integrationClients.clientKey })
    .from(erpIntegrationRequests)
    .innerJoin(integrationClients, eq(erpIntegrationRequests.integrationClientId, integrationClients.id))
    .where(and(
      eq(erpIntegrationRequests.storeId, storeId),
      eq(integrationClients.clientKey, context.clientId),
      inArray(erpIntegrationRequests.status, ["approved_for_setup", "agent_connected", "mapping_in_progress", "ready_for_certification"])
    ))
    .limit(1);
  if (!row) throw new IntegrationAuthError("لا يوجد طلب إعداد ERP معتمد لهذا المتجر وعميل التكامل", 403);
  return { kind: "onboarding" as const, request: row.request };
}
