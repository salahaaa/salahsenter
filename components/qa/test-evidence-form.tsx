"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TestCase = { key: string; category: string; title: string; description: string; severity: string };
const statuses = [
  { value: "planned", label: "مخطط" },
  { value: "running", label: "جارٍ التنفيذ" },
  { value: "passed", label: "نجح" },
  { value: "failed", label: "فشل" },
  { value: "blocked", label: "محجوب" }
] as const;

export function TestEvidenceForm({ cases, onRecorded }: { cases: readonly TestCase[]; onRecorded?: () => void }) {
  const [caseKey, setCaseKey] = useState(cases[0]?.key || "");
  const [status, setStatus] = useState<(typeof statuses)[number]["value"]>("planned");
  const [note, setNote] = useState("");
  const [failureSummary, setFailureSummary] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const selected = useMemo(() => cases.find((item) => item.key === caseKey), [caseKey, cases]);
  const needsFailure = status === "failed" || status === "blocked";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/qa/test-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseKey, status, note: note || null, failureSummary: failureSummary || null, evidenceUrl: evidenceUrl || null })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.message || "تعذر تسجيل نتيجة الاختبار");
        return;
      }
      setMessage(json.data?.message || "تم تسجيل نتيجة الاختبار");
      setNote("");
      setFailureSummary("");
      setEvidenceUrl("");
      onRecorded?.();
    } finally {
      setLoading(false);
    }
  }

  if (!cases.length) return null;
  return (
    <form onSubmit={submit} className="space-y-4 rounded-[1.7rem] border bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black text-slate-950">تسجيل نتيجة اختبار</h2><p className="mt-1 text-sm text-slate-500">لا تضع كلمات مرور أو روابط قواعد بيانات داخل الدليل.</p></div>{selected ? <Badge variant={selected.severity === "critical" ? "danger" : selected.severity === "warning" ? "warning" : "outline"}>{selected.severity}</Badge> : null}</div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2"><Label>حالة الاختبار</Label><select value={caseKey} onChange={(event) => setCaseKey(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold">{cases.map((item) => <option key={item.key} value={item.key}>{item.key} — {item.title}</option>)}</select></label>
        <label className="space-y-2"><Label>النتيجة</Label><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold">{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      </div>
      {selected ? <p className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{selected.description}</p> : null}
      <label className="block space-y-2"><Label>ملاحظات التنفيذ</Label><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} className="min-h-24 w-full rounded-xl border bg-background p-3 text-sm" placeholder="ما الذي جُرّب وما النتيجة؟" /></label>
      {needsFailure ? <label className="block space-y-2"><Label>سبب الفشل أو الحجب</Label><textarea required value={failureSummary} onChange={(event) => setFailureSummary(event.target.value)} maxLength={2000} className="min-h-20 w-full rounded-xl border border-red-200 bg-red-50/30 p-3 text-sm" placeholder="رسالة الخطأ أو العائق، من دون أسرار" /></label> : null}
      <label className="block space-y-2"><Label>رابط الدليل HTTPS (اختياري)</Label><Input type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="https://github.com/... أو رابط لقطة/Artifact" /></label>
      <Button disabled={loading || !caseKey} className="w-full">{loading ? "جارٍ الحفظ..." : "حفظ النتيجة"}</Button>
      {message ? <p role="status" className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{message}</p> : null}
    </form>
  );
}
