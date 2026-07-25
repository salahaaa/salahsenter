"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUrlInput } from "@/components/media/media-url-input";
import type { OffersPageSettings } from "@/lib/offers-page-settings";

export function OffersPageSettingsForm({ settings }: { settings: OffersPageSettings }) {
  const router = useRouter();
  const [values, setValues] = useState(settings);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  function set<K extends keyof OffersPageSettings>(key: K, value: OffersPageSettings[K]) { setValues((current) => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const response = await fetch("/api/admin/offers-page-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? "✓ تم حفظ إعدادات صفحة العروض" : json.message || "تعذر الحفظ");
    if (response.ok) router.refresh();
  }
  return (
    <form onSubmit={submit} className="space-y-5 rounded-3xl border bg-white p-6 shadow-card">
      <div>
        <h2 className="text-xl font-black">إدارة واجهة صفحة العروض</h2>
        <p className="mt-1 text-xs font-bold text-slate-500">هذه اللوحة يتحكم بها الأدمن لاستغلال أعلى صفحة العروض كمساحة إعلانية/إيرادية مع خلفية وصور وعبارات مخصصة.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="شارة أعلى الصفحة" value={values.heroBadge} onChange={(v) => set("heroBadge", v)} />
        <Field label="عنوان أعلى الصفحة" value={values.heroTitle} onChange={(v) => set("heroTitle", v)} />
        <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 text-sm font-black"><input type="checkbox" checked={values.showHeroButtons} onChange={(e) => set("showHeroButtons", e.target.checked)} /> إظهار أزرار أعلى الصفحة</label>
        <div className="space-y-2 md:col-span-3"><Label>وصف أعلى الصفحة</Label><Textarea value={values.heroDescription} onChange={(e) => set("heroDescription", e.target.value)} /></div>
        <Field label="نص الزر الأول" value={values.heroPrimaryLabel} onChange={(v) => set("heroPrimaryLabel", v)} />
        <Field label="رابط الزر الأول" value={values.heroPrimaryUrl} onChange={(v) => set("heroPrimaryUrl", v)} />
        <Field label="نص الزر الثاني" value={values.heroSecondaryLabel} onChange={(v) => set("heroSecondaryLabel", v)} />
        <Field label="رابط الزر الثاني" value={values.heroSecondaryUrl} onChange={(v) => set("heroSecondaryUrl", v)} />
        <Color label="لون خلفية أعلى الصفحة" value={values.heroBackgroundColor} onChange={(v) => set("heroBackgroundColor", v)} />
        <Color label="لون النص" value={values.heroTextColor} onChange={(v) => set("heroTextColor", v)} />
        <div className="md:col-span-3"><MediaUrlInput label="صورة خلفية أعلى الصفحة" name="heroBg" value={values.heroBackgroundImage} onValueChange={(v) => set("heroBackgroundImage", v)} folder="admin/offers/page" accept="image/*" /></div>
      </div>
      <div className="grid gap-4 border-t pt-5 md:grid-cols-3">
        <Field label="عنوان قائمة العروض" value={values.listTitle} onChange={(v) => set("listTitle", v)} />
        <Field label="عبارة صغيرة للقائمة" value={values.listSubtitle} onChange={(v) => set("listSubtitle", v)} />
        <Color label="لون خلفية القائمة" value={values.listBackgroundColor} onChange={(v) => set("listBackgroundColor", v)} />
        <Color label="لون نص القائمة" value={values.listTextColor} onChange={(v) => set("listTextColor", v)} />
        <div className="space-y-2 md:col-span-3"><Label>وصف قائمة العروض</Label><Textarea value={values.listDescription} onChange={(e) => set("listDescription", e.target.value)} /></div>
        <div className="md:col-span-3"><MediaUrlInput label="صورة خلفية قائمة العروض" name="listBg" value={values.listBackgroundImage} onValueChange={(v) => set("listBackgroundImage", v)} folder="admin/offers/list" accept="image/*" /></div>
      </div>
      <div className="grid gap-4 border-t pt-5 md:grid-cols-2">
        <Field label="عنوان عروض الإدارة" value={values.adminSectionTitle} onChange={(v) => set("adminSectionTitle", v)} />
        <Field label="وصف عروض الإدارة" value={values.adminSectionSubtitle} onChange={(v) => set("adminSectionSubtitle", v)} />
        <Field label="عنوان الاقتراحات" value={values.recommendationTitle} onChange={(v) => set("recommendationTitle", v)} />
        <Field label="وصف الاقتراحات" value={values.recommendationDescription} onChange={(v) => set("recommendationDescription", v)} />
      </div>
      <div className="flex items-center gap-3"><Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ إعدادات صفحة العروض"}</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div>
    </form>
  );
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div className="space-y-2"><Label>{label}</Label><Input value={value || ""} onChange={(e) => onChange(e.target.value)} /></div>; }
function Color({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div className="space-y-2"><Label>{label}</Label><Input type="color" value={/^#[0-9a-f]{6}$/i.test(value || "") ? value : "#0f172a"} onChange={(e) => onChange(e.target.value)} /></div>; }
