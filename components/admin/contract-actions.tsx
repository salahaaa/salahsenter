"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ContractActions({ contractId, status }: { contractId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function action(kind: "renew" | "grace" | "terminate" | "reactivate") {
    const defaults = { renew: "365", grace: "15", terminate: "", reactivate: "30" };
    const labels = { renew: "مدة التجديد بالأيام", grace: "مدة السماح بالأيام", terminate: "سبب الإنهاء", reactivate: "مدة التفعيل بالأيام إذا كان العقد منتهياً" };
    const input = window.prompt(labels[kind], defaults[kind]);
    if (input === null) return;
    const reason = kind === "terminate" ? input : window.prompt("السبب / الملاحظة", kind === "renew" ? "تجديد عقد" : kind === "grace" ? "تمديد سماح" : "إعادة فتح المتجر") || undefined;
    if (kind === "terminate" && !reason) return alert("يجب كتابة سبب الإنهاء");
    setLoading(true);
    const body = kind === "terminate" ? { reason } : { days: Number(input || defaults[kind]), reason };
    const response = await fetch(`/api/admin/contracts/${contractId}/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return alert(json.message || "تعذر تنفيذ العملية");
    alert(`✓ ${json.data?.message || json.message || "تمت العملية"}`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={loading || status === "frozen" || status === "terminated"} onClick={() => action("renew")}>تجديد</Button>
      <Button size="sm" variant="outline" disabled={loading || status === "frozen" || status === "terminated"} onClick={() => action("grace")}>فترة سماح</Button>
      <Button size="sm" variant="destructive" disabled={loading || status === "frozen" || status === "terminated"} onClick={() => action("terminate")}>إنهاء/تجميد</Button>
      {(status === "frozen" || status === "terminated" || status === "expired") ? <Button size="sm" disabled={loading} onClick={() => action("reactivate")}>إعادة فتح</Button> : null}
    </div>
  );
}

export function ScanContractsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function scan() {
    setLoading(true);
    const response = await fetch("/api/admin/contracts/check-expiry", { method: "POST" });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return alert(json.message || "تعذر الفحص");
    alert("✓ تم فحص العقود");
    router.refresh();
  }
  return <Button onClick={scan} disabled={loading}>{loading ? "جارٍ الفحص..." : "فحص قرب الانتهاء"}</Button>;
}
