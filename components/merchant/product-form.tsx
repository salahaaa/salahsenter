"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ProductForm({ storeId }: { storeId?: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    setLoading(true);
    setMessage(null);

    const type = formData.get("type") as "simple" | "variable";
    const payload = {
      storeId,
      name: formData.get("name"),
      description: formData.get("description"),
      type,
      status: formData.get("status"),
      basePrice: Number(formData.get("price") || 0),
      mainImageUrl: formData.get("mainImageUrl") || "",
      variants: [
        {
          sku: formData.get("sku"),
          title: formData.get("variantTitle") || "افتراضي",
          price: Number(formData.get("price") || 0),
          stockQuantity: Number(formData.get("stockQuantity") || 0),
          lowStockThreshold: Number(formData.get("lowStockThreshold") || 5),
          imageUrl: formData.get("mainImageUrl") || ""
        }
      ]
    };

    const response = await fetch("/api/merchant/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage(json.message || "تعذر حفظ المنتج");
      return;
    }
    formElement.reset();
    setMessage("✓ تم حفظ المنتج بنجاح");
  }

  return (
    <form onSubmit={submit} className="grid gap-5 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2">
      <Field label="اسم المنتج" name="name" required />
      <Field label="SKU" name="sku" required placeholder="SKU-001" />
      <div className="space-y-2">
        <Label htmlFor="type">نوع المنتج</Label>
        <select id="type" name="type" className="h-11 w-full rounded-xl border bg-white px-4 text-sm">
          <option value="simple">منتج بسيط</option>
          <option value="variable">منتج متعدد المتغيرات</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">الحالة</Label>
        <select id="status" name="status" className="h-11 w-full rounded-xl border bg-white px-4 text-sm">
          <option value="draft">مسودة</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
        </select>
      </div>
      <Field label="السعر" name="price" type="number" required />
      <Field label="المخزون" name="stockQuantity" type="number" required />
      <Field label="حد التنبيه لقرب النفاد" name="lowStockThreshold" type="number" placeholder="5" />
      <Field label="عنوان المتغير" name="variantTitle" placeholder="مثال: 40 أبيض" />
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="mainImageUrl">رابط صورة المنتج</Label>
        <Input id="mainImageUrl" name="mainImageUrl" placeholder="https://..." />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="description">الوصف</Label>
        <Textarea id="description" name="description" />
      </div>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ المنتج"}</Button>
        {message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}
      </div>
    </form>
  );
}

function Field({ label, name, type = "text", required = false, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} placeholder={placeholder} />
    </div>
  );
}
