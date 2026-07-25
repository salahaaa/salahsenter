export const dynamic = "force-dynamic";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { assertAdmin } from "@/lib/rbac";
import { getAdminWorkQueue, getAssignableAdminUsers, updateAdminWorkAssignment } from "@/lib/admin/work-queue";

const schema = z.object({
  workKey: z.string().min(4).max(220),
  entityType: z.string().min(2).max(120),
  entityId: z.string().min(1).max(160),
  queue: z.string().min(2).max(80),
  priority: z.enum(["critical", "high", "normal", "low"]),
  status: z.enum(["open", "assigned", "resolved", "dismissed"]),
  assignedTo: z.string().uuid().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable()
});

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "admin.access");
    const url = new URL(request.url);
    const includeResolved = url.searchParams.get("includeResolved") === "true";
    const [items, assignees] = await Promise.all([getAdminWorkQueue({ includeResolved }), getAssignableAdminUsers()]);
    return ok({ items, assignees });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل طابور عمل الإدارة");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "admin.access");
    const payload = schema.parse(await request.json());
    const assignment = await updateAdminWorkAssignment({ ...payload, actorId: session.userId, dueAt: payload.dueAt ? new Date(payload.dueAt) : null });
    await writeAuditLog({ actorId: session.userId, action: "update", category: "administrative", entityType: "admin.work_assignment", entityId: assignment.id, afterData: assignment });
    return ok({ assignment, message: "تم تحديث مسؤول وحالة مهمة الإدارة" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث مهمة الإدارة");
  }
}
