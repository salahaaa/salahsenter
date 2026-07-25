"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUrlInput } from "@/components/media/media-url-input";
import { VisibilityScheduleEditor, parseVisibilityScheduleFromForm } from "@/components/admin/visibility-schedule-editor";

export function MarketplaceAnnouncementForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const successKey = "marketplace-announcement-saved";

  useEffect(() => {
    const savedMessage = window.sessionStorage.getItem(successKey);
    if (savedMessage) {
      setMessage(savedMessage);
      setSaved(true);
    }
  }, []);

  function resetForNewAnnouncement(form?: HTMLFormElement | null) {
    form?.reset();
    window.sessionStorage.removeItem(successKey);
    setMessage(null);
    setSaved(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saved || loading) return;
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    setLoading(true);
    setMessage(null);
    const payload = {
      title: formData.get("title"),
      summary: formData.get("summary") || undefined,
      body: formData.get("body") || undefined,
      imageUrl: formData.get("imageUrl") || "",
      linkUrl: formData.get("linkUrl") || "",
      isPinned: formData.get("isPinned") === "on",
      startAt: toIso(formData.get("startAt")),
      endAt: toIso(formData.get("endAt")),
      status: formData.get("status"),
      isPromoted: formData.get("isPromoted") === "on",
      promotionPackage: formData.get("promotionPackage") || undefined,
      visibilitySchedule: parseVisibilityScheduleFromForm(formData.get("visibilitySchedule"))
    };
    const response = await fetch("/api/admin/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر الحفظ");
    const successMessage = "✓ تم حفظ إعلان المول بنجاح. تم تعطيل زر الحفظ لمنع التكرار — اضغط إعلان جديد إذا أردت إضافة إعلان آخر.";
    formElement.reset();
    window.sessionStorage.setItem(successKey, successMessage);
    setMessage(successMessage);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2">
      <Field label="عنوان الإعلان" name="title" required />
      <MediaUrlInput label="صورة الإعلان: رابط أو رفع" name="imageUrl" folder="admin/announcements" accept="image/*" />
      <Field label="رابط التفاصيل" name="linkUrl" />
      <Field label="باقة الترويج (اختياري)" name="promotionPackage" placeholder="مثال: featured, homepage-hero" />
      <Field label="تاريخ البداية" name="startAt" type="datetime-local" />
      <Field label="تاريخ النهاية" name="endAt" type="datetime-local" />
      <div className="space-y-2">
        <Label htmlFor="status">الحالة</Label>
        <select id="status" name="status" defaultValue="active" className="h-11 w-full rounded-xl border bg-white px-4 text-sm">
          <option value="active">نشط — يظهر فوراً في الواجهة الرئيسية</option>
          <option value="scheduled">مجدول — يظهر في تاريخ البداية</option>
          <option value="draft">مسودة — لا يظهر للعامة</option>
          <option value="disabled">معطل</option>
        </select>
        <p className="text-xs font-bold text-slate-500">يجب اختيار «نشط» لكي يظهر الإعلان في الصفحة الرئيسية. إذا اخترت «مجدول» فحدد تاريخ البداية.</p>
      </div>
      <div className="flex items-center gap-6 rounded-2xl bg-slate-50 px-4">
        <label className="flex items-center gap-2 text-sm font-bold"><input name="isPinned" type="checkbox" /> تثبيت في الأعلى</label>
        <label className="flex items-center gap-2 text-sm font-bold"><input name="isPromoted" type="checkbox" /> إعلان مموّل (يظهر بتصميم بارز ومميز)</label>
      </div>
      <div className="space-y-2 md:col-span-2"><Label htmlFor="summary">وصف مختصر</Label><Textarea id="summary" name="summary" /></div>
      <div className="space-y-2 md:col-span-2"><Label htmlFor="body">التفاصيل</Label><Textarea id="body" name="body" /></div>
      <VisibilityScheduleEditor />
      <div className="flex flex-wrap items-center gap-3 md:col-span-2"><Button disabled={loading || saved}>{loading ? "جارٍ الحفظ..." : saved ? "تم الحفظ ✓" : "حفظ الإعلان"}</Button>{saved ? <Button type="button" variant="secondary" onClick={(event) => resetForNewAnnouncement(event.currentTarget.form)}>إعلان جديد</Button> : null}{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div>
    </form>
  );
}

function toIso(value: FormDataEntryValue | null) { return value ? new Date(String(value)).toISOString() : null; }
function Field({ label, name, type = "text", required = false, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} placeholder={placeholder} /></div>;
}
