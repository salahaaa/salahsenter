"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AdCampaignActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: "pause" | "resume" | "cancel" | "clone") {
    if (action === "cancel" && !window.confirm("سيتم إلغاء الحملة مع الاحتفاظ بسجلها. هل تريد المتابعة؟")) return;
    setLoading(action); setMessage(null);
    const response = await fetch(`/api/merchant/ad-campaigns/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const json = await response.json().catch(() => ({}));
    setLoading(null);
    setMessage(response.ok ? json.data?.message || "تم تحديث الحملة" : json.message || "تعذر تحديث الحملة");
    if (response.ok) router.refresh();
  }

  return <div className="mt-3 space-y-2"><div className="flex flex-wrap gap-2">
    {["approved", "active"].includes(status) ? <Button size="sm" type="button" variant="outline" disabled={Boolean(loading)} onClick={() => run("pause")}>إيقاف مؤقت</Button> : null}
    {status === "paused" ? <Button size="sm" type="button" disabled={Boolean(loading)} onClick={() => run("resume")}>استئناف</Button> : null}
    {["draft", "pending_review", "paused"].includes(status) ? <Button size="sm" type="button" variant="outline" disabled={Boolean(loading)} onClick={() => run("cancel")}>إلغاء</Button> : null}
    <Button size="sm" type="button" variant="secondary" disabled={Boolean(loading)} onClick={() => run("clone")}>نسخ حملة</Button>
  </div>{message ? <p className="text-xs font-bold text-slate-500">{message}</p> : null}</div>;
}
