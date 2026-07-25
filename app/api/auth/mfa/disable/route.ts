export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasRole, requireAuth, verifyPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db, userMfaSettings, users } from "@/lib/db";
import { verifyTotp } from "@/lib/mfa";
import { checkIpRateLimit } from "@/lib/rate-limit";

const schema = z.object({ password: z.string().min(1), token: z.string().regex(/^\d{6}$/, "رمز MFA يجب أن يكون 6 أرقام") });

/** Disabling MFA requires password + current TOTP (step-up authentication). */
export async function POST(request: Request) {
  try {
    const rate = await checkIpRateLimit("auth:mfa-disable", 5, 15 * 60 * 1000);
    if (!rate.allowed) return fail("محاولات كثيرة، حاول لاحقاً", 429);
    const session = await requireAuth();
    if (!hasRole(session, "super_admin")) return fail("المصادقة الثنائية للمدراء فقط", 403);
    const payload = schema.parse(await request.json());
    const [[user], [settings]] = await Promise.all([
      db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, session.userId)).limit(1),
      db.select().from(userMfaSettings).where(and(eq(userMfaSettings.userId, session.userId), eq(userMfaSettings.isTotpEnabled, true))).limit(1)
    ]);
    if (!user || !settings?.totpSecret) return fail("لا توجد مصادقة ثنائية مفعلة لهذا الحساب", 409);
    if (!(await verifyPassword(payload.password, user.passwordHash))) return fail("كلمة المرور غير صحيحة", 401);
    if (!verifyTotp(payload.token, settings.totpSecret)) return fail("رمز المصادقة الثنائية غير صحيح", 401);

    await db.update(userMfaSettings).set({ isTotpEnabled: false, updatedAt: new Date() }).where(eq(userMfaSettings.userId, session.userId));
    await writeAuditLog({ actorId: session.userId, action: "update", category: "security", entityType: "security.mfa_disabled", entityId: session.userId });
    return ok({ message: "تم تعطيل المصادقة الثنائية بعد التحقق الإضافي" });
  } catch (error) {
    return handleApiError(error, "تعذر تعطيل المصادقة الثنائية");
  }
}
