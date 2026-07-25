"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type StoreOption = { id: string; name: string; primaryWingId?: string | null };
type WingOption = { id: string; name: string };

export function NotificationBroadcastForm({ stores, wings }: { stores: StoreOption[]; wings: WingOption[] }) {
  const [target, setTarget] = useState<"all_stores" | "wing" | "stores">("all_stores");
  const [wingId, setWingId] = useState("");
  const [selectedStores, setSelectedStores] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredStores = useMemo(() => target === "wing" && wingId ? stores.filter((store) => store.primaryWingId === wingId) : stores, [stores, target, wingId]);

  function toggleStore(id: string) {
    setSelectedStores((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/admin/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target,
        wingId: target === "wing" ? wingId : undefined,
        storeIds: target === "stores" ? [...selectedStores] : undefined,
        title: data.get("title"),
        body: data.get("body"),
        type: "admin_broadcast"
      })
    });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? `✓ ${json.data?.message || "تم الإرسال"}` : json.message || "تعذر الإرسال");
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border bg-white p-6 shadow-card">
      <div className="mb-5">
        <h2 className="text-xl font-black text-slate-950">إرسال إشعار للمتاجر</h2>
        <p className="mt-1 text-sm text-slate-500">أرسل إشعاراً لمتجر محدد، عدة متاجر، متاجر جناح واحد أو كل المتاجر النشطة.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2"><Label>نطاق الإرسال</Label><select value={target} onChange={(event) => setTarget(event.target.value as any)} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="all_stores">كل المتاجر</option><option value="wing">متاجر جناح محدد</option><option value="stores">متاجر محددة</option></select></div>
        {target === "wing" ? <div className="space-y-2"><Label>الجناح</Label><select value={wingId} onChange={(event) => setWingId(event.target.value)} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">اختر الجناح</option>{wings.map((wing) => <option key={wing.id} value={wing.id}>{wing.name}</option>)}</select></div> : null}
        <div className="space-y-2 md:col-span-2"><Label>عنوان الإشعار</Label><Input name="title" required placeholder="تنبيه من إدارة المنصة" /></div>
        <div className="space-y-2 md:col-span-3"><Label>نص الإشعار</Label><Textarea name="body" required className="min-h-28" placeholder="اكتب رسالة واضحة تصل إلى لوحة التاجر ومركز التنبيهات" /></div>
      </div>
      {target === "stores" ? <div className="mt-4 rounded-2xl border bg-slate-50 p-4"><p className="mb-3 text-sm font-black text-slate-800">اختر المتاجر</p><div className="grid max-h-64 gap-2 overflow-auto md:grid-cols-3">{filteredStores.map((store) => <label key={store.id} className="flex items-center gap-2 rounded-xl bg-white p-3 text-sm font-bold"><input type="checkbox" checked={selectedStores.has(store.id)} onChange={() => toggleStore(store.id)} /> {store.name}</label>)}</div></div> : null}
      {target === "wing" && wingId ? <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">سيصل الإشعار إلى {filteredStores.length} متجر في هذا الجناح.</p> : null}
      <div className="mt-5 flex flex-wrap items-center gap-3"><Button disabled={loading}><Send className="h-4 w-4" /> {loading ? "جارٍ الإرسال..." : "إرسال الإشعار"}</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div>
    </form>
  );
}
