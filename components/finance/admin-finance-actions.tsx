"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AdminPayoutActions({ payoutId, status }: { payoutId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function update(nextStatus: "approved" | "paid" | "rejected" | "cancelled") {
    const note = window.prompt("ملاحظة اختيارية", "") || undefined;
    setLoading(true);
    const response = await fetch(`/api/admin/finance/payouts/${payoutId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus, note }) });
    setLoading(false);
    if (!response.ok) alert((await response.json().catch(()=>({}))).message || "تعذر التحديث");
    router.refresh();
  }
  return <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={loading || status !== "requested"} onClick={()=>update("approved")}>اعتماد</Button><Button size="sm" disabled={loading || status !== "approved"} onClick={()=>update("paid")}>تم التحويل</Button><Button size="sm" variant="destructive" disabled={loading || status === "paid"} onClick={()=>update("rejected")}>رفض</Button></div>;
}
