"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SubscriptionForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    setLoading(true);
    setMessage(null);
    const features = String(formData.get("features") || "").split("\n").map((x) => x.trim()).filter(Boolean);
    const response = await fetch("/api/admin/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"), code: formData.get("code"), price: Number(formData.get("price") || 0), durationDays: Number(formData.get("durationDays") || 30),
        maxProducts: Number(formData.get("maxProducts") || 100), maxEmployees: Number(formData.get("maxEmployees") || 3), maxAnnouncements: Number(formData.get("maxAnnouncements") || 3),
        maxNews: Number(formData.get("maxNews") || 10), maxBranches: Number(formData.get("maxBranches") || 1), features, isActive: true
      })
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر الحفظ");
    formElement.reset();
    setMessage("✓ تم حفظ الباقة بنجاح");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-3">
      <Field label="اسم الباقة" name="name" required /><Field label="الكود" name="code" required /><Field label="السعر" name="price" type="number" />
      <Field label="مدة الاشتراك بالأيام" name="durationDays" type="number" /><Field label="عدد المنتجات" name="maxProducts" type="number" /><Field label="عدد الموظفين" name="maxEmployees" type="number" />
      <Field label="عدد الإعلانات" name="maxAnnouncements" type="number" /><Field label="عدد الأخبار" name="maxNews" type="number" /><Field label="عدد الفروع" name="maxBranches" type="number" />
      <div className="space-y-2 md:col-span-3"><Label htmlFor="features">المميزات — سطر لكل ميزة</Label><Textarea id="features" name="features" /></div>
      <div className="flex items-center gap-3 md:col-span-3"><Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ الباقة"}</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div>
    </form>
  );
}
function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} /></div>;
}
