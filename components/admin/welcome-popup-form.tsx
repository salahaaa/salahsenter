"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUrlInput } from "@/components/media/media-url-input";
import type { WelcomePopupSettings } from "@/lib/welcome-popup";
import { ExperiencePreviewButton } from "@/components/admin/experience/experience-preview-button";

export function WelcomePopupForm({ initial }: { initial: WelcomePopupSettings }) {
  const [values, setValues] = useState<WelcomePopupSettings>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof WelcomePopupSettings>(key: K, value: WelcomePopupSettings[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/admin/welcome-popup", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const json = await response.json();
    setLoading(false);
    setMessage(response.ok ? "✓ تم حفظ الواجهة الترحيبية" : json.message || "تعذر الحفظ");
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border bg-white p-6 shadow-card">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-950">الواجهة الترحيبية عند أول دخول</h2>
          <p className="mt-1 text-sm text-slate-500">يمكن تغيير الصورة والرسالة والعنوان والكوبون والزر، وتظهر بحركة احترافية للزائر.</p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm font-bold">
          <label className="flex items-center gap-2"><input type="checkbox" checked={values.enabled} onChange={(e) => set("enabled", e.target.checked)} /> تفعيل</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={values.showOnce} onChange={(e) => set("showOnce", e.target.checked)} /> تظهر مرة واحدة</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={values.closeOnBackdrop} onChange={(e) => set("closeOnBackdrop", e.target.checked)} /> إغلاق عند الضغط بالخارج</label>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <MediaUrlInput label="صورة النافذة الترحيبية: رابط أو رفع" name="welcomeImageUrl" value={values.imageUrl} onValueChange={(v) => set("imageUrl", v)} folder="admin/welcome" accept="image/*" />
        <Field label="تأخير الظهور بالمللي ثانية" type="number" value={String(values.delayMs)} onChange={(v) => set("delayMs", Number(v))} />
        <Field label="النص داخل الشارة" value={values.badgeText} onChange={(v) => set("badgeText", v)} />
        <Field label="عنوان النافذة" value={values.title} onChange={(v) => set("title", v)} />
        <Field label="كود الخصم" value={values.couponCode} onChange={(v) => set("couponCode", v)} />
        <Field label="نص الزر" value={values.buttonText} onChange={(v) => set("buttonText", v)} />
        <Field label="رابط الزر" value={values.buttonUrl} onChange={(v) => set("buttonUrl", v)} />
        <div className="space-y-2 md:col-span-2">
          <Label>الرسالة</Label>
          <Textarea value={values.message} onChange={(e) => set("message", e.target.value)} />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <ExperiencePreviewButton scope="welcome_popup" payload={values}/>
        <Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "نشر الواجهة الترحيبية"}</Button>
        {message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}
      </div>
    </form>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}
