export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createSessionForUser, hashPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db, roles, userRoles, users } from "@/lib/db";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
  constantTimeEqual,
  googleOauthCookieOptions,
  readPostLoginPathFromState,
  resolveGoogleRedirectUri,
  safePostLoginPath
} from "@/lib/google-oauth";

function clearGoogleOauthCookies(response: NextResponse) {
  const expired = { ...googleOauthCookieOptions(), maxAge: 0 };
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", expired);
  response.cookies.set(GOOGLE_OAUTH_VERIFIER_COOKIE, "", expired);
  return response;
}

function loginRedirect(request: NextRequest, message: string) {
  return clearGoogleOauthCookies(NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, request.url)));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const providerError = request.nextUrl.searchParams.get("error");
  const cookieState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const verifier = request.cookies.get(GOOGLE_OAUTH_VERIFIER_COOKIE)?.value;

  if (providerError) return loginRedirect(request, "تم إلغاء أو رفض تسجيل الدخول عبر Google.");
  if (!code || !state || !constantTimeEqual(state, cookieState) || !verifier) return loginRedirect(request, "تعذر التحقق من جلسة Google. أعد المحاولة من صفحة تسجيل الدخول.");

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return loginRedirect(request, "دخول Google غير مهيأ. راجع إعدادات الخادم.");

  let redirectUri: string;
  try {
    redirectUri = resolveGoogleRedirectUri(request.url);
  } catch (error) {
    return loginRedirect(request, error instanceof Error ? error.message : "تعذر قراءة إعدادات Google.");
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier
      }),
      cache: "no-store"
    });
    const tokenJson = await tokenResponse.json() as { access_token?: string; error?: string; error_description?: string };
    if (!tokenResponse.ok || !tokenJson.access_token) throw new Error(tokenJson.error_description || tokenJson.error || "تعذر الحصول على رمز Google");

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      cache: "no-store"
    });
    const profile = await profileResponse.json() as { email?: string; name?: string; email_verified?: boolean };
    if (!profileResponse.ok || !profile.email || !profile.email_verified) throw new Error("حساب Google غير موثق بالبريد");

    const email = profile.email.toLowerCase().trim();
    let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      const [customerRole] = await db.select().from(roles).where(eq(roles.code, "customer")).limit(1);
      if (!customerRole) throw new Error("أدوار النظام غير مهيأة. طبّق migration history أولاً.");
      [user] = await db.insert(users).values({
        fullName: profile.name || email.split("@")[0],
        email,
        passwordHash: await hashPassword(`google-oauth-${nanoid(32)}`),
        status: "active",
        emailVerifiedAt: new Date()
      }).returning();
      await db.insert(userRoles).values({ userId: user.id, roleId: customerRole.id }).onConflictDoNothing();
    } else if (user.status !== "active") {
      throw new Error("الحساب غير مفعّل أو موقوف");
    }

    await createSessionForUser(user.id);
    await writeAuditLog({ actorId: user.id, action: "login", category: "security", entityType: "security.google_oauth_login", entityId: user.id, afterData: { provider: "google", email } });
    return clearGoogleOauthCookies(NextResponse.redirect(new URL(safePostLoginPath(readPostLoginPathFromState(state)), request.url)));
  } catch (error) {
    return loginRedirect(request, error instanceof Error ? error.message : "تعذر تسجيل الدخول عبر Google");
  }
}
