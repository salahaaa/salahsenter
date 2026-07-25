"use client";

import Link from "next/link";
import { Eye, EyeOff, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const googleError = searchParams.get("error");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [pendingRedirect, setPendingRedirect] = useState(next);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function login(inputIdentifier: string, inputPassword: string, redirectTo = next) {
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: inputIdentifier.trim(), password: inputPassword })
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(json.message || "تعذر تسجيل الدخول");
      return;
    }
    if (json.data?.requiresMfa) {
      setMfaChallengeToken(json.data.challengeToken);
      setPendingRedirect(redirectTo);
      setMessage("أدخل رمز المصادقة الثنائية من تطبيق Google Authenticator أو Microsoft Authenticator");
      return;
    }
    if (json.data?.mustChangePassword) {
      router.push(`/account/security?mustChangePassword=1&next=${encodeURIComponent(redirectTo)}`);
      router.refresh();
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mfaChallengeToken) return;
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: mfaCode, challengeToken: mfaChallengeToken, mode: "login" })
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(json.message || "رمز المصادقة الثنائية غير صحيح");
      return;
    }
    router.push(pendingRedirect);
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await login(identifier, password);
  }

  return (
    <div className="space-y-4">
      {!mfaChallengeToken ? (
        <div className="auth-provider-card rounded-[1.7rem] p-4 sm:p-5">
          <Button asChild variant="outline" className="h-12 w-full rounded-2xl border-blue-100 bg-white text-slate-800 hover:border-blue-200 hover:bg-blue-50">
            <Link href={`/api/auth/google?next=${encodeURIComponent(next)}`}>
              <span className="grid h-6 w-6 place-items-center rounded-full border border-blue-100 bg-white text-sm font-black text-blue-600">G</span>
              المتابعة عبر Google
            </Link>
          </Button>
          <div className="auth-provider-divider mt-4">أو استخدم بيانات حسابك</div>
        </div>
      ) : null}

      {googleError ? <p role="alert" className="auth-message-warning rounded-xl px-4 py-3 text-sm font-bold">{googleError}</p> : null}

      {mfaChallengeToken ? (
        <form onSubmit={verifyMfa} className="auth-form-card space-y-5 rounded-[1.7rem] p-5 sm:p-6">
          <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/75 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20"><ShieldCheck className="h-5 w-5" /></span>
            <div>
              <h2 className="font-black text-slate-950">تحقق إضافي لحماية الحساب</h2>
              <p className="mt-1 text-xs leading-6 text-slate-600">أدخل الرمز من Google Authenticator أو Microsoft Authenticator، أو استخدم كود الاسترداد الاحتياطي.</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mfaCode">رمز المصادقة الثنائية</Label>
            <Input id="mfaCode" inputMode="numeric" autoComplete="one-time-code" required value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} placeholder="123456 أو كود احتياطي" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button disabled={loading}>{loading ? "جارٍ التحقق..." : "تأكيد الرمز"}</Button>
            <Button type="button" variant="outline" onClick={() => setMfaChallengeToken(null)}>العودة لبيانات الدخول</Button>
          </div>
          {message ? <p role="status" className="auth-message-info rounded-xl px-4 py-3 text-sm font-bold">{message}</p> : null}
        </form>
      ) : (
        <form onSubmit={submit} className="auth-form-card space-y-5 rounded-[1.7rem] p-5 sm:p-6">
          <div className="space-y-2">
            <Label htmlFor="identifier">البريد الإلكتروني أو اسم المستخدم أو رقم المتجر</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input id="identifier" name="identifier" type="text" required value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="pr-11" placeholder="admin@example.com أو SLH-000001" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">كلمة المرور</Label>
              <KeyRound className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
            <div className="relative">
              <Input id="password" name="password" type={showPassword ? "text" : "password"} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" className="pl-12" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} aria-pressed={showPassword} className="absolute left-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-blue-700">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <Button className="w-full" disabled={loading}>{loading ? "جارٍ الدخول..." : "تسجيل الدخول بأمان"}</Button>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-center">
            <Link href="/forgot-password" className="auth-credential-link text-sm font-black underline">نسيت كلمة المرور؟</Link>
            <Link href="/forgot-store-credentials" className="auth-credential-link text-sm font-black underline">نسيت بيانات المتجر؟</Link>
          </div>
          {message ? <p role="alert" className="auth-message-error rounded-xl px-4 py-3 text-sm font-bold">{message}</p> : null}
        </form>
      )}
    </div>
  );
}
