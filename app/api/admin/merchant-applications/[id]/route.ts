export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, merchantApplications } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { merchantApplicationStatusSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";

/**
 * Compatibility endpoint intentionally limited to administrative notes. All
 * status transitions must use /review or /approve to preserve the state machine.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const session = await requireAuth();
    await assertAdmin(session, "merchant_applications.manage");
    const payload = merchantApplicationStatusSchema.parse(await request.json());
    const [before] = await db.select().from(merchantApplications).where(eq(merchantApplications.id, id)).limit(1);
    if (!before) return fail("طلب فتح المتجر غير موجود", 404);
    const [application] = await db.update(merchantApplications).set({ adminNote: payload.adminNote || before.adminNote, reviewedBy: session.userId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(merchantApplications.id, id)).returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "merchant_application_note", entityId: id, beforeData: { adminNote: before.adminNote, status: before.status }, afterData: { adminNote: application.adminNote, status: application.status } });
    return ok({ application, message: "تم تحديث ملاحظة الإدارة. تغيير الحالة يمر فقط عبر دورة المراجعة والاعتماد." });
  } catch (error) { return handleApiError(error, "تعذر تحديث ملاحظة طلب التاجر"); }
}
