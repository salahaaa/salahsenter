"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Variant = { variantId: string; productName: string; sku: string; title: string | null; stockQuantity: number };

export function InventoryForm({ variants, storeId }: { variants: Variant[]; storeId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/merchant/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, variantId: formData.get("variantId"), type: formData.get("type"), quantity: Number(formData.get("quantity") || 0), reason: formData.get("reason") || undefined })
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر تحديث المخزون");
    formElement.reset();
    setMessage("✓ تم تحديث المخزون بنجاح");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="variantId">المنتج / المتغير</Label><select id="variantId" name="variantId" required className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">اختر المتغير</option>{variants.map((variant) => <option key={variant.variantId} value={variant.variantId}>{variant.productName} — {variant.title || variant.sku} — المخزون {variant.stockQuantity}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="type">نوع الحركة</Label><select id="type" name="type" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="add">إضافة مخزون</option><option value="deduct">خصم مخزون</option><option value="adjust">جرد / ضبط للكمية</option></select></div>
      <div className="space-y-2"><Label htmlFor="quantity">الكمية</Label><Input id="quantity" name="quantity" type="number" required min={1} /></div>
      <div className="space-y-2"><Label htmlFor="reason">السبب</Label><Input id="reason" name="reason" placeholder="شراء، تلف، جرد..." /></div>
      <div className="flex items-center gap-3 md:col-span-2"><Button disabled={loading || !variants.length}>{loading ? "جارٍ الحفظ..." : "تحديث المخزون"}</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div>
    </form>
  );
}
