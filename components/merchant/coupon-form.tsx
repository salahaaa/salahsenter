"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Coupon = { id: string; code: string; title: string; discountType: string; discountValue: string; status: string; usedCount: number };

export function CouponManagementPanel({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    const response = await fetch("/api/merchant/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: f.get("code"), title: f.get("title"), description: f.get("description") || undefined, discountType: f.get("discountType"), discountValue: Number(f.get("discountValue") || 0), maxDiscount: f.get("maxDiscount") ? Number(f.get("maxDiscount")) : null, minOrderAmount: Number(f.get("minOrderAmount") || 0), usageLimit: f.get("usageLimit") ? Number(f.get("usageLimit")) : null, perCustomerLimit: Number(f.get("perCustomerLimit") || 1), startsAt: f.get("startsAt") ? new Date(String(f.get("startsAt"))).toISOString() : null, endsAt: f.get("endsAt") ? new Date(String(f.get("endsAt"))).toISOString() : null, status: f.get("status") || "active" }) });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم حفظ الكوبون" : json.message || "تعذر الحفظ");
    if (response.ok) { form.reset(); router.refresh(); }
  }
  return <div className="space-y-8"><form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-3"><Field label="الكود" name="code" required/><Field label="العنوان" name="title" required/><div className="space-y-2"><Label>نوع الخصم</Label><select name="discountType" className="h-11 w-full rounded-xl border bg-white px-3"><option value="percent">نسبة %</option><option value="fixed">مبلغ ثابت</option></select></div><Field label="قيمة الخصم" name="discountValue" type="number" required/><Field label="أقصى خصم" name="maxDiscount" type="number"/><Field label="أقل مبلغ طلب" name="minOrderAmount" type="number"/><Field label="حد الاستخدام" name="usageLimit" type="number"/><Field label="حد العميل" name="perCustomerLimit" type="number"/><div className="space-y-2"><Label>الحالة</Label><select name="status" className="h-11 w-full rounded-xl border bg-white px-3"><option value="active">نشط</option><option value="draft">مسودة</option><option value="disabled">معطل</option></select></div><Field label="البداية" name="startsAt" type="datetime-local"/><Field label="النهاية" name="endsAt" type="datetime-local"/><div className="space-y-2 md:col-span-3"><Label>وصف</Label><Textarea name="description"/></div><Button className="md:col-span-3">حفظ الكوبون</Button>{message?<p className="text-sm font-bold text-slate-600 md:col-span-3">{message}</p>:null}</form><section className="rounded-3xl border bg-white p-6 shadow-card"><h2 className="mb-4 text-xl font-black">كوبوناتي</h2>{!coupons.length?<p className="text-sm text-slate-400">لا توجد كوبونات</p>:<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{coupons.map((c)=><article key={c.id} className="rounded-2xl border bg-slate-50 p-4"><h3 className="font-black">{c.code}</h3><p className="text-sm text-slate-600">{c.title}</p><p className="mt-2 text-xs font-bold text-slate-500">{c.discountType}: {c.discountValue} — استخدام: {c.usedCount}</p><span className="mt-2 inline-block rounded-full bg-white px-3 py-1 text-xs font-black">{c.status}</span></article>)}</div>}</section></div>;
}
function Field({label,name,type="text",required=false}:{label:string;name:string;type?:string;required?:boolean}){return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} required={required}/></div>}
