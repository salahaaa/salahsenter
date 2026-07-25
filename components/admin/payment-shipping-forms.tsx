"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function PaymentMethodForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const f = new FormData(formElement);
    const response = await fetch("/api/admin/payment-methods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.get("name"), code: f.get("code"), provider: f.get("provider") || "manual", description: f.get("description") || undefined, sortOrder: Number(f.get("sortOrder") || 0), isActive: true }) });
    const json = await response.json();
    setMessage(response.ok ? "✓ تم حفظ وسيلة الدفع" : json.message || "تعذر الحفظ");
    if (response.ok) { formElement.reset(); router.refresh(); }
  }
  return <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2"><Field label="الاسم" name="name" required /><Field label="الكود" name="code" required /><Field label="المزود" name="provider" placeholder="manual / gateway" /><Field label="الترتيب" name="sortOrder" type="number" /><div className="space-y-2 md:col-span-2"><Label htmlFor="paymentDescription">الوصف</Label><Textarea id="paymentDescription" name="description" /></div><div className="flex items-center gap-3 md:col-span-2"><Button>حفظ وسيلة الدفع</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div></form>;
}

export function ShippingMethodForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const f = new FormData(formElement);
    const response = await fetch("/api/admin/shipping-methods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.get("name"), code: f.get("code"), fee: Number(f.get("fee") || 0), estimatedDaysMin: Number(f.get("estimatedDaysMin") || 1), estimatedDaysMax: Number(f.get("estimatedDaysMax") || 3), description: f.get("description") || undefined, sortOrder: Number(f.get("sortOrder") || 0), isActive: true }) });
    const json = await response.json();
    setMessage(response.ok ? "✓ تم حفظ وسيلة الشحن" : json.message || "تعذر الحفظ");
    if (response.ok) { formElement.reset(); router.refresh(); }
  }
  return <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2"><Field label="الاسم" name="name" required /><Field label="الكود" name="code" required /><Field label="رسوم الشحن" name="fee" type="number" /><Field label="الترتيب" name="sortOrder" type="number" /><Field label="أقل مدة بالأيام" name="estimatedDaysMin" type="number" /><Field label="أقصى مدة بالأيام" name="estimatedDaysMax" type="number" /><div className="space-y-2 md:col-span-2"><Label htmlFor="shippingDescription">الوصف</Label><Textarea id="shippingDescription" name="description" /></div><div className="flex items-center gap-3 md:col-span-2"><Button>حفظ وسيلة الشحن</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div></form>;
}

function Field({ label, name, type = "text", required = false, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} placeholder={placeholder || ""} /></div>; }
