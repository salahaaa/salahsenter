"use client";

import { useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Info, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Insight = {
  id: string;
  title: string;
  message: string;
  severity: "critical" | "warning" | "info" | "success";
  impact: string;
  recommendation: string;
  evidence?: Record<string, unknown>;
};

type Payload = {
  score: number;
  generatedAt: string;
  insights: Insight[];
  metrics: Record<string, unknown>;
};

function severityMeta(severity: Insight["severity"]) {
  if (severity === "critical") return { icon: ShieldAlert, badge: "danger" as const, cls: "border-red-200 bg-red-50 text-red-900", label: "حرج" };
  if (severity === "warning") return { icon: AlertTriangle, badge: "warning" as const, cls: "border-amber-200 bg-amber-50 text-amber-900", label: "تنبيه" };
  if (severity === "success") return { icon: CheckCircle2, badge: "success" as const, cls: "border-emerald-200 bg-emerald-50 text-emerald-900", label: "مستقر" };
  return { icon: Info, badge: "outline" as const, cls: "border-blue-200 bg-blue-50 text-blue-900", label: "معلومة" };
}

export function PlatformAiInsightsPanel() {
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/admin/observability/ai-insights", { cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر توليد التنبيهات");
    setPayload(json.data);
  }

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-card">
      <div className="bg-gradient-to-l from-slate-950 via-violet-950 to-indigo-950 p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black"><Bot className="h-4 w-4 text-amber-300" /> AI Platform Monitor</div>
            <h2 className="text-2xl font-black">مساعد مراقبة المنصة</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/70">يقرأ مؤشرات البحث، Redis، DB، checkout، queue، الصور، طلبات المراجعة ويقترح إجراءات تشغيلية للأدمن.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {payload ? <Badge className="bg-white text-slate-950">Score {payload.score}%</Badge> : null}
            <Button type="button" onClick={load} disabled={loading} className="bg-white text-slate-950 hover:bg-white/90"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {loading ? "يفحص..." : "تشغيل الفحص الذكي"}</Button>
          </div>
        </div>
      </div>
      <div className="p-6">
        {message ? <p className="rounded-2xl border bg-red-50 p-4 text-sm font-bold text-red-700">{message}</p> : null}
        {!payload ? <p className="rounded-2xl border bg-slate-50 p-4 text-sm font-bold text-slate-500">اضغط «تشغيل الفحص الذكي» لتوليد تنبيهات أداء ووضع المنصة الآن.</p> : null}
        {payload ? <div className="grid gap-4 md:grid-cols-2">{payload.insights.map((item) => <InsightCard key={item.id} item={item} />)}</div> : null}
      </div>
    </section>
  );
}

function InsightCard({ item }: { item: Insight }) {
  const meta = severityMeta(item.severity);
  const Icon = meta.icon;
  return <article className={`rounded-3xl border p-5 ${meta.cls}`}><div className="mb-3 flex items-start justify-between gap-3"><div className="flex items-center gap-2"><Icon className="h-5 w-5" /><h3 className="font-black">{item.title}</h3></div><Badge variant={meta.badge}>{meta.label}</Badge></div><p className="text-sm font-bold leading-7">{item.message}</p><div className="mt-3 rounded-2xl bg-white/70 p-3 text-xs font-bold leading-6"><b>التأثير:</b> {item.impact}</div><div className="mt-2 rounded-2xl bg-white/70 p-3 text-xs font-bold leading-6"><b>التوصية:</b> {item.recommendation}</div></article>;
}
