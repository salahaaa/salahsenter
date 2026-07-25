export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { db, integrationEvents } from "@/lib/db";
import { assertStoreAllowed, authenticateIntegrationRequest, IntegrationAuthError } from "@/lib/integrations/accounting/auth";

const schema = z.object({
  eventIds: z.array(z.string().uuid()).min(1).max(200),
  status: z.enum(["processed", "failed", "retry"]).default("processed"),
  error: z.string().max(2000).optional(),
  agentBatchId: z.string().max(180).optional()
});

export async function POST(request: Request) {
  try {
    const context = await authenticateIntegrationRequest(request, "events:write");
    const payload = schema.parse(await request.json());
    const rows = await db.select({ id: integrationEvents.id, storeId: integrationEvents.storeId }).from(integrationEvents).where(inArray(integrationEvents.id, payload.eventIds));
    for (const row of rows) assertStoreAllowed(context, row.storeId);
    const now = new Date();
    const nextStatus = payload.status === "retry" ? "pending" : payload.status;
    const updated = rows.length
      ? await db
          .update(integrationEvents)
          .set({
            status: nextStatus,
            processedAt: payload.status === "processed" ? now : null,
            lastError: payload.status === "failed" ? payload.error || "Agent reported failure" : null,
            payload: sql`${integrationEvents.payload} || ${JSON.stringify({ acknowledgement: { by: context.clientId, agentBatchId: payload.agentBatchId || null, status: payload.status, at: now.toISOString() } })}::jsonb`,
            updatedAt: now
          })
          .where(inArray(integrationEvents.id, rows.map((row) => row.id)))
          .returning({ id: integrationEvents.id })
      : [];

    return ok({ acknowledged: updated.length, missing: payload.eventIds.length - rows.length, status: nextStatus, serverTime: now.toISOString() });
  } catch (error) {
    if (error instanceof IntegrationAuthError) return fail(error.message, error.status);
    return handleApiError(error, "تعذر تأكيد أحداث التكامل");
  }
}
