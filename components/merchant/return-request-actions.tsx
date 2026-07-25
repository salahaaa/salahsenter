"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ReturnRequestActions({ returnRequestId, status, refundAmount }: { returnRequestId: string; status: string; refundAmount?: string | null }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  async function update(nextStatus: string) {
    const resolution = window.prompt("ملاحظة للتحديث", "") || undefined;
    const amount = nextStatus === "refunded" ? Number(window.prompt("مبلغ الاسترداد", String(refundAmount || 0)) || 0) : undefined;
    const response = await fetch(`/api/merchant/returns/${returnRequestId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus, resolution, refundAmount: amount }) });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم تحديث الإرجاع" : json.message || "تعذر تحديث الإرجاع");
    if (response.ok) router.refresh();
  }
  return <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>update("approved")} disabled={status!=="requested"}>قبول</Button><Button size="sm" variant="destructive" onClick={()=>update("rejected")} disabled={status!=="requested"}>رفض</Button><Button size="sm" variant="outline" onClick={()=>update("received")} disabled={!['approved'].includes(status)}>تم الاستلام</Button><Button size="sm" onClick={()=>update("refunded")} disabled={!['approved','received'].includes(status)}>استرداد</Button>{message?<span className="text-xs font-bold text-slate-500">{message}</span>:null}</div>;
}
