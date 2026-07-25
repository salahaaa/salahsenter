"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUrlInput } from "@/components/media/media-url-input";
import { VisibilityScheduleEditor, parseVisibilityScheduleFromForm } from "@/components/admin/visibility-schedule-editor";

export function AdminPromotionalOfferForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/admin/promotional-offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.get("title"),
        category: data.get("category") || "admin",
        description: data.get("description") || undefined,
        imageUrl: data.get("imageUrl") || "",
        videoUrl: data.get("videoUrl") || "",
        contactName: data.get("contactName") || undefined,
        contactPhone: data.get("contactPhone") || undefined,
        whatsappUrl: data.get("whatsappUrl") || "",
        locationText: data.get("locationText") || undefined,
        externalUrl: data.get("externalUrl") || "",
        status: data.get("status") || "active",
        startsAt: data.get("startsAt") ? new Date(String(data.get("startsAt"))).toISOString() : null,
        endsAt: data.get("endsAt") ? new Date(String(data.get("endsAt"))).toISOString() : null,
        isFeatured: data.get("isFeatured") === "on",
        sortOrder: Number(data.get("sortOrder") || 0),
        visibilitySchedule: parseVisibilityScheduleFromForm(data.get("visibilitySchedule"))
      })
    });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? "✓ تم إنشاء عرض الإدارة" : json.message || "تعذر إنشاء العرض");
    if (response.ok) { form.reset(); router.refresh(); }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-3">
      <div className="md:col-span-3"><h2 className="text-xl font-black">عرض ترويجي من الإدارة</h2><p className="mt-1 text-xs font-bold text-slate-500">هذا النوع للتسويق والإعلانات الخارجية وبيانات التواصل، وليس شراءً مباشراً من السلة.</p></div>
      <Field label="عنوان العرض" name="title" required />
      <div className="space-y-2"><Label>التصنيف</Label><select name="category" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="today">عروض اليوم</option><option value="exclusive">حصري</option><option value="trending">رائج</option><option value="new">جديد</option><option value="seasonal">موسمي</option><option value="external">خارجي / تسويقي</option><option value="admin">إدارة</option></select></div>
      <div className="space-y-2"><Label>الحالة</Label><select name="status" defaultValue="active" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="active">نشط</option><option value="scheduled">مجدول</option><option value="draft">مسودة</option><option value="disabled">معطل</option></select></div>
      <MediaUrlInput label="صورة العرض" name="imageUrl" folder="admin/promotional-offers" accept="image/*" />
      <Field label="رابط فيديو" name="videoUrl" />
      <Field label="رابط خارجي" name="externalUrl" />
      <Field label="اسم جهة التواصل" name="contactName" />
      <Field label="رقم الهاتف" name="contactPhone" />
      <Field label="رابط واتساب" name="whatsappUrl" />
      <Field label="بداية الظهور" name="startsAt" type="datetime-local" />
      <Field label="نهاية الظهور" name="endsAt" type="datetime-local" />
      <Field label="ترتيب الظهور" name="sortOrder" type="number" />
      <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 text-sm font-black"><input name="isFeatured" type="checkbox" /> عرض مميز</label>
      <div className="space-y-2 md:col-span-3"><Label>الموقع / بيانات إضافية</Label><Input name="locationText" /></div>
      <div className="space-y-2 md:col-span-3"><Label>الوصف</Label><Textarea name="description" /></div>
      <VisibilityScheduleEditor />
      <div className="flex flex-wrap items-center gap-3 md:col-span-3"><Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ عرض الإدارة"}</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div>
    </form>
  );
}
function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) { return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} required={required} /></div>; }
