"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setLoading(true);
    setMessage(null);
    setResetUrl(null);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: formData.get("identifier") })
    });
    const json = await response.json();
    setLoading(false);
    setMessage(json.data?.message || json.message || "تم إرسال الطلب");
    if (json.data?.resetUrl) setResetUrl(json.data.resetUrl);
  }

  return <form onSubmit={submit} className="auth-form-card space-y-5 rounded-[1.7rem] p-5 sm:p-6"><div className="space-y-2"><Label>البريد الإلكتروني أو رقم المتجر</Label><Input name="identifier" required placeholder="your-email@example.com أو رقم المتجر" /></div><Button className="w-full" disabled={loading}>{loading ? "جارٍ الإرسال..." : "إرسال رابط الاستعادة"}</Button>{message ? <p className="auth-message-info rounded-xl px-4 py-3 text-sm font-bold">{message}</p> : null}{resetUrl ? <a className="auth-message-warning block break-all rounded-xl px-4 py-3 text-xs font-bold" href={resetUrl}>رابط الاستعادة للتجربة: {resetUrl}</a> : null}</form>;
}
