export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { fail, handleApiError, ok } from "@/lib/api";
import { db, notifications, passwordResetTokens, stores, users } from "@/lib/db";
import { forgotPasswordSchema } from "@/lib/validators";
import { checkIpRateLimit } from "@/lib/rate-limit";
import { createSecureToken, sha256 } from "@/lib/security";
import { sendOptionalActivationMessages } from "@/lib/outbound";
import { writeAuditLog } from "@/lib/audit";

async function findUserByIdentifier(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  let [user] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  if (user) return user;

  const [store] = await db.select({ merchantId: stores.merchantId }).from(stores).where(eq(stores.storeNumber, identifier.trim().toUpperCase())).limit(1);
  if (store) {
    [user] = await db.select().from(users).where(eq(users.id, store.merchantId)).limit(1);
  }
  return user || null;
}

export async function POST(request: Request) {
  try {
    const rate = await checkIpRateLimit("auth:forgot-password", 5, 15 * 60 * 1000);
    if (!rate.allowed) return fail("محاولات كثيرة، حاول لاحقاً", 429);

    const payload = forgotPasswordSchema.parse(await request.json());
    const user = await findUserByIdentifier(payload.identifier);

    // Always return success to avoid account enumeration.
    if (!user || user.status !== "active") {
      await writeAuditLog({ action: "create", entityType: "password_reset_request", entityId: payload.identifier, afterData: { success: false, reason: "not_found_or_inactive" } });
      return ok({ message: "إذا كانت البيانات صحيحة فسيتم إرسال رابط استعادة كلمة المرور." });
    }

    const token = createSecureToken("reset");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const h = await headers();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const resetUrl = `${appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: sha256(token),
      identifier: payload.identifier,
      expiresAt,
      ipAddress: h.get("x-forwarded-for") || h.get("x-real-ip") || null,
      userAgent: h.get("user-agent") || null
    });

    await db.insert(notifications).values({
      userId: user.id,
      title: "طلب استعادة كلمة المرور",
      body: `تم إنشاء رابط استعادة كلمة المرور. الرابط صالح حتى ${expiresAt.toISOString()}`,
      type: "password_reset_requested",
      data: { resetUrl, expiresAt: expiresAt.toISOString() }
    });

    await sendOptionalActivationMessages({
      email: user.email,
      phone: user.phone,
      subject: "استعادة كلمة المرور",
      message: `رابط استعادة كلمة المرور: ${resetUrl}`
    });

    await writeAuditLog({ actorId: user.id, action: "create", entityType: "password_reset_request", entityId: user.id, afterData: { success: true, expiresAt: expiresAt.toISOString() } });
    const canReturnResetUrl = process.env.NODE_ENV !== "production" || process.env.ALLOW_PASSWORD_RESET_LINK_RESPONSE === "true";
    const deliveryHint = process.env.EMAIL_NOTIFICATIONS_ENABLED === "true" || process.env.SMS_NOTIFICATIONS_ENABLED === "true"
      ? "تحقق من البريد أو الرسائل إذا كانت الخدمة مفعلة."
      : "تنبيه: لم يتم تفعيل البريد/الرسائل حالياً، لذلك سيظهر الرابط فقط إذا كان ALLOW_PASSWORD_RESET_LINK_RESPONSE=true.";
    return ok({ message: `تم إنشاء رابط استعادة كلمة المرور. ${deliveryHint}`, resetUrl: canReturnResetUrl ? resetUrl : undefined });
  } catch (error) {
    return handleApiError(error, "تعذر طلب استعادة كلمة المرور");
  }
}
