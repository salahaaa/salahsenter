export const dynamic = "force-dynamic";

import { handleApiError, ok, fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { requeueDeadLetterJob } from "@/lib/queue/processor";
import { assertAdmin } from "@/lib/rbac";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    const job = await requeueDeadLetterJob(id);
    if (!job) return fail("وظيفة DLQ غير موجودة أو ليست في حالة dead_letter", 404);
    await writeAuditLog({ actorId: session.userId, action: "update", category: "administrative", entityType: "queue.dead_letter_requeued", entityId: job.id, afterData: job });
    return ok({ job, message: "تمت إعادة وظيفة DLQ إلى الطابور" });
  } catch (error) {
    return handleApiError(error, "تعذر إعادة وظيفة DLQ");
  }
}
