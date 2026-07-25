export const dynamic = "force-dynamic";

import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, erpConflictCases } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const patchSchema = z.object({ id: z.string().uuid(), action: z.enum(["assign", "resolve_platform", "resolve_external", "ignore"]), assignedTo: z.string().uuid().optional().nullable(), note: z.string().max(2_000).optional().nullable() });

export async function GET(request: Request) {
  try {
    const session = await requireAuth(); await assertAdminOperation(session, "system.erp.manage");
    const status = new URL(request.url).searchParams.get("status") || "open";
    const cases = await db.select().from(erpConflictCases).where(["open", "assigned", "resolved", "ignored"].includes(status) ? eq(erpConflictCases.status, status) : inArray(erpConflictCases.status, ["open", "assigned"])).orderBy(desc(erpConflictCases.createdAt)).limit(200);
    return ok({ conflicts: cases });
  } catch (error) { return handleApiError(error, "تعذر تحميل حالات تعارض ERP"); }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth(); await assertAdminOperation(session, "system.erp.manage");
    const payload = patchSchema.parse(await request.json());
    const [before] = await db.select().from(erpConflictCases).where(eq(erpConflictCases.id, payload.id)).limit(1);
    if (!before) return fail("حالة التعارض غير موجودة", 404);
    const isResolution = payload.action !== "assign";
    const status = payload.action === "assign" ? "assigned" : payload.action === "ignore" ? "ignored" : "resolved";
    const [conflict] = await db.update(erpConflictCases).set({ status, assignedTo: payload.action === "assign" ? payload.assignedTo || null : before.assignedTo, resolvedBy: isResolution ? session.userId : null, resolvedAt: isResolution ? new Date() : null, resolution: { action: payload.action, note: payload.note || null, resolvedBy: isResolution ? session.userId : null }, updatedAt: new Date() }).where(and(eq(erpConflictCases.id, payload.id), inArray(erpConflictCases.status, ["open", "assigned"]))).returning();
    if (!conflict) return fail("تمت معالجة حالة التعارض مسبقاً", 409);
    await writeAuditLog({ actorId: session.userId, action: "update", category: "administrative", entityType: "erp.conflict_case", entityId: conflict.id, beforeData: before, afterData: conflict });
    return ok({ conflict, message: "تم تحديث قرار تعارض ERP" });
  } catch (error) { return handleApiError(error, "تعذر تحديث حالة تعارض ERP"); }
}
