"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Address = { id: string; label: string; recipientName: string; phone: string; governorateId: string | null; cityText: string | null; districtText: string | null; addressLine: string; landmark: string | null; isDefault: boolean };
type Governorate = { id: string; name: string };

export function AddressBookPanel({ addresses, governorates }: { addresses: Address[]; governorates: Governorate[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    const response = await fetch("/api/customer/addresses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: f.get("label"), recipientName: f.get("recipientName"), phone: f.get("phone"), governorateId: f.get("governorateId") || null, cityText: f.get("cityText"), districtText: f.get("districtText"), addressLine: f.get("addressLine"), landmark: f.get("landmark") || undefined, isDefault: f.get("isDefault") === "on" }) });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم حفظ العنوان" : json.message || "تعذر حفظ العنوان");
    if (response.ok) { form.reset(); router.refresh(); }
  }
  async function remove(id: string) { await fetch(`/api/customer/addresses/${id}`, { method: "DELETE" }); router.refresh(); }
  async function makeDefault(id: string) { await fetch(`/api/customer/addresses/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isDefault: true }) }); router.refresh(); }
  return <div className="space-y-8"><form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-3"><Field label="اسم العنوان" name="label" placeholder="البيت / العمل"/><Field label="اسم المستلم" name="recipientName" required/><Field label="الهاتف" name="phone" required/><div className="space-y-2"><Label>المحافظة</Label><select name="governorateId" required className="h-11 w-full rounded-xl border bg-white px-3 text-sm"><option value="">اختر المحافظة</option>{governorates.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div><Field label="المدينة" name="cityText" required/><Field label="المنطقة/المديرية" name="districtText"/><Field label="معلم قريب" name="landmark"/><div className="space-y-2 md:col-span-3"><Label>العنوان التفصيلي</Label><Textarea name="addressLine" required/></div><label className="flex items-center gap-2 text-sm font-bold"><input name="isDefault" type="checkbox"/> عنوان افتراضي</label><Button className="md:col-span-2">حفظ العنوان</Button>{message?<p className="text-sm font-bold text-slate-600 md:col-span-3">{message}</p>:null}</form><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{addresses.map((a)=><article key={a.id} className="rounded-3xl border bg-white p-5 shadow-card"><div className="flex items-center justify-between"><h3 className="font-black">{a.label}</h3>{a.isDefault?<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">افتراضي</span>:null}</div><p className="mt-2 text-sm font-bold">{a.recipientName} — {a.phone}</p><p className="mt-1 text-sm text-slate-500">{[a.cityText,a.districtText].filter(Boolean).join("، ")}</p><p className="mt-2 text-sm text-slate-600">{a.addressLine}</p><div className="mt-4 flex gap-2"><Button size="sm" variant="outline" onClick={()=>makeDefault(a.id)}>افتراضي</Button><Button size="sm" variant="destructive" onClick={()=>remove(a.id)}>حذف</Button></div></article>)}</section></div>;
}
function Field({label,name,type="text",required=false,placeholder}:{label:string;name:string;type?:string;required?:boolean;placeholder?:string}){return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} required={required} placeholder={placeholder}/></div>}
