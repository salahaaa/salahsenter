"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: formData.get("fullName"), email: formData.get("email"), phone: formData.get("phone") || undefined, password: formData.get("password") })
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر إنشاء الحساب");
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="auth-form-card space-y-5 rounded-[1.7rem] p-5 sm:p-6">
      <div className="space-y-2"><Label htmlFor="fullName">الاسم الكامل</Label><Input id="fullName" name="fullName" required placeholder="اسم مقدم الطلب" /></div>
      <div className="space-y-2"><Label htmlFor="email">البريد الإلكتروني</Label><Input id="email" name="email" type="email" required placeholder="name@example.com" /></div>
      <div className="space-y-2"><Label htmlFor="phone">رقم الجوال</Label><Input id="phone" name="phone" placeholder="+967..." /></div>
      <div className="space-y-2"><Label htmlFor="password">كلمة المرور</Label><div className="relative"><Input id="password" name="password" type={showPassword ? "text" : "password"} required minLength={8} placeholder="8 أحرف على الأقل" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></div>
      <Button className="w-full" disabled={loading}><UserPlus className="h-4 w-4" /> {loading ? "جارٍ إنشاء الحساب..." : "إنشاء حساب والمتابعة"}</Button>
      <div className="text-center text-sm font-bold text-slate-500">لديك حساب؟ <Link href={`/login?next=${encodeURIComponent(next)}`} className="auth-credential-link underline">سجل الدخول</Link></div>
      {message ? <p className="auth-message-error rounded-xl px-4 py-3 text-sm font-bold">{message}</p> : null}
    </form>
  );
}
