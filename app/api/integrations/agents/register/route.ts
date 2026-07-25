export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { db, integrationAgentDevices } from "@/lib/db";
import { assertStoreAllowed, authenticateIntegrationRequest, IntegrationAuthError } from "@/lib/integrations/accounting/auth";
import { assertAgentOnboardingAccess } from "@/lib/integrations/erp/agent-access";
import { markErpRequestAgentConnected } from "@/lib/integrations/erp/onboarding";
import { INTEGRATION_API_VERSION } from "@/lib/integrations/accounting/dtos";

const schema = z.object({
  deviceId: z.string().min(8).max(160),
  deviceName: z.string().max(180).optional(),
  storeId: z.string().uuid().optional().nullable(),
  agentVersion: z.string().max(80).optional(),
  os: z.string().max(120).optional(),
  connectorType: z.enum(["sql_server", "access", "odbc", "csv_excel", "pos", "erp", "other"]).default("other"),
  capabilities: z.record(z.unknown()).default({})
});

export async function POST(request: Request) {
  try {
    const context = await authenticateIntegrationRequest(request);
    const payload = schema.parse(await request.json());
    if (payload.storeId) { assertStoreAllowed(context, payload.storeId); await assertAgentOnboardingAccess(context, payload.storeId); await markErpRequestAgentConnected({ clientKey: context.clientId, storeId: payload.storeId, deviceId: payload.deviceId }); }
    const now = new Date();
    const [device] = await db
      .insert(integrationAgentDevices)
      .values({
        clientKey: context.clientId,
        deviceId: payload.deviceId,
        deviceName: payload.deviceName,
        storeId: payload.storeId || null,
        agentVersion: payload.agentVersion,
        os: payload.os,
        connectorType: payload.connectorType,
        capabilities: payload.capabilities,
        status: "online",
        lastSeenAt: now,
        lastHeartbeat: { registered: true, at: now.toISOString() }
      })
      .onConflictDoUpdate({
        target: [integrationAgentDevices.clientKey, integrationAgentDevices.deviceId],
        set: {
          deviceName: payload.deviceName,
          storeId: payload.storeId || null,
          agentVersion: payload.agentVersion,
          os: payload.os,
          connectorType: payload.connectorType,
          capabilities: payload.capabilities,
          status: "online",
          lastSeenAt: now,
          lastHeartbeat: { registered: true, at: now.toISOString() },
          updatedAt: now
        }
      })
      .returning();

    return ok({
      apiVersion: INTEGRATION_API_VERSION,
      registered: true,
      agent: { id: device.id, deviceId: device.deviceId, clientKey: device.clientKey, storeId: device.storeId, status: device.status },
      serverTime: now.toISOString(),
      message: "تم تسجيل Local Sync Agent بنجاح"
    }, { status: 201 });
  } catch (error) {
    if (error instanceof IntegrationAuthError) return fail(error.message, error.status);
    return handleApiError(error, "تعذر تسجيل Local Sync Agent");
  }
}
