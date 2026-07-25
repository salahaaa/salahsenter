import { headers } from "next/headers";
import { db, notifications, passwordResetTokens, users } from "@/lib/db";
import { createSecureToken, sha256 } from "@/lib/security";
import { sendOptionalActivationMessages } from "@/lib/outbound";

/** Creates a short-lived reset invite without ever sending a plaintext password. */
export async function issuePasswordResetInvite(input: { user: typeof users.$inferSelect; identifier: string; requestUrl?: string; purpose: "first_login" | "password_reset" | "credentials_recovery"; expiresMinutes?: number }) {
  const token = createSecureToken("reset");
  const expiresAt = new Date(Date.now() + Math.max(5, input.expiresMinutes || 30) * 60 * 1000);
  const headerList = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL || (input.requestUrl ? new URL(input.requestUrl).origin : "");
  const resetUrl = `${origin.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  await db.insert(passwordResetTokens).values({ userId: input.user.id, tokenHash: sha256(token), identifier: input.identifier, expiresAt, ipAddress: headerList.get("x-forwarded-for") || headerList.get("x-real-ip") || null, userAgent: headerList.get("user-agent") || null });
  await db.insert(notifications).values({ userId: input.user.id, title: input.purpose === "first_login" ? "عيّن كلمة مرورك قبل أول دخول للتاجر" : "طلب استعادة كلمة المرور", body: `تم إنشاء رابط آمن صالح حتى ${expiresAt.toISOString()}.`, type: input.purpose === "first_login" ? "merchant_first_login_password_invite" : "password_reset_requested", data: { resetUrl, expiresAt: expiresAt.toISOString(), purpose: input.purpose } });
  await sendOptionalActivationMessages({ email: input.user.email, phone: input.user.phone, subject: input.purpose === "first_login" ? "تعيين كلمة المرور لحساب المتجر" : "استعادة كلمة المرور", message: `${input.purpose === "first_login" ? "عيّن كلمة مرورك قبل أول دخول للوحة التاجر" : "رابط استعادة كلمة المرور"}: ${resetUrl}` });
  return { resetUrl, expiresAt };
}
