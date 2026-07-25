"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PaymentReceiptActions({ receiptId, status }: { receiptId: string; status: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  async function review(nextStatus: "approved" | "rejected") {
    const note = window.prompt("ملاحظة اختيارية", "") || undefined;
    const response = await fetch(`/api/merchant/payment-receipts/${receiptId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus, note }) });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم تحديث إثبات الدفع" : json.message || "تعذر التحديث");
    if (response.ok) router.refresh();
  }
  return <div className="flex flex-wrap gap-2"><Button size="sm" disabled={status !== "pending"} onClick={() => review("approved")}>قبول الدفع</Button><Button size="sm" variant="destructive" disabled={status !== "pending"} onClick={() => review("rejected")}>رفض</Button>{message ? <span className="text-xs font-bold text-slate-500">{message}</span> : null}</div>;
}
