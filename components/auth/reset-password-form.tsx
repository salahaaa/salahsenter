"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: formData.get("token"), password: formData.get("password") })
    });
    const json = await response.json();
    setLoading(false);
    setMessage(json.data?.message || json.message || "تمت العملية");
    if (response.ok) setTimeout(() => router.push("/login"), 1200);
  }

  return <form onSubmit={submit} className="auth-form-card space-y-5 rounded-[1.7rem] p-5 sm:p-6"><input type="hidden" name="token" value={token} /><div className="space-y-2"><Label>كلمة المرور الجديدة</Label><div className="relative"><Input name="password" type={show ? "text" : "password"} required minLength={8} /><button type="button" onClick={() => setShow(!show)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></div><Button className="w-full" disabled={loading || !token}>{loading ? "جارٍ الحفظ..." : "تغيير كلمة المرور"}</Button>{message ? <p className="auth-message-info rounded-xl px-4 py-3 text-sm font-bold">{message}</p> : null}</form>;
}
