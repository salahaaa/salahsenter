"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUrlInput } from "@/components/media/media-url-input";

type ActivityTemplateSelection = { key: string; title: string; source: "system" | "admin" };

export function WingForm({ activityTemplates }: { activityTemplates: ActivityTemplateSelection[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);

    const response = await fetch("/api/admin/wings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        activityTemplateKey: formData.get("activityTemplateKey"),
        description: formData.get("description") || undefined,
        iconUrl: formData.get("iconUrl") || "",
        heroImageUrl: formData.get("heroImageUrl") || "",
        mobileImageUrl: formData.get("mobileImageUrl") || "",
        desktopImageUrl: formData.get("desktopImageUrl") || "",
        sortOrder: Number(formData.get("sortOrder") || 0),
        isActive: true
      })
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(json.message || "تعذر إنشاء الجناح");
      return;
    }
    formElement.reset();
    setMessage("✓ تم إنشاء الجناح بنجاح");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-5 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2">
      <Field label="اسم الجناح" name="name" required />
      <Field label="ترتيب الظهور" name="sortOrder" type="number" />
      <div className="space-y-2 md:col-span-2"><Label htmlFor="activityTemplateKey">قالب تجهيز الجناح (قطاع التاجر)</Label><select id="activityTemplateKey" name="activityTemplateKey" required className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">اختر قالب تجهيز هذا الجناح</option>{activityTemplates.map((template) => <option key={template.key} value={template.key}>{template.title}{template.source === "admin" ? " — قطاع الإدارة" : ""}</option>)}</select><p className="text-xs font-bold leading-5 text-slate-500">التاجر يختار الجناح فقط في طلب فتح المتجر؛ هذا الربط يحدد قالب التجهيز تلقائياً ولا يظهر له اختيار قطاع ثانٍ.</p></div>
      <MediaUrlInput label="الأيقونة: رابط أو رفع" name="iconUrl" folder="admin/wings/icons" accept="image/*" />
      <MediaUrlInput label="الصورة الرئيسية: رابط أو رفع" name="heroImageUrl" folder="admin/wings/hero" accept="image/*" />
      <MediaUrlInput label="صورة الموبايل: رابط أو رفع" name="mobileImageUrl" folder="admin/wings/mobile" accept="image/*" />
      <MediaUrlInput label="صورة الديسكتوب: رابط أو رفع" name="desktopImageUrl" folder="admin/wings/desktop" accept="image/*" />
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="description">وصف مختصر</Label>
        <Textarea id="description" name="description" />
      </div>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "إضافة جناح"}</Button>
        {message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}
      </div>
    </form>
  );
}

function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} /></div>;
}
