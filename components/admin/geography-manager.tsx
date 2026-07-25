"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type GeoItem = { id: string; name: string; isActive: boolean; sortOrder: number };

type Kind = "countries" | "governorates" | "cities" | "districts";

const labels: Record<Kind, string> = {
  countries: "الدول",
  governorates: "المحافظات",
  cities: "المدن",
  districts: "المناطق"
};

export function GeographyManager({ countries, governorates, cities, districts }: { countries: GeoItem[]; governorates: GeoItem[]; cities: GeoItem[]; districts: GeoItem[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loadingSeed, setLoadingSeed] = useState(false);

  async function seedYemen() {
    if (!window.confirm("سيتم إضافة/تفعيل كل محافظات اليمن والمدن الرئيسية. هل تريد المتابعة؟")) return;
    setLoadingSeed(true);
    const response = await fetch("/api/admin/geography/yemen", { method: "POST" });
    const json = await response.json().catch(() => ({}));
    setLoadingSeed(false);
    setMessage(response.ok ? `✓ ${json.data?.message || "تم تجهيز محافظات اليمن"}` : json.message || "تعذر تجهيز محافظات اليمن");
    if (response.ok) router.refresh();
  }

  return (
    <section className="rounded-3xl border bg-white p-5 shadow-card">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-950">إدارة وتعديل المناطق</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">يمكنك تعديل الاسم، الترتيب، التفعيل أو التعطيل. زر اليمن يضيف كل المحافظات الأساسية.</p>
        </div>
        <Button type="button" onClick={seedYemen} disabled={loadingSeed}>{loadingSeed ? "جارٍ التجهيز..." : "تجهيز كل محافظات اليمن"}</Button>
      </div>
      {message ? <p className="mb-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</p> : null}
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <GeoList kind="countries" items={countries} />
        <GeoList kind="governorates" items={governorates} />
        <GeoList kind="cities" items={cities} />
        <GeoList kind="districts" items={districts} />
      </div>
    </section>
  );
}

function GeoList({ kind, items }: { kind: Kind; items: GeoItem[] }) {
  return (
    <div className="rounded-3xl border bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-black text-slate-950">{labels[kind]}</h3>
        <Badge variant="outline">{items.length}</Badge>
      </div>
      {!items.length ? <p className="rounded-2xl bg-white p-4 text-sm font-bold text-slate-400">لا توجد عناصر</p> : <div className="max-h-[520px] space-y-2 overflow-auto pr-1">{items.map((item) => <GeoRow key={item.id} kind={kind} item={item} />)}</div>}
    </div>
  );
}

function GeoRow({ kind, item }: { kind: Kind; item: GeoItem }) {
  const router = useRouter();
  const [name, setName] = useState(item.name);
  const [sortOrder, setSortOrder] = useState(item.sortOrder || 0);
  const [isActive, setIsActive] = useState(item.isActive);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const response = await fetch(`/api/admin/geography/${kind}/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sortOrder, isActive })
    });
    const json = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return alert(json.message || "تعذر التعديل");
    router.refresh();
  }

  async function disable() {
    if (!window.confirm(`تعطيل ${item.name}؟`)) return;
    setSaving(true);
    const response = await fetch(`/api/admin/geography/${kind}/${item.id}`, { method: "DELETE" });
    const json = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return alert(json.message || "تعذر التعطيل");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border bg-white p-3">
      <Input value={name} onChange={(event) => setName(event.target.value)} className="mb-2" />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input type="number" value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value || 0))} />
        <label className="flex items-center gap-1 rounded-xl border bg-slate-50 px-2 text-xs font-bold"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /> نشط</label>
      </div>
      <div className="mt-2 flex gap-2">
        <Button type="button" size="sm" className="flex-1" onClick={save} disabled={saving}>{saving ? "..." : "حفظ"}</Button>
        <Button type="button" size="sm" variant="outline" onClick={disable} disabled={saving}>تعطيل</Button>
      </div>
    </div>
  );
}
