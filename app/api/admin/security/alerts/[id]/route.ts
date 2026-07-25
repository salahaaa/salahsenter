export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, securityAlerts } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ status: z.enum(["open", "investigating", "resolved", "ignored"]), note: z.string().optional() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    const payload = schema.parse(await request.json());
    const [before] = await db.select().from(securityAlerts).where(eq(securityAlerts.id, id)).limit(1);
    if (!before) return fail("التنبيه غير موجود", 404);
    const [alert] = await db
      .update(securityAlerts)
      .set({ status: payload.status, assignedTo: payload.status === "investigating" ? session.userId : before.assignedTo, resolvedAt: ["resolved", "ignored"].includes(payload.status) ? new Date() : null, updatedAt: new Date(), evidence: { ...(before.evidence || {}), note: payload.note || undefined } })
      .where(eq(securityAlerts.id, id))
      .returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "security_alert", entityId: id, beforeData: before, afterData: alert });
    return ok({ alert, message: "تم تحديث تنبيه الأمان" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث تنبيه الأمان");
  }
}
