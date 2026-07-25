export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { clearSessionCookie, requireAuth, revokeUserSessions } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db, users } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";

/** Emergency administrative session revocation for a user/account. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "users.manage");
    const [target] = await db.select({ id: users.id, email: users.email, status: users.status }).from(users).where(eq(users.id, id)).limit(1);
    if (!target) return fail("المستخدم غير موجود", 404);

    const revokedSessions = await revokeUserSessions(target.id);
    if (target.id === session.userId) await clearSessionCookie();
    await writeAuditLog({
      actorId: session.userId,
      action: "delete",
      entityType: "security.admin_sessions_revoked",
      entityId: target.id,
      afterData: { targetEmail: target.email, targetStatus: target.status, revokedSessions, selfRevocation: target.id === session.userId }
    });
    return ok({ revokedSessions, message: "تم إلغاء جميع الجلسات النشطة للمستخدم" });
  } catch (error) {
    return handleApiError(error, "تعذر إلغاء جلسات المستخدم");
  }
}
