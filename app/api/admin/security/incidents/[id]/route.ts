export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, platformIncidentEvents, platformIncidents } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { writeStructuredLog } from "@/lib/admin/platform-protection-center";

const schema = z.object({
  status: z.enum(["open", "investigating", "mitigated", "resolved"]),
  note: z.string().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    const payload = schema.parse(await request.json());
    const [before] = await db.select().from(platformIncidents).where(eq(platformIncidents.id, id)).limit(1);
    if (!before) return fail("الحادث غير موجود", 404);
    const resolved = ["mitigated", "resolved"].includes(payload.status);
    const [incident] = await db
      .update(platformIncidents)
      .set({ status: payload.status, resolvedAt: resolved ? new Date() : null, updatedAt: new Date() })
      .where(eq(platformIncidents.id, id))
      .returning();
    await db.insert(platformIncidentEvents).values({ incidentId: id, type: payload.status, message: payload.note || `تم تغيير حالة الحادث إلى ${payload.status}`, actorId: session.userId, metadata: { status: payload.status } });
    await writeStructuredLog({ level: resolved ? "info" : "warn", category: "incident", service: incident.affectedService, message: `Incident ${incident.incidentKey} -> ${payload.status}`, actorId: session.userId, metadata: { incidentId: id, note: payload.note } });
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "platform_incident", entityId: id, beforeData: before, afterData: incident });
    return ok({ incident, message: "تم تحديث الحادث" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث الحادث");
  }
}
