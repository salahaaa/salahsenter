export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, Database, Gauge, ListChecks } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CentralMonitoringDashboard } from "@/components/admin/central-monitoring-dashboard";
import { PlatformAiInsightsPanel } from "@/components/admin/platform-ai-insights-panel";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { getProductionReadiness } from "@/lib/production/readiness";
import { getCentralMonitoringSnapshot } from "@/lib/observability/central-monitoring";

export default async function ObservabilityDashboardPage() {
  const session = await requireAuth();
  await assertAdmin(session, "reports.view");
  const [readiness, centralMonitoring] = await Promise.all([getProductionReadiness(), getCentralMonitoringSnapshot()]);
  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">Central Monitoring System</h1>
            <p className="mt-2 text-sm text-slate-500">مراقبة لحظية للـ APIs والموارد وRedis وDatabase وQueue وUpload والأخطاء والحوادث.</p>
          </div>
          <Button asChild variant="outline"><Link href="/admin">العودة</Link></Button>
        </div>
        <CentralMonitoringDashboard initialSnapshot={centralMonitoring} />
        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <Metric icon={<Gauge className="h-5 w-5" />} title="Readiness" value={`${readiness.score}%`} tone={readiness.score >= 85 ? "ok" : readiness.score >= 65 ? "warn" : "danger"} />
          <Metric icon={<Database className="h-5 w-5" />} title="Database schema" value={readiness.databaseReadiness.state} tone={readiness.databaseReadiness.state === "ready" ? "ok" : readiness.databaseReadiness.state === "schema_incomplete" ? "danger" : "warn"} />
          <Metric icon={<Database className="h-5 w-5" />} title="Negative stock" value={String(readiness.metrics.negativeStock)} tone={readiness.metrics.negativeStock ? "danger" : "ok"} />
          <Metric icon={<Activity className="h-5 w-5" />} title="Queued jobs" value={String(readiness.metrics.queuedJobs)} tone="info" />
          <Metric icon={<AlertTriangle className="h-5 w-5" />} title="Failed jobs" value={String(readiness.metrics.failedJobs)} tone={readiness.metrics.failedJobs ? "danger" : "ok"} />
        </section>
        <PlatformAiInsightsPanel />
        <section className={`mt-8 rounded-3xl border p-6 shadow-card ${readiness.databaseReadiness.state === "ready" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <h2 className="font-black text-slate-950">تشخيص قاعدة البيانات</h2>
          <p className="mt-2 text-sm text-slate-600">الحالة: <b>{readiness.databaseReadiness.state}</b></p>
          {readiness.databaseReadiness.missingTables.length ? <p className="mt-2 text-sm text-slate-700">الجداول التشغيلية الناقصة: {readiness.databaseReadiness.missingTables.join("، ")}</p> : <p className="mt-2 text-sm text-slate-600">لا توجد جداول تشغيلية أساسية ناقصة في الفحص الحالي.</p>}
        </section>
        <section className="mt-8 rounded-3xl border bg-white p-6 shadow-card">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><ListChecks className="h-5 w-5 text-blue-600" /> Production Stabilization Checklist</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {readiness.checks.map((check) => <article key={check.label} className="rounded-2xl border bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-950">{check.label}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{check.description}</p></div><Badge variant={check.ok ? "success" : check.severity === "warn" ? "warning" : "danger"}>{check.ok ? "OK" : check.severity}</Badge></div></article>)}
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ icon, title, value, tone }: { icon: React.ReactNode; title: string; value: string; tone: "ok" | "warn" | "danger" | "info" }) {
  const cls = tone === "ok" ? "text-emerald-600 bg-emerald-50" : tone === "warn" ? "text-amber-600 bg-amber-50" : tone === "danger" ? "text-red-600 bg-red-50" : "text-blue-600 bg-blue-50";
  return <div className="rounded-3xl border bg-white p-5 shadow-card"><div className={`mb-3 inline-flex rounded-2xl p-3 ${cls}`}>{icon}</div><p className="text-sm font-bold text-slate-500">{title}</p><p className="mt-1 text-3xl font-black text-slate-950">{value}</p></div>;
}
