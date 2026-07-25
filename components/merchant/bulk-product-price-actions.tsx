"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BulkProductPriceActions({ filters }: { filters: { q: string; status: string; categoryId: string } }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(formData: FormData) {
    const value = Number(formData.get("value") || 0);
    if (!Number.isFinite(value) || value <= 0) return setMessage("أدخل قيمة أكبر من صفر");
    const confirmText = String(formData.get("confirm") || "").trim();
    if (confirmText !== "تأكيد") return setMessage("اكتب كلمة تأكيد لتنفيذ التعديل الجماعي");
    setLoading(true);
    const response = await fetch("/api/merchant/products/bulk-prices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: "filtered",
        filters,
        adjustmentType: formData.get("adjustmentType"),
        direction: formData.get("direction"),
        value,
        updateBasePrice: formData.get("updateBasePrice") === "on"
      })
    });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? `✓ ${json.data?.message || "تم تعديل الأسعار"}` : json.message || "تعذر تعديل الأسعار");
    if (response.ok) router.refresh();
  }

  return (
    <form action={submit} className="mb-5 grid gap-3 rounded-3xl border border-blue-100 bg-blue-50/60 p-4 md:grid-cols-[170px_170px_160px_1fr_150px_auto] md:items-end">
      <div className="space-y-2">
        <Label>نوع التعديل</Label>
        <select name="direction" defaultValue="increase" className="h-11 w-full rounded-xl border bg-white px-4 text-sm">
          <option value="increase">زيادة</option>
          <option value="decrease">تخفيض</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label>طريقة الحساب</Label>
        <select name="adjustmentType" defaultValue="percentage" className="h-11 w-full rounded-xl border bg-white px-4 text-sm">
          <option value="percentage">نسبة %</option>
          <option value="amount">مبلغ ثابت</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label>القيمة</Label>
        <Input name="value" type="number" min="0.01" step="0.01" placeholder="مثال: 10" />
      </div>
      <label className="flex h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold">
        <input name="updateBasePrice" type="checkbox" defaultChecked /> تعديل السعر الأساسي أيضاً
      </label>
      <div className="space-y-2">
        <Label>اكتب: تأكيد</Label>
        <Input name="confirm" placeholder="تأكيد" />
      </div>
      <Button disabled={loading}>{loading ? "جارٍ التنفيذ..." : "تعديل جماعي"}</Button>
      <p className="text-xs font-bold leading-6 text-blue-700 md:col-span-6">سيتم تطبيق التعديل على نتائج الفلترة الحالية فقط. استخدم البحث/الحالة/القسم لتحديد المنتجات المطلوبة قبل التنفيذ.</p>
      {message ? <p className="rounded-xl bg-white p-3 text-sm font-bold text-slate-700 md:col-span-6">{message}</p> : null}
    </form>
  );
}
