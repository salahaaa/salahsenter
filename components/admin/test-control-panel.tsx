"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TestEvidenceForm } from "@/components/qa/test-evidence-form";

type TestCase = { key: string; category: string; title: string; description: string; severity: string };
type TestRun = { id: string; caseKey: string; category: string; status: string; severity: string; evidenceUrl: string | null; note: string | null; failureSummary: string | null; createdAt: string };

function statusVariant(status: string) {
  if (status === "passed") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "blocked") return "warning" as const;
  return "outline" as const;
}

export function TestControlPanel({ cases, runs }: { cases: readonly TestCase[]; runs: TestRun[] }) {
  const router = useRouter();
  const latestByCase = useMemo(() => new Map(cases.map((item) => [item.key, runs.find((run) => run.caseKey === item.key)])), [cases, runs]);
  const counts = useMemo(() => ({
    passed: runs.filter((run) => run.status === "passed").length,
    failed: runs.filter((run) => run.status === "failed").length,
    blocked: runs.filter((run) => run.status === "blocked").length,
    pending: cases.filter((item) => !latestByCase.get(item.key) || ["planned", "running"].includes(latestByCase.get(item.key)?.status || "")).length
  }), [cases, latestByCase, runs]);
  const failures = runs.filter((run) => ["failed", "blocked"].includes(run.status));

  return (
    <div className="space-y-7">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="نجح" value={counts.passed} tone="success" />
        <Kpi label="فشل" value={counts.failed} tone="danger" />
        <Kpi label="محجوب" value={counts.blocked} tone="warning" />
        <Kpi label="لم يكتمل" value={counts.pending} tone="outline" />
      </section>

      <TestEvidenceForm cases={cases} onRecorded={() => router.refresh()} />

      <section className="rounded-[1.7rem] border bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">حالات الاختبار المعتمدة</h2><p className="mt-1 text-sm text-slate-500">آخر نتيجة لكل حالة؛ سجل QA هو الدليل التشغيلي.</p></div><Button asChild variant="outline"><Link href="/test-evidence">صفحة فريق QA</Link></Button></div>
        <div className="grid gap-3 md:grid-cols-2">{cases.map((item) => {
          const latest = latestByCase.get(item.key);
          return <article key={item.key} className="rounded-2xl border bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-blue-700">{item.key} · {item.category}</p><h3 className="mt-1 font-black text-slate-950">{item.title}</h3></div><Badge variant={statusVariant(latest?.status || "planned")}>{latest?.status || "planned"}</Badge></div><p className="mt-2 text-xs leading-6 text-slate-600">{item.description}</p>{latest?.failureSummary ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-800">{latest.failureSummary}</p> : null}{latest?.evidenceUrl ? <a className="mt-3 inline-flex text-xs font-black text-blue-700 underline" href={latest.evidenceUrl} target="_blank" rel="noreferrer">فتح الدليل</a> : null}</article>;
        })}</div>
      </section>

      <section className="rounded-[1.7rem] border border-red-100 bg-red-50/40 p-5 shadow-card">
        <h2 className="text-xl font-black text-red-900">الأعطال والحالات المحجوبة</h2>
        {!failures.length ? <p className="mt-3 rounded-xl bg-white/70 p-4 text-sm font-bold text-emerald-700">لا توجد نتيجة فاشلة أو محجوبة مسجلة حالياً.</p> : <div className="mt-4 space-y-3">{failures.map((run) => <article key={run.id} className="rounded-2xl border border-red-100 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><b>{run.caseKey}</b><Badge variant={statusVariant(run.status)}>{run.status}</Badge></div><p className="mt-2 text-sm text-slate-700">{run.failureSummary || run.note || "لا يوجد وصف إضافي"}</p><p className="mt-2 text-xs text-slate-500">{new Date(run.createdAt).toLocaleString("ar")}</p></article>)}</div>}
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: "success" | "danger" | "warning" | "outline" }) {
  const cls = tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "danger" ? "border-red-200 bg-red-50 text-red-800" : tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700";
  return <div className={`rounded-2xl border p-4 ${cls}`}><p className="text-sm font-bold">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>;
}
