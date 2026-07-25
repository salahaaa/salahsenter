"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdvertisingSettings } from "@/lib/advertising-settings";

export function AdvertisingSettingsForm({ initial }: { initial: AdvertisingSettings }) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const f = new FormData(formElement);
    setLoading(true);
    setMessage(null);
    const payload = {
      maxActiveStoreAnnouncements: Number(f.get("maxActiveStoreAnnouncements") || 3),
      maxActiveStoreNews: Number(f.get("maxActiveStoreNews") || 10),
      marketplaceAnnouncementsLimit: Number(f.get("marketplaceAnnouncementsLimit") || 8),
      storeAnnouncementsLimit: Number(f.get("storeAnnouncementsLimit") || 8),
      storeNewsLimit: Number(f.get("storeNewsLimit") || 10),
      enablePromotedOffers: f.get("enablePromotedOffers") === "on"
    };
    const response = await fetch("/api/admin/advertising-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json();
    setLoading(false);
    setMessage(response.ok ? "✓ تم حفظ إعدادات الإعلانات" : json.message || "تعذر الحفظ");
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-3">
      <Field label="حد إعلانات المتجر المجانية النشطة" name="maxActiveStoreAnnouncements" defaultValue={initial.maxActiveStoreAnnouncements} />
      <Field label="حد أخبار المتجر النشطة" name="maxActiveStoreNews" defaultValue={initial.maxActiveStoreNews} />
      <Field label="عدد إعلانات المول في الرئيسية" name="marketplaceAnnouncementsLimit" defaultValue={initial.marketplaceAnnouncementsLimit} />
      <Field label="عدد بطاقات عروض المتجر" name="storeAnnouncementsLimit" defaultValue={initial.storeAnnouncementsLimit} />
      <Field label="عدد أخبار شريط المتجر" name="storeNewsLimit" defaultValue={initial.storeNewsLimit} />
      <label className="flex items-center gap-2 rounded-xl border bg-slate-50 px-4 py-3 text-sm font-bold"><input name="enablePromotedOffers" type="checkbox" defaultChecked={initial.enablePromotedOffers} /> تفعيل عروض مميزة ممولة</label>
      <div className="flex items-center gap-3 md:col-span-3"><Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ إعدادات الإعلانات"}</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div>
    </form>
  );
}
function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: number }) { return <div className="space-y-2"><Label>{label}</Label><Input name={name} type="number" min={0} defaultValue={defaultValue} /></div>; }
