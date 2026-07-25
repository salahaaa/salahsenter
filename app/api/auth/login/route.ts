export const dynamic = "force-dynamic";

import { eq, or } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { createSessionForUser, getUserSessionRoles, verifyPassword } from "@/lib/auth";
import { db, stores, userMfaSettings, users } from "@/lib/db";
import { loginSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";
import { checkIpRateLimit, checkRateLimit, progressiveDelay } from "@/lib/rate-limit";
import { signMfaChallenge } from "@/lib/mfa";

async function auditLogin(input: { actorId?: string | null; identifier: string; success: boolean; reason?: string }) {
  await writeAuditLog({
    actorId: input.actorId || null,
    action: "login",
    category: "security",
    entityType: "security.auth_login",
    entityId: input.identifier,
    afterData: { success: input.success, reason: input.reason || null }
  });
}

export async function POST(request: Request) {
  try {
    await progressiveDelay("auth:login", 6000);
    const rate = await checkIpRateLimit("auth:login", 20, 15 * 60 * 1000);
    if (!rate.allowed) return fail("محاولات كثيرة، حاول لاحقاً", 429);
    const raw = await request.json();
    const payload = loginSchema.parse({ identifier: raw.identifier || raw.email || raw.username, password: raw.password });
    const identifier = payload.identifier.trim().toLowerCase();
    let user = (await db.select().from(users).where(or(eq(users.email, identifier), eq(users.username, identifier))).limit(1))[0];

    if (!user) {
      const [store] = await db.select({ merchantId: stores.merchantId }).from(stores).where(eq(stores.storeNumber, identifier.toUpperCase())).limit(1);
      if (store) {
        [user] = await db.select().from(users).where(eq(users.id, store.merchantId)).limit(1);
      }
    }

    if (!user) {
      const failed = await checkRateLimit({ key: `auth:failed:${identifier}`, limit: 10, windowMs: 15 * 60 * 1000 });
      await auditLogin({ identifier: payload.identifier, success: false, reason: failed.allowed ? "user_not_found" : "account_lockout" });
      if (!failed.allowed) return fail("تم قفل محاولات هذا الحساب مؤقتاً بسبب محاولات دخول كثيرة", 423, { captchaRequired: true });
      return fail("بيانات الدخول غير صحيحة", 401);
    }
    if (user.status !== "active") {
      await auditLogin({ actorId: user.id, identifier: payload.identifier, success: false, reason: `status_${user.status}` });
      return fail("الحساب غير مفعّل أو موقوف", 403);
    }

    const isValid = await verifyPassword(payload.password, user.passwordHash);
    if (!isValid) {
      const failed = await checkRateLimit({ key: `auth:failed:${identifier}`, limit: 10, windowMs: 15 * 60 * 1000 });
      await auditLogin({ actorId: user.id, identifier: payload.identifier, success: false, reason: failed.allowed ? "invalid_password" : "account_lockout" });
      if (!failed.allowed) return fail("تم قفل الحساب مؤقتاً بسبب محاولات دخول فاشلة", 423, { captchaRequired: true });
      return fail("بيانات الدخول غير صحيحة", 401);
    }

    const roles = await getUserSessionRoles(user.id);
    const isAdmin = roles.some((role) => role.code === "super_admin");
    if (isAdmin) {
      const [mfa] = await db.select().from(userMfaSettings).where(eq(userMfaSettings.userId, user.id)).limit(1);
      if (mfa?.isTotpEnabled) {
        await auditLogin({ actorId: user.id, identifier: payload.identifier, success: false, reason: "mfa_required" });
        return ok({ requiresMfa: true, challengeToken: await signMfaChallenge(user.id), message: "يلزم إدخال رمز المصادقة الثنائية" });
      }
    }

    await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
    await auditLogin({ actorId: user.id, identifier: payload.identifier, success: true });
    const session = await createSessionForUser(user.id);

    return ok({ session, mustChangePassword: user.mustChangePassword });
  } catch (error) {
    return handleApiError(error, "تعذر تسجيل الدخول");
  }
}
