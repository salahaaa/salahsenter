"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Row = { signal: { id: string; status: string; signalType: string; score: number; evidence: Record<string, unknown>; reviewedAt?: string | null; createdAt: string }; campaignName: string; storeName: string };

export function AdFraudReviewPanel({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function review(signalId: string, action: "confirm_clean" | "invalidate") {
    const note = window.prompt(action === "invalidate" ? "سبب إبطال الحدث/إصدار credit:" : "سبب اعتماد جودة الحدث:") || "";
    if (note.trim().length < 3) return;
    setLoading(signalId); setMessage(null);
    const response = await fetch("/api/admin/ads/fraud", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signalId, action, note }) });
    const json = await response.json().catch(() => ({}));
    setLoading(null); setMessage(response.ok ? json.data?.message || "تمت المراجعة" : json.message || "تعذرت المراجعة");
    if (response.ok) router.refresh();
  }
  return <div className="space-y-3">{message ? <p className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-600">{message}</p> : null}{rows.length ? rows.map(({ signal, campaignName, storeName }) => <article key={signal.id} className="rounded-2xl border bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{campaignName} — {storeName}</p><p className="mt-1 text-xs font-bold text-slate-500">{signal.signalType} · score {signal.score} · {signal.status}</p><pre className="mt-2 max-w-xl overflow-auto rounded-xl bg-slate-50 p-2 text-[11px] text-slate-600">{JSON.stringify(signal.evidence, null, 2)}</pre></div>{!signal.reviewedAt ? <div className="flex gap-2"><Button size="sm" disabled={loading===signal.id} onClick={() => review(signal.id,"confirm_clean")}>اعتماد نظيف</Button><Button size="sm" variant="destructive" disabled={loading===signal.id} onClick={() => review(signal.id,"invalidate")}>إبطال / Credit</Button></div> : null}</div></article>) : <p className="rounded-2xl border border-dashed p-5 text-sm font-bold text-slate-500">لا توجد إشارات جودة بعد.</p>}</div>;
}
