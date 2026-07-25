"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUrlInput } from "@/components/media/media-url-input";

type Wing = { id: string; name: string; iconUrl: string | null; heroImageUrl: string | null; mobileImageUrl: string | null; desktopImageUrl: string | null; description: string | null; activityTemplateKey: string | null; isActive: boolean; sortOrder: number };
type ActivityTemplateSelection = { key: string; title: string; source: "system" | "admin" };

export function WingEditForm({ wing, activityTemplates }: { wing: Wing; activityTemplates: ActivityTemplateSelection[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch(`/api/admin/wings/${wing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        activityTemplateKey: data.get("activityTemplateKey"),
        description: data.get("description") || undefined,
        iconUrl: data.get("iconUrl") || "",
        heroImageUrl: data.get("heroImageUrl") || "",
        mobileImageUrl: data.get("mobileImageUrl") || "",
        desktopImageUrl: data.get("desktopImageUrl") || "",
        sortOrder: Number(data.get("sortOrder") || 0),
        isActive: data.get("isActive") === "on"
      })
    });
    const json = await response.json();
    setSaving(false);
    setMessage(response.ok ? "✓ تم تعديل الجناح وتحديث الواجهات" : json.message || "تعذر التعديل");
    if (response.ok) {
      router.refresh();
      window.setTimeout(() => setEditing(false), 700);
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>تعديل</Button>
      {editing ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm">
          <div className="mx-auto my-6 max-w-5xl rounded-[2rem] border bg-white p-5 text-right shadow-2xl md:p-7">
            <div className="mb-5 flex items-start justify-between gap-4 border-b pb-4">
              <button type="button" onClick={() => setEditing(false)} className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200" aria-label="إغلاق"><X className="h-5 w-5" /></button>
              <div>
                <h2 className="text-2xl font-black text-slate-950">تعديل جناح: {wing.name}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">كل الصور في قائمة واضحة وكبيرة. بعد الرفع اضغط حفظ حتى تظهر في الواجهة.</p>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>اسم الجناح</Label><Input name="name" defaultValue={wing.name} required className="h-12 text-base" /></div>
                <div className="space-y-2"><Label>الترتيب</Label><Input name="sortOrder" type="number" defaultValue={wing.sortOrder} className="h-12 text-base" /></div>
                <div className="space-y-2 md:col-span-2"><Label>قالب تجهيز الجناح (قطاع التاجر)</Label><select name="activityTemplateKey" defaultValue={wing.activityTemplateKey || ""} required className="h-12 w-full rounded-xl border bg-white px-3 text-base"><option value="">اختر قالب تجهيز هذا الجناح</option>{activityTemplates.map((template) => <option key={template.key} value={template.key}>{template.title}{template.source === "admin" ? " — قطاع الإدارة" : ""}</option>)}</select><p className="text-xs font-bold leading-5 text-slate-500">هذا هو القطاع الوحيد الذي يختاره التاجر عند طلب فتح المتجر.</p></div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <MediaUrlInput label="1) الأيقونة - تظهر في البطاقات الصغيرة" name="iconUrl" defaultValue={wing.iconUrl || ""} folder="admin/wings/icons" accept="image/*" />
                <MediaUrlInput label="2) الصورة الرئيسية - أهم صورة للجناح" name="heroImageUrl" defaultValue={wing.heroImageUrl || ""} folder="admin/wings/hero" accept="image/*" />
                <MediaUrlInput label="3) صورة الموبايل" name="mobileImageUrl" defaultValue={wing.mobileImageUrl || ""} folder="admin/wings/mobile" accept="image/*" />
                <MediaUrlInput label="4) صورة الديسكتوب" name="desktopImageUrl" defaultValue={wing.desktopImageUrl || ""} folder="admin/wings/desktop" accept="image/*" />
              </div>

              <div className="space-y-2"><Label>الوصف</Label><Textarea name="description" defaultValue={wing.description || ""} className="min-h-28" /></div>
              <label className="flex items-center gap-2 text-sm font-bold"><input name="isActive" type="checkbox" defaultChecked={wing.isActive} /> نشط ويظهر للمتسوقين</label>
              <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                <Button disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ التعديل وتحديث الواجهة"}</Button>
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>إلغاء</Button>
                {message ? <span className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">{message}</span> : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
