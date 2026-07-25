export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { clearSessionCookie, hashPassword, requireAuth, revokeUserSessions, verifyPassword } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { changePasswordSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = changePasswordSchema.parse(await request.json());
    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!user) return fail("المستخدم غير موجود", 404);
    const valid = await verifyPassword(payload.currentPassword, user.passwordHash);
    if (!valid) return fail("كلمة المرور الحالية غير صحيحة", 401);
    const passwordHash = await hashPassword(payload.newPassword);
    const revokedSessions = await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash, mustChangePassword: false, updatedAt: new Date() }).where(eq(users.id, user.id));
      return revokeUserSessions(user.id, { tx });
    });
    await clearSessionCookie();
    await writeAuditLog({ actorId: user.id, action: "update", entityType: "security.password_changed", entityId: user.id, afterData: { revokedSessions } });
    return ok({ message: "تم تغيير كلمة المرور وتسجيل الخروج من جميع الأجهزة. سجّل الدخول بكلمة المرور الجديدة." });
  } catch (error) {
    return handleApiError(error, "تعذر تغيير كلمة المرور");
  }
}
