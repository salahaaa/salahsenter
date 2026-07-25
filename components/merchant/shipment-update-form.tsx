"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Shipment = { trackingNumber: string | null; carrierName: string | null; status: string } | null;

export function ShipmentUpdateForm({ orderId, shipment }: { orderId: string; shipment: Shipment }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const response = await fetch(`/api/orders/${orderId}/shipment`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trackingNumber: f.get("trackingNumber") || null, carrierName: f.get("carrierName") || null, status: f.get("status") || "pending" }) });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم تحديث الشحن" : json.message || "تعذر تحديث الشحن");
    if (response.ok) router.refresh();
  }
  return <form onSubmit={submit} className="grid gap-3 rounded-3xl border bg-white p-5 shadow-card md:grid-cols-4"><div className="space-y-2"><Label>شركة الشحن</Label><Input name="carrierName" defaultValue={shipment?.carrierName || ""}/></div><div className="space-y-2"><Label>رقم التتبع</Label><Input name="trackingNumber" defaultValue={shipment?.trackingNumber || ""}/></div><div className="space-y-2"><Label>حالة الشحنة</Label><select name="status" defaultValue={shipment?.status || "pending"} className="h-11 w-full rounded-xl border bg-white px-3 text-sm"><option value="pending">قيد الانتظار</option><option value="ready">جاهزة</option><option value="shipped">تم الشحن</option><option value="delivered">تم التسليم</option><option value="returned">مرتجعة</option></select></div><div className="flex items-end gap-2"><Button>حفظ الشحن</Button>{message ? <span className="text-xs font-bold text-slate-500">{message}</span> : null}</div></form>;
}
