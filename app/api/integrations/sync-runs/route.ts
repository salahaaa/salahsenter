export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { db, integrationSyncRuns } from "@/lib/db";
import { assertStoreAllowed, authenticateIntegrationRequest, IntegrationAuthError } from "@/lib/integrations/accounting/auth";

const startSchema = z.object({
  action: z.literal("start"),
  deviceId: z.string().max(160).optional(),
  storeId: z.string().uuid().optional().nullable(),
  resource: z.enum(["products", "inventory", "orders", "invoices", "returns", "events"]),
  direction: z.enum(["local_to_platform", "platform_to_local", "bidirectional"]),
  checkpoint: z.string().max(220).optional(),
  metadata: z.record(z.unknown()).default({})
});

const finishSchema = z.object({
  action: z.literal("finish"),
  runId: z.string().uuid(),
  status: z.enum(["completed", "failed", "partial"]),
  counters: z.record(z.coerce.number()).default({}),
  checkpoint: z.string().max(220).optional(),
  error: z.string().max(5000).optional()
});

const schema = z.discriminatedUnion("action", [startSchema, finishSchema]);

export async function POST(request: Request) {
  try {
    const context = await authenticateIntegrationRequest(request);
    const payload = schema.parse(await request.json());
    if (payload.action === "start") {
      if (payload.storeId) assertStoreAllowed(context, payload.storeId);
      const [run] = await db.insert(integrationSyncRuns).values({
        clientKey: context.clientId,
        deviceId: payload.deviceId,
        storeId: payload.storeId || null,
        resource: payload.resource,
        direction: payload.direction,
        status: "running",
        checkpoint: payload.checkpoint,
        metadata: payload.metadata
      }).returning();
      return ok({ runId: run.id, status: run.status, startedAt: run.startedAt.toISOString() }, { status: 201 });
    }

    const [before] = await db.select().from(integrationSyncRuns).where(eq(integrationSyncRuns.id, payload.runId)).limit(1);
    if (!before) return fail("Sync run غير موجود", 404);
    assertStoreAllowed(context, before.storeId);
    const [run] = await db.update(integrationSyncRuns).set({
      status: payload.status,
      counters: payload.counters,
      checkpoint: payload.checkpoint || before.checkpoint,
      error: payload.error,
      finishedAt: new Date()
    }).where(eq(integrationSyncRuns.id, payload.runId)).returning();
    return ok({ runId: run.id, status: run.status, finishedAt: run.finishedAt?.toISOString() });
  } catch (error) {
    if (error instanceof IntegrationAuthError) return fail(error.message, error.status);
    return handleApiError(error, "تعذر تسجيل Sync Run");
  }
}
