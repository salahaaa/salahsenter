"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileCheck2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/utils";

type Run = { id: string; periodStart: string | Date; periodEnd: string | Date; status: string; totals: Record<string, unknown>; discrepancies: Record<string, unknown>; note: string | null; createdAt: string | Date };

function numericRecord(value: Record<string, unknown> | null | undefined) {
  return Object.fromEntries(Object.entries(value || {}).map(([key, item]) => [key, Number(item || 0)])) as Record<string, number>;
}

export function FinancialClosePanel({ runs }: { runs: Run[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function request(method: "POST" | "PATCH", body: Record<string, unknown>, key: string) {
    setLoading(key);
    const response = await fetch("/api/admin/finance/close", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await response.json().catch(() => ({}));
    setLoading(null);
    setMessage(response.ok ? `✓ ${json.data?.message || "تم حفظ الإقفال"}` : json.message || "تعذر تنفيذ العملية");
    if (response.ok) router.refresh();
  }
  return <section className="mt-8 rounded-[2rem] border bg-white p-6 shadow-card"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">الإقفال المالي اليومي</h2><p className="mt-1 text-sm text-slate-500">لقطة قابلة للمراجعة للمبيعات، الـ ledger، السحوبات، المرتجعات والفجوات التشغيلية.</p></div><Button disabled={loading === "create"} onClick={() => void request("POST", {}, "create")}><FileCheck2 className="h-4 w-4" /> إنشاء لقطة أمس</Button></div>{message ? <p className="mt-4 rounded-2xl border bg-slate-50 p-3 text-sm font-bold text-slate-700">{message}</p> : null}<div className="mt-5 space-y-3">{runs.map((run) => { const totals = numericRecord(run.totals); const issues = numericRecord(run.discrepancies); const issueCount = Object.values(issues).reduce((sum, value) => sum + value, 0); return <article key={run.id} className="rounded-2xl border bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex gap-2"><Badge variant={run.status === "closed" ? "success" : run.status === "reviewed" ? "warning" : "outline"}>{run.status}</Badge>{issueCount ? <Badge variant="danger">{issueCount} فجوات</Badge> : <Badge variant="success">لا فجوات مفتوحة</Badge>}</div><p className="mt-2 font-black">{new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(new Date(run.periodStart))} — {new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(new Date(run.periodEnd))}</p><p className="mt-1 text-xs text-slate-500">مبيعات مدفوعة: {formatCurrency(Number(totals.paidOrderSales || 0))} · سحوبات: {formatCurrency(Number(totals.payoutsPaid || 0))} · صافي ledger: {formatCurrency(Number(totals.netPlatformObserved || 0))}</p></div><div className="flex flex-wrap gap-2">{run.status === "draft" ? <Button size="sm" variant="outline" disabled={loading === `${run.id}:review`} onClick={() => void request("PATCH", { id: run.id, action: "review" }, `${run.id}:review`)}>مراجعة</Button> : null}{run.status === "reviewed" ? <Button size="sm" disabled={loading === `${run.id}:close`} onClick={() => void request("PATCH", { id: run.id, action: "close" }, `${run.id}:close`)}><CheckCircle2 className="h-4 w-4"/> إقفال</Button> : null}{run.status === "closed" ? <Button size="sm" variant="outline" disabled={loading === `${run.id}:reopen`} onClick={() => void request("PATCH", { id: run.id, action: "reopen" }, `${run.id}:reopen`)}><RotateCcw className="h-4 w-4"/> إعادة فتح</Button> : null}</div></div><div className="mt-3 grid gap-2 md:grid-cols-4">{Object.entries(issues).map(([key, value]) => <div key={key} className="rounded-xl bg-white p-2 text-xs font-bold text-slate-600"><span>{key}</span><span className="mr-2 text-slate-950">{formatNumber(Number(value || 0))}</span></div>)}</div></article>; })}{!runs.length ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">لا توجد لقطة إقفال بعد.</p> : null}</div></section>;
}
