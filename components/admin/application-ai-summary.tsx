"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Summary = { readiness: number; summary: string; missing: string[]; risks: string[]; recommendedAction: string; checklist: Array<{ label: string; ok: boolean }> };

export function ApplicationAiSummary({ applicationId }: { applicationId: string }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMessage(null);
    const response = await fetch(`/api/admin/merchant-applications/${applicationId}/ai-summary`, { cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر توليد الملخص");
    setSummary(json.data?.summary);
  }

  return (
    <section className="rounded-3xl border border-violet-200 bg-gradient-to-l from-violet-50 to-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-black text-violet-950">مساعد الأدمن الذكي</h2><p className="mt-1 text-xs font-bold text-violet-800">يلخص الطلب ويحدد النواقص والمخاطر قبل قرار الاعتماد.</p></div>
        <Button type="button" onClick={load} disabled={loading}>{loading ? "جارٍ التحليل..." : "تلخيص الطلب بالذكاء"}</Button>
      </div>
      {message ? <p className="mt-3 text-sm font-bold text-red-600">{message}</p> : null}
      {summary ? <div className="mt-4 space-y-3 text-right text-sm"><div className="flex flex-wrap items-center gap-2"><Badge className="bg-violet-600 text-white">جاهزية {summary.readiness}%</Badge><span className="font-bold text-slate-600">{summary.recommendedAction}</span></div><p className="leading-7 text-slate-700">{summary.summary}</p><div className="grid gap-3 md:grid-cols-2"><Box title="النواقص" items={summary.missing} empty="لا توجد نواقص واضحة" /><Box title="المخاطر" items={summary.risks} empty="لا توجد مخاطر عالية" /></div><div className="flex flex-wrap gap-2">{summary.checklist.map((item) => <Badge key={item.label} variant={item.ok ? "success" : "warning"}>{item.ok ? "✓" : "!"} {item.label}</Badge>)}</div></div> : null}
    </section>
  );
}

function Box({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return <div className="rounded-2xl border bg-white p-3"><h3 className="font-black text-slate-950">{title}</h3>{items.length ? <ul className="mt-2 list-disc space-y-1 pr-5 text-xs font-bold leading-6 text-slate-600">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-2 text-xs font-bold text-slate-400">{empty}</p>}</div>;
}
