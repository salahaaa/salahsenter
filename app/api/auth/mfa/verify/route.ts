export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { createSessionForUser, getCurrentSession, hasRole, requireAuth } from "@/lib/auth";
import { db, userMfaSettings } from "@/lib/db";
import { verifyBackupCode, verifyMfaChallenge, verifyTotp } from "@/lib/mfa";
import { checkIpRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  token: z.string().min(4).max(64),
  challengeToken: z.string().optional(),
  mode: z.enum(["setup", "login"]).default("login")
});

export async function POST(request: Request) {
  try {
    const rate = await checkIpRateLimit("auth:mfa-verify", 10, 15 * 60 * 1000);
    if (!rate.allowed) return fail("محاولات كثيرة للتحقق من MFA، حاول لاحقاً", 429);
    const payload = schema.parse(await request.json());
    const userId = payload.mode === "setup" ? (await requireAuth()).userId : await verifyMfaChallenge(payload.challengeToken || "");
    const [settings] = await db.select().from(userMfaSettings).where(eq(userMfaSettings.userId, userId)).limit(1);
    if (!settings?.totpSecret) return fail("لم يتم إعداد المصادقة الثنائية لهذا الحساب", 404);

    const isTotpValid = verifyTotp(payload.token, settings.totpSecret);
    let usedBackupHash: string | null = null;
    if (!isTotpValid && settings.isTotpEnabled) {
      usedBackupHash = await verifyBackupCode(payload.token, settings.backupCodeHashes || []);
    }
    if (!isTotpValid && !usedBackupHash) return fail("رمز المصادقة الثنائية غير صحيح", 401);

    const nextBackupHashes = usedBackupHash ? (settings.backupCodeHashes || []).filter((hash) => hash !== usedBackupHash) : settings.backupCodeHashes;
    await db
      .update(userMfaSettings)
      .set({ isTotpEnabled: true, backupCodeHashes: nextBackupHashes, lastVerifiedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(userMfaSettings.userId, userId), eq(userMfaSettings.id, settings.id)));

    if (payload.mode === "setup") {
      const session = await getCurrentSession();
      if (!hasRole(session, "super_admin")) return fail("هذه الميزة للمدراء فقط", 403);
      await writeAuditLog({ actorId: userId, action: "update", category: "security", entityType: "security.mfa_enabled", entityId: userId });
      return ok({ message: "تم تفعيل المصادقة الثنائية بنجاح" });
    }

    const session = await createSessionForUser(userId);
    await writeAuditLog({ actorId: userId, action: "login", category: "security", entityType: "security.mfa_login_verified", entityId: userId });
    return ok({ session, message: "تم تسجيل الدخول بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر التحقق من رمز المصادقة الثنائية");
  }
}
