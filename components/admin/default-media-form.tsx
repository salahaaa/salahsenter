"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediaUrlInput } from "@/components/media/media-url-input";

type Wing = { id: string; name: string };

export function DefaultMediaForm({ wings }: { wings: Wing[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/admin/default-media", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wingId: formData.get("wingId"), mediaType: formData.get("mediaType"), url: formData.get("url"), alt: formData.get("alt") || undefined, sortOrder: Number(formData.get("sortOrder") || 0), isActive: true })
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر الحفظ");
    formElement.reset();
    setMessage("✓ تم حفظ الصورة الافتراضية بنجاح");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="wingId">الجناح</Label><select id="wingId" name="wingId" required className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">اختر الجناح</option>{wings.map((wing) => <option key={wing.id} value={wing.id}>{wing.name}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="mediaType">نوع الصورة</Label><select id="mediaType" name="mediaType" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="cover">غلاف</option><option value="logo">شعار</option><option value="intro">تعريفية</option><option value="banner">بانر</option><option value="gallery">معرض</option><option value="icon">أيقونة</option></select></div>
      <div className="md:col-span-2"><MediaUrlInput label="الصورة الافتراضية: ارفع صورة أو أدخل رابطاً اختيارياً" name="url" folder="admin/default-media" accept="image/*" required placeholder="بعد الرفع سيتم إدراج مسار الصورة هنا تلقائياً" /></div>
      <Field label="النص البديل" name="alt" /><Field label="ترتيب الظهور" name="sortOrder" type="number" />
      <div className="flex items-center gap-3 md:col-span-2"><Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ الصورة"}</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div>
    </form>
  );
}
function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} /></div>;
}
