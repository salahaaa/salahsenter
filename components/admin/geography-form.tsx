"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Country = { id: string; name: string };
type Governorate = { id: string; name: string; countryId: string };
type City = { id: string; name: string; governorateId: string };

export function GeographyForm({ countries, governorates, cities }: { countries: Country[]; governorates: Governorate[]; cities: City[] }) {
  const router = useRouter();
  const [kind, setKind] = useState("country");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    setLoading(true);
    setMessage(null);
    const payload: Record<string, unknown> = {
      kind,
      name: formData.get("name"),
      sortOrder: Number(formData.get("sortOrder") || 0),
      isActive: true
    };
    if (kind === "country") {
      payload.iso2 = formData.get("iso2") || undefined;
      payload.phoneCode = formData.get("phoneCode") || undefined;
    }
    if (kind === "governorate") payload.countryId = formData.get("countryId");
    if (kind === "city") payload.governorateId = formData.get("governorateId");
    if (kind === "district") payload.cityId = formData.get("cityId");

    const response = await fetch("/api/admin/geography", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر الحفظ");
    formElement.reset();
    setMessage("✓ تم حفظ العنصر الجغرافي بنجاح");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="kind">نوع العنصر</Label>
        <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="h-11 w-full rounded-xl border bg-white px-4 text-sm">
          <option value="country">دولة</option>
          <option value="governorate">محافظة</option>
          <option value="city">مدينة</option>
          <option value="district">منطقة</option>
        </select>
      </div>
      <Field label="الاسم" name="name" required />
      {kind === "country" ? <><Field label="ISO2" name="iso2" /><Field label="كود الهاتف" name="phoneCode" /></> : null}
      {kind === "governorate" ? <Select label="الدولة" name="countryId" items={countries} required /> : null}
      {kind === "city" ? <Select label="المحافظة" name="governorateId" items={governorates} required /> : null}
      {kind === "district" ? <Select label="المدينة" name="cityId" items={cities} required /> : null}
      <Field label="ترتيب الظهور" name="sortOrder" type="number" />
      <div className="flex items-center gap-3 md:col-span-2"><Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ"}</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div>
    </form>
  );
}

function Select({ label, name, items, required }: { label: string; name: string; items: Array<{ id: string; name: string }>; required?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><select id={name} name={name} required={required} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">اختر</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>;
}
function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} /></div>;
}
