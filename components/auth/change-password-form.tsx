"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: formData.get("currentPassword"), newPassword: formData.get("newPassword") })
    });
    const json = await response.json();
    setLoading(false);
    setMessage(response.ok ? "✓ تم تغيير كلمة المرور بنجاح" : json.message || "تعذر التغيير");
    if (response.ok) formElement.reset();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="currentPassword">كلمة المرور الحالية</Label><div className="relative"><Input id="currentPassword" name="currentPassword" type={showCurrent ? "text" : "password"} required /><button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{showCurrent ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></div>
      <div className="space-y-2"><Label htmlFor="newPassword">كلمة المرور الجديدة</Label><div className="relative"><Input id="newPassword" name="newPassword" type={showNew ? "text" : "password"} required minLength={8} /><button type="button" onClick={() => setShowNew(!showNew)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{showNew ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></div>
      <div className="flex items-center gap-3 md:col-span-2"><Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "تغيير كلمة المرور"}</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div>
    </form>
  );
}
