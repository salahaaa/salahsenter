export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { runSelfHealing } from "@/lib/admin/platform-protection-center";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  action: z.enum(["run_health_checks", "retry_failed_jobs", "release_stuck_jobs", "cleanup_cache", "enable_emergency_mode"])
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    const payload = schema.parse(await request.json());
    const result = await runSelfHealing(payload.action, session.userId);
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "security_self_healing", entityId: payload.action, afterData: result });
    return ok({ ...result, action: payload.action });
  } catch (error) {
    return handleApiError(error, "تعذر تنفيذ إجراء الإصلاح الذاتي");
  }
}
