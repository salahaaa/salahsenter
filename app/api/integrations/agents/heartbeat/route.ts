export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { db, integrationAgentDevices } from "@/lib/db";
import { assertStoreAllowed, authenticateIntegrationRequest, IntegrationAuthError } from "@/lib/integrations/accounting/auth";
import { assertAgentOnboardingAccess } from "@/lib/integrations/erp/agent-access";
import { markErpRequestAgentConnected } from "@/lib/integrations/erp/onboarding";

const schema = z.object({
  deviceId: z.string().min(8).max(160),
  deviceName: z.string().max(180).optional(),
  storeId: z.string().uuid().optional().nullable(),
  agentVersion: z.string().max(80).optional(),
  os: z.string().max(120).optional(),
  connectorType: z.string().max(80).optional(),
  connectorStatus: z.enum(["ok", "warning", "error", "offline"]).default("ok"),
  lastSuccessfulSyncAt: z.string().optional().nullable(),
  pendingOutbox: z.coerce.number().int().min(0).default(0),
  failedItems: z.coerce.number().int().min(0).default(0),
  currentOperation: z.string().max(180).optional(),
  metrics: z.record(z.unknown()).default({})
});

export async function POST(request: Request) {
  try {
    const context = await authenticateIntegrationRequest(request);
    const payload = schema.parse(await request.json());
    if (payload.storeId) { assertStoreAllowed(context, payload.storeId); await assertAgentOnboardingAccess(context, payload.storeId); await markErpRequestAgentConnected({ clientKey: context.clientId, storeId: payload.storeId, deviceId: payload.deviceId }); }
    const now = new Date();
    const status = payload.connectorStatus === "error" ? "degraded" : payload.connectorStatus === "offline" ? "offline" : "online";
    const heartbeat = {
      connectorStatus: payload.connectorStatus,
      lastSuccessfulSyncAt: payload.lastSuccessfulSyncAt || null,
      pendingOutbox: payload.pendingOutbox,
      failedItems: payload.failedItems,
      currentOperation: payload.currentOperation || null,
      metrics: payload.metrics,
      at: now.toISOString()
    };

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
        status,
        lastSeenAt: now,
        lastHeartbeat: heartbeat
      })
      .onConflictDoUpdate({
        target: [integrationAgentDevices.clientKey, integrationAgentDevices.deviceId],
        set: {
          deviceName: payload.deviceName,
          storeId: payload.storeId || null,
          agentVersion: payload.agentVersion,
          os: payload.os,
          connectorType: payload.connectorType,
          status,
          lastSeenAt: now,
          lastHeartbeat: heartbeat,
          updatedAt: now
        }
      })
      .returning();

    return ok({ accepted: true, serverTime: now.toISOString(), agent: { id: device.id, status: device.status }, recommendedNextHeartbeatSeconds: payload.failedItems ? 30 : 60 });
  } catch (error) {
    if (error instanceof IntegrationAuthError) return fail(error.message, error.status);
    return handleApiError(error, "تعذر تسجيل نبضة Local Sync Agent");
  }
}
