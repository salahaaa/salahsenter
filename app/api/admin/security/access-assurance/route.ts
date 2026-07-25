export const dynamic = "force-dynamic";

import { and, eq, isNull, gt, sql } from "drizzle-orm";
import { handleApiError, ok } from "@/lib/api";
import { hasRole, requireAuth } from "@/lib/auth";
import { db, userMfaSettings, userSessions } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    const [[mfa], [sessions]] = await Promise.all([
      db.select({ enabled: userMfaSettings.isTotpEnabled, lastVerifiedAt: userMfaSettings.lastVerifiedAt }).from(userMfaSettings).where(eq(userMfaSettings.userId, session.userId)).limit(1),
      db.select({ count: sql<number>`count(*)::int` }).from(userSessions).where(and(eq(userSessions.userId, session.userId), isNull(userSessions.revokedAt), gt(userSessions.expiresAt, new Date())))
    ]);
    return ok({ mfaEnabled: Boolean(mfa?.enabled), lastVerifiedAt: mfa?.lastVerifiedAt || null, activeSessions: Number(sessions?.count || 0), canEnrollMfa: hasRole(session, "super_admin"), enforced: false, message: "MFA اختيارية حالياً وفق سياسة الإدارة؛ لا تمنع العمل عند عدم تفعيلها." });
  } catch (error) { return handleApiError(error, "تعذر تحميل وضع وصول الأدمن"); }
}
