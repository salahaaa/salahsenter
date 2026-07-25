"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Category = { id: string; name: string; level: number; code: string | null };

export function BulkInventoryTools({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    await post({ mode: "category_price", categoryId: f.get("categoryId"), adjustmentType: f.get("adjustmentType"), value: Number(f.get("value") || 0) });
  }

  async function submitThreshold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    await post({ mode: "all_low_stock_threshold", threshold: Number(f.get("threshold") || 0) });
  }

  async function post(payload: Record<string, unknown>) {
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/merchant/inventory/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json();
    setLoading(false);
    setMessage(response.ok ? `✓ ${json.data?.message || json.message || "تم التنفيذ"} (${json.data?.count || 0})` : json.message || "تعذر التنفيذ");
    if (response.ok) router.refresh();
  }

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-card">
      <h2 className="mb-2 flex items-center gap-2 text-xl font-black text-slate-950"><SlidersHorizontal className="h-5 w-5 text-blue-600" /> أدوات جماعية للأسعار والمخزون</h2>
      <p className="mb-5 text-sm leading-7 text-slate-500">يمكنك تعديل أسعار منتجات صنف كامل أو ضبط حد قرب النفاد لكل المتغيرات دفعة واحدة.</p>
      <div className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={submitPrice} className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2"><Label>الصنف</Label><select name="categoryId" required className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">اختر الصنف</option>{categories.map((category) => <option key={category.id} value={category.id}>{"—".repeat(category.level)} {category.code || ""} {category.name}</option>)}</select></div>
          <div className="space-y-2"><Label>طريقة التعديل</Label><select name="adjustmentType" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="percent">نسبة %</option><option value="fixed">مبلغ ثابت</option></select></div>
          <div className="space-y-2"><Label>القيمة</Label><Input name="value" type="number" required placeholder="10 أو -5" /></div>
          <Button disabled={loading || !categories.length} className="md:col-span-2">تعديل أسعار الصنف</Button>
        </form>
        <form onSubmit={submitThreshold} className="grid gap-3 rounded-2xl bg-slate-50 p-4">
          <div className="space-y-2"><Label>حد التنبيه لقرب النفاد لكل المخزون</Label><Input name="threshold" type="number" min={0} required placeholder="مثلاً 5" /></div>
          <Button disabled={loading}>تطبيق على كامل المخزون</Button>
        </form>
      </div>
      {message ? <p className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</p> : null}
    </section>
  );
}
