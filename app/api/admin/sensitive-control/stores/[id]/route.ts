export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { db, stores } from "@/lib/db";
import { assertEligibleSensitiveAdmin, requireSensitiveUnlock } from "@/lib/sensitive-control";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ action: z.enum(["suspend", "close"]), reason: z.string().trim().min(3).max(1_000) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    await assertEligibleSensitiveAdmin(session.userId);
    await requireSensitiveUnlock(session.userId);
    const payload = schema.parse(await request.json());
    const [before] = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
    if (!before) return fail("المتجر غير موجود", 404);
    const nextStatus = payload.action === "suspend" ? "suspended" : "closed";
    const [store] = await db.update(stores).set({ status: nextStatus, isActive: false, operationStatus: "CLOSED", operationNote: payload.reason, operationStatusUpdatedAt: new Date(), updatedAt: new Date() }).where(eq(stores.id, id)).returning();
    await writeAuditLog({ actorId: session.userId, action: "status_change", category: "administrative", entityType: "sensitive_store_operation", entityId: id, beforeData: before, afterData: { action: payload.action, reason: payload.reason, store } });
    return ok({ store, message: payload.action === "suspend" ? "تم تعليق المتجر وإيقاف عملياته العامة." : "تم إغلاق المتجر وإيقاف عملياته العامة." });
  } catch (error) { return handleApiError(error, "تعذر تنفيذ الإجراء الحساس على المتجر"); }
}
