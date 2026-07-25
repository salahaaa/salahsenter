"use client";

import { useState } from "react";
import { FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentProofForm } from "@/components/payments/payment-proof-form";

type ManualInstructions = { provider: string; label: string; requiresProof: boolean; instructions: string; fields: Record<string, string> };

export function PaymentStartPanel({ orderId, provider, paymentStatus, amount, currency }: { orderId: string; provider: string; paymentStatus: string; amount: number | string; currency: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<ManualInstructions | null>(null);

  async function start() {
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/payments/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok || !json.success) return setMessage(json.message || "تعذر بدء الدفع");
    const data = json.data;
    if (data.mode === "redirect" && data.url) window.location.href = data.url;
    else {
      setMessage(data.message || "اتبع تعليمات وسيلة الدفع.");
      setInstructions(data.instructions || null);
    }
  }

  return <div className="rounded-3xl border bg-white p-6 text-right shadow-card"><h2 className="text-xl font-black">الدفع لهذا المتجر</h2><p className="mt-2 text-sm text-slate-500">المزود: {provider} — الحالة: {paymentStatus}</p><Button className="mt-5 w-full rounded-2xl" disabled={loading || paymentStatus === "paid"} onClick={start}>{paymentStatus === "paid" ? "تم الدفع" : loading ? "جارٍ بدء الدفع..." : "بدء الدفع لهذا الطلب"}</Button>{message ? <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{message}</p> : null}{instructions ? <div className="mt-5 space-y-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700"/><div><p className="font-black text-blue-950">تعليمات {instructions.label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-blue-900">{instructions.instructions}</p></div></div>{instructions.requiresProof ? <div className="border-t border-blue-100 pt-4"><div className="mb-3 flex items-center gap-2 font-black text-blue-950"><FileText className="h-4 w-4"/> أرسل إثبات الدفع لهذا الطلب فقط</div><PaymentProofForm orderId={orderId} amount={amount} currency={currency} /></div> : null}</div> : null}</div>;
}
