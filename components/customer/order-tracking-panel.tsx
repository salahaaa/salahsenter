"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Clock3, MapPin, Phone, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

type TrackData = {
  order: { orderNumber: string; statusCode: string; statusLabel: string; nextStep: string; paymentStatus: string; paymentLabel: string; createdAt: string };
  store: { name: string; slug: string; contactPhone?: string | null };
  delivery: { shippingMethodName: string | null; trackingNumber: string | null; courierName: string | null; courierPhone: string | null; estimatedDays: { min: number; max: number } | null; customerInstructions: string | null; destination: string | null };
  history: Array<{ toStatus: string; statusLabel: string; note: string | null; createdAt: string }>;
};

const progress = ["new", "confirmed", "preparing", "ready_to_ship", "shipped", "delivered", "closed"];

export function OrderTrackingPanel() {
  const [data, setData] = useState<TrackData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const response = await fetch(`/api/orders/track?orderNumber=${encodeURIComponent(String(f.get("orderNumber")||""))}&identifier=${encodeURIComponent(String(f.get("identifier")||""))}`);
    const json = await response.json().catch(()=>({}));
    if (!response.ok) { setData(null); setMessage(json.message || "تعذر التتبع"); }
    else { setData(json.data); setMessage(null); }
  }
  const currentStep = data ? Math.max(0, progress.indexOf(data.order.statusCode)) : -1;
  return <div className="space-y-6"><form onSubmit={submit} className="grid gap-3 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-[1fr_1fr_auto]"><input name="orderNumber" className="h-11 rounded-xl border px-3" placeholder="رقم الطلب ORD-..." required/><input name="identifier" className="h-11 rounded-xl border px-3" placeholder="البريد أو رقم الهاتف" required/><Button>تتبع</Button></form>{message?<p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600">{message}</p>:null}{data?<section className="space-y-6 rounded-3xl border bg-white p-6 shadow-card"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-black">{data.order.orderNumber}</h2><p className="mt-2 text-sm text-slate-500">المتجر: {data.store.name}</p></div><div className="rounded-2xl bg-blue-50 p-3 text-sm font-black text-blue-800">{data.order.nextStep}</div></div><div className="grid gap-3 md:grid-cols-3"><Info label="حالة الطلب" value={data.order.statusLabel}/><Info label="الدفع" value={data.order.paymentLabel}/><Info label="طريقة الشحن" value={data.delivery.shippingMethodName || "سيؤكدها التاجر"}/></div>{data.order.statusCode !== "cancelled" ? <div className="grid gap-2 md:grid-cols-7">{progress.map((step,index)=><div key={step} className={`rounded-xl p-3 text-center text-xs font-black ${index <= currentStep ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}><CheckCircle2 className="mx-auto mb-1 h-4 w-4"/>{index === currentStep ? data.order.statusLabel : step.replaceAll("_"," ")}</div>)}</div> : null}<div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><h3 className="flex items-center gap-2 font-black"><Truck className="h-5 w-5 text-primary"/> تفاصيل التوصيل</h3><div className="mt-3 space-y-2 text-sm text-slate-600">{data.delivery.trackingNumber?<p>رقم التتبع: <b>{data.delivery.trackingNumber}</b></p>:null}{data.delivery.courierName?<p>المندوب/الشحن: <b>{data.delivery.courierName}</b></p>:null}{data.delivery.courierPhone?<p><Phone className="ml-1 inline h-4 w-4"/>{data.delivery.courierPhone}</p>:null}{data.delivery.estimatedDays?<p><Clock3 className="ml-1 inline h-4 w-4"/>التسليم المتوقع: {data.delivery.estimatedDays.min}-{data.delivery.estimatedDays.max} أيام</p>:null}{data.delivery.customerInstructions?<p>{data.delivery.customerInstructions}</p>:null}</div></div><div className="rounded-2xl bg-slate-50 p-4"><h3 className="flex items-center gap-2 font-black"><MapPin className="h-5 w-5 text-primary"/> وجهة التوصيل</h3><p className="mt-3 text-sm leading-7 text-slate-600">{data.delivery.destination || "العنوان مسجل لدى المتجر"}</p>{data.store.contactPhone?<p className="mt-3 text-sm font-bold text-primary">للتواصل مع المتجر: {data.store.contactPhone}</p>:null}</div></div><h3 className="font-black">سجل الطلب</h3><div className="space-y-2">{data.history.map((h,i)=><div key={i} className="rounded-xl bg-slate-50 p-3 text-sm"><b>{h.statusLabel}</b><p className="text-xs text-slate-500">{h.note || "تم تحديث حالة الطلب"} — {new Intl.DateTimeFormat('ar',{dateStyle:'short',timeStyle:'short'}).format(new Date(h.createdAt))}</p></div>)}</div></section>:null}</div>;
}
function Info({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 font-black">{value}</p></div>}
