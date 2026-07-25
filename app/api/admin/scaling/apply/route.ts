export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { applyAutoScalingDecision } from "@/lib/scaling/auto-scaling-intelligence";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ mode: z.enum(["manual", "dry_run"]).default("manual") });

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    const payload = schema.parse(await request.json().catch(() => ({})));
    const result = await applyAutoScalingDecision({ actorId: session.userId, mode: payload.mode });
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "auto_scaling_decision", entityId: payload.mode, afterData: { message: result.message, providerResponse: result.providerResponse, decision: result.snapshot.decision } });
    return ok(result);
  } catch (error) {
    return handleApiError(error, "تعذر تطبيق قرار Auto Scaling");
  }
}
