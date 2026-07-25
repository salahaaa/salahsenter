export const dynamic = "force-dynamic";

import { and, desc, eq, isNull } from "drizzle-orm";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth, revokeAllUserSessions } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db, userSessions } from "@/lib/db";

export async function GET() {
  try {
    const session = await requireAuth();
    const rows = await db
      .select({
        id: userSessions.id,
        deviceId: userSessions.deviceId,
        ipAddress: userSessions.ipAddress,
        userAgent: userSessions.userAgent,
        createdAt: userSessions.createdAt,
        lastSeenAt: userSessions.lastSeenAt,
        expiresAt: userSessions.expiresAt
      })
      .from(userSessions)
      .where(and(eq(userSessions.userId, session.userId), isNull(userSessions.revokedAt)))
      .orderBy(desc(userSessions.lastSeenAt));
    return ok({ sessions: rows, currentSessionId: session.sessionId });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل الجلسات النشطة");
  }
}

export async function DELETE() {
  try {
    const session = await requireAuth();
    const revokedSessions = await revokeAllUserSessions(session.userId);
    await writeAuditLog({ actorId: session.userId, action: "delete", entityType: "security.sessions_revoked_self", entityId: session.userId, afterData: { revokedSessions } });
    return ok({ message: "تم تسجيل الخروج من جميع الأجهزة", revokedSessions });
  } catch (error) {
    return handleApiError(error, "تعذر تسجيل الخروج من جميع الأجهزة");
  }
}
