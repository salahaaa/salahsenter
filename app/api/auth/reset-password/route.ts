export const dynamic = "force-dynamic";

import { and, eq, gt, isNull } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { db, notifications, passwordResetTokens, users } from "@/lib/db";
import { resetPasswordSchema } from "@/lib/validators";
import { hashPassword, revokeUserSessions } from "@/lib/auth";
import { sha256 } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const payload = resetPasswordSchema.parse(await request.json());
    const [tokenRow] = await db
      .select()
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.tokenHash, sha256(payload.token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date())))
      .limit(1);

    if (!tokenRow) return fail("رابط الاستعادة غير صالح أو منتهي", 400);

    const passwordHash = await hashPassword(payload.password);
    const revokedSessions = await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash, mustChangePassword: false, updatedAt: new Date() }).where(eq(users.id, tokenRow.userId));
      await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, tokenRow.id));
      const revoked = await revokeUserSessions(tokenRow.userId, { tx });
      await tx.insert(notifications).values({
        userId: tokenRow.userId,
        title: "تم تغيير كلمة المرور",
        body: "تم تغيير كلمة المرور بنجاح وتم تسجيل الخروج من جميع الأجهزة. إذا لم تكن أنت من قام بذلك، تواصل مع الإدارة فوراً.",
        type: "password_reset_completed",
        data: { tokenId: tokenRow.id, revokedSessions: revoked }
      });
      return revoked;
    });

    await writeAuditLog({ actorId: tokenRow.userId, action: "update", entityType: "security.password_reset", entityId: tokenRow.userId, afterData: { tokenId: tokenRow.id, revokedSessions } });
    return ok({ message: "تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن." });
  } catch (error) {
    return handleApiError(error, "تعذر تغيير كلمة المرور");
  }
}
