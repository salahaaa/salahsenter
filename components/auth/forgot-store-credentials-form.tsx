"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotStoreCredentialsForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/recover-store-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: form.get("identifier") })
      });
      const json = await response.json().catch(() => ({}));
      setMessage(json.message || "تمت معالجة الطلب");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="auth-form-card space-y-5 rounded-[1.7rem] p-5 sm:p-6">
      <KeyRound className="h-8 w-8 text-primary" />
      <label className="space-y-2">
        <Label>البريد الإلكتروني أو رقم المتجر</Label>
        <Input name="identifier" required placeholder="merchant@example.com أو ST-2026-..." />
      </label>
      <Button className="w-full" disabled={loading}>{loading ? "جارٍ المعالجة..." : "إرسال بيانات الاستعادة"}</Button>
      {message ? <p className="auth-message-info rounded-xl px-4 py-3 text-sm font-bold">{message}</p> : null}
      <p className="text-center text-sm"><Link href="/forgot-password" className="auth-credential-link font-black underline">استعادة كلمة المرور فقط</Link></p>
    </form>
  );
}
