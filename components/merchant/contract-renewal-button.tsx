"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ContractRenewalButton({ contractId, status }: { contractId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function requestRenewal() {
    const note = window.prompt("اكتب ملاحظة طلب التجديد", "أرغب في تجديد عقد المتجر");
    if (note === null) return;
    const requestedDays = Number(window.prompt("مدة التجديد المطلوبة بالأيام", "365") || 365);
    setLoading(true);
    const response = await fetch(`/api/merchant/contracts/${contractId}/renewal-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, requestedDays })
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return alert(json.message || "تعذر إرسال طلب التجديد");
    alert("✓ تم إرسال طلب التجديد للإدارة");
    router.refresh();
  }

  return <Button variant="outline" size="sm" className="mt-4" disabled={loading || status === "renewal_requested" || status === "terminated" || status === "frozen"} onClick={requestRenewal}>{status === "renewal_requested" ? "تم طلب التجديد" : loading ? "جارٍ الإرسال..." : "طلب تجديد"}</Button>;
}
