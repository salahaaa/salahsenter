export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
  createGoogleOauthState,
  createPkcePair,
  googleOauthCookieOptions,
  resolveGoogleRedirectUri
} from "@/lib/google-oauth";

function redirectToLogin(request: NextRequest, message: string) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, request.url));
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return redirectToLogin(request, "دخول Google غير مهيأ. راجع GOOGLE_CLIENT_ID وGOOGLE_CLIENT_SECRET.");

  let redirectUri: string;
  try {
    redirectUri = resolveGoogleRedirectUri(request.url);
  } catch (error) {
    return redirectToLogin(request, error instanceof Error ? error.message : "تعذر قراءة إعدادات Google.");
  }

  const state = createGoogleOauthState(request.nextUrl.searchParams.get("next"));
  const { verifier, challenge } = createPkcePair();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, googleOauthCookieOptions());
  response.cookies.set(GOOGLE_OAUTH_VERIFIER_COOKIE, verifier, googleOauthCookieOptions());
  return response;
}
