"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUrlInput } from "@/components/media/media-url-input";
import { VisibilityScheduleEditor, parseVisibilityScheduleFromForm } from "@/components/admin/visibility-schedule-editor";

export function BannerForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    setLoading(true);
    setMessage(null);
    const payload = {
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      imageUrl: formData.get("imageUrl"),
      linkUrl: formData.get("linkUrl") || "",
      placement: formData.get("placement") || "homepage_hero",
      sortOrder: Number(formData.get("sortOrder") || 0),
      startAt: toIso(formData.get("startAt")),
      endAt: toIso(formData.get("endAt")),
      status: formData.get("status"),
      visibilitySchedule: parseVisibilityScheduleFromForm(formData.get("visibilitySchedule"))
    };
    const response = await fetch("/api/admin/banners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر الحفظ");
    formElement.reset();
    setMessage("✓ تم حفظ البانر بنجاح");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2">
      <Field label="العنوان" name="title" required />
      <MediaUrlInput label="صورة البانر: رابط أو رفع" name="imageUrl" folder="admin/banners" accept="image/*" required />
      <Field label="رابط الانتقال" name="linkUrl" />
      <div className="space-y-2">
        <Label htmlFor="placement">مكان الظهور</Label>
        <select id="placement" name="placement" className="h-11 w-full rounded-xl border bg-white px-4 text-sm" defaultValue="homepage_promo">
          <option value="homepage_hero">خلفية الهيرو الرئيسية</option>
          <option value="homepage_promo">لوحة العروض المتحركة في الرئيسية</option>
          <option value="homepage_offer">عرض رئيسي</option>
          <option value="homepage_slider">سلايدر الصفحة الرئيسية</option>
          <option value="app_home">واجهة التطبيق</option>
          <option value="general">عام</option>
        </select>
      </div>
      <Field label="تاريخ البداية" name="startAt" type="datetime-local" />
      <Field label="تاريخ النهاية" name="endAt" type="datetime-local" />
      <Field label="ترتيب الظهور" name="sortOrder" type="number" />
      <div className="space-y-2">
        <Label htmlFor="status">الحالة</Label>
        <select id="status" name="status" defaultValue="active" className="h-11 w-full rounded-xl border bg-white px-4 text-sm">
          <option value="active">نشط — يظهر فوراً في لوحة البنر الرئيسية</option>
          <option value="scheduled">مجدول — يظهر في تاريخ البداية</option>
          <option value="draft">مسودة — لا يظهر للعامة</option>
          <option value="disabled">معطل</option>
        </select>
        <p className="text-xs font-bold text-slate-500">لظهور الإعلان في الواجهة الرئيسية اختر «نشط» ومكان الظهور المناسب.</p>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="description">الوصف</Label>
        <Textarea id="description" name="description" />
      </div>
      <VisibilityScheduleEditor />
      <div className="flex items-center gap-3 md:col-span-2">
        <Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ البانر"}</Button>
        {message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}
      </div>
    </form>
  );
}

function toIso(value: FormDataEntryValue | null) {
  return value ? new Date(String(value)).toISOString() : null;
}

function Field({ label, name, type = "text", required = false, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} placeholder={placeholder || ""} />
    </div>
  );
}
