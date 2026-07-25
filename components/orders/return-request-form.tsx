"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Item = { id: string; productName: string; quantity: number };

export function ReturnRequestForm({ orderId, items }: { orderId: string; items: Item[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const returnItems = Object.entries(selected).filter(([, qty]) => qty > 0).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (!returnItems.length) return setMessage("اختر منتجاً واحداً على الأقل للإرجاع");
    const response = await fetch(`/api/orders/${orderId}/returns`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: form.get("reason"), description: form.get("description") || undefined, items: returnItems }) });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم إرسال طلب الإرجاع" : json.message || "تعذر إرسال طلب الإرجاع");
    if (response.ok) router.refresh();
  }
  return <form onSubmit={submit} className="space-y-3 rounded-2xl border bg-slate-50 p-4"><h3 className="font-black">طلب إرجاع / استرداد</h3>{items.map((item)=><label key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm"><span className="font-bold">{item.productName}</span><input type="number" min={0} max={item.quantity} value={selected[item.id] || 0} onChange={(e)=>setSelected({...selected,[item.id]:Number(e.target.value||0)})} className="h-9 w-20 rounded-lg border text-center"/></label>)}<div className="space-y-2"><Label>سبب الإرجاع</Label><input name="reason" required className="h-10 w-full rounded-xl border bg-white px-3 text-sm" placeholder="مثال: المنتج مختلف / تالف"/></div><div className="space-y-2"><Label>شرح إضافي</Label><Textarea name="description"/></div><Button size="sm">إرسال طلب الإرجاع</Button>{message?<p className="text-xs font-bold text-slate-600">{message}</p>:null}</form>;
}
