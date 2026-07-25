"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUrlInput } from "@/components/media/media-url-input";

export function PaymentProofForm({ orderId, amount, currency }: { orderId: string; amount: string | number; currency: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setLoading(true);
    const response = await fetch("/api/payments/proof", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, transactionReference: data.get("transactionReference") || undefined, senderName: data.get("senderName") || undefined, senderPhone: data.get("senderPhone") || undefined, amount: Number(data.get("amount") || amount || 0), proofUrl: data.get("proofUrl") || undefined, note: data.get("note") || undefined }) });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? "✓ تم إرسال إثبات الدفع للتاجر" : json.message || "تعذر إرسال إثبات الدفع");
    if (response.ok) { form.reset(); router.refresh(); }
  }
  return <form onSubmit={submit} className="mt-4 grid gap-3 rounded-2xl border bg-slate-50 p-4 md:grid-cols-2"><div className="space-y-2"><Label>رقم العملية / الحوالة</Label><Input name="transactionReference" /></div><div className="space-y-2"><Label>اسم المرسل</Label><Input name="senderName" /></div><div className="space-y-2"><Label>هاتف المرسل</Label><Input name="senderPhone" /></div><div className="space-y-2"><Label>المبلغ ({currency})</Label><Input name="amount" type="number" defaultValue={String(amount || 0)} /></div><div className="md:col-span-2"><MediaUrlInput label="صورة إيصال الدفع" name="proofUrl" folder="payment-proofs" accept="image/*" /></div><div className="space-y-2 md:col-span-2"><Label>ملاحظات</Label><Textarea name="note" /></div><div className="md:col-span-2 flex items-center gap-3"><Button disabled={loading}>{loading ? "جارٍ الإرسال..." : "إرسال إثبات الدفع"}</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div></form>;
}
