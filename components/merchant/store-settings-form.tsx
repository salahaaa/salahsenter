"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediaUrlInput } from "@/components/media/media-url-input";

export function StoreSettingsForm({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState("category");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    setLoading(true);
    setMessage(null);
    const payload: Record<string, unknown> = { storeId, kind, name: formData.get("name"), sortOrder: Number(formData.get("sortOrder") || 0), isActive: true };
    if (kind === "category") payload.imageUrl = formData.get("imageUrl") || "";
    if (kind === "unit") payload.symbol = formData.get("symbol") || undefined;
    if (kind === "color") payload.hexCode = formData.get("hexCode") || undefined;

    const response = await fetch("/api/merchant/store-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر الحفظ");
    formElement.reset();
    setMessage("✓ تم حفظ إعداد المتجر بنجاح");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="kind">النوع</Label><select id="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="category">قسم</option><option value="unit">وحدة</option><option value="size">مقاس</option><option value="color">لون</option></select></div>
      <Field label="الاسم" name="name" required />
      {kind === "category" ? <MediaUrlInput label="صورة القسم: رفع أو رابط" name="imageUrl" storeId={storeId} folder={`stores/${storeId}/categories`} accept="image/*" /> : null}
      {kind === "unit" ? <Field label="رمز الوحدة" name="symbol" placeholder="kg / L / pcs" /> : null}
      {kind === "color" ? <Field label="كود اللون" name="hexCode" placeholder="#ffffff" /> : null}
      <Field label="ترتيب الظهور" name="sortOrder" type="number" />
      <div className="flex items-center gap-3 md:col-span-2"><Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ"}</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div>
    </form>
  );
}

function Field({ label, name, type = "text", required = false, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} placeholder={placeholder || ""} /></div>;
}
