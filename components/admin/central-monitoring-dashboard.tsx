"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Cpu, Database, Gauge, HardDrive, Radio, RefreshCw, ServerCrash, ShieldAlert, UploadCloud, XCircle, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CentralMonitoringSnapshot } from "@/lib/observability/central-monitoring";
import type { ProtectionSeverity, ServiceCheck } from "@/lib/admin/platform-protection-center";

type Props = { initialSnapshot: CentralMonitoringSnapshot };
type LiveState = "connecting" | "live" | "fallback" | "offline";

const severityVariant: Record<ProtectionSeverity, "success" | "warning" | "danger" | "outline"> = {
  success: "success",
  info: "outline",
  warning: "warning",
  critical: "danger"
};

function statusVariant(status: ServiceCheck["status"]): "success" | "warning" | "danger" | "outline" {
  if (status === "operational") return "success";
  if (status === "degraded") return "warning";
  if (status === "down") return "danger";
  return "outline";
}

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

function liveLabel(state: LiveState) {
  if (state === "live") return "Live SSE / WebSocket-ready";
  if (state === "fallback") return "Polling Fallback";
  if (state === "connecting") return "Connecting";
  return "Offline";
}

export function CentralMonitoringDashboard({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [liveState, setLiveState] = useState<LiveState>("connecting");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function pull() {
      try {
        const response = await fetch("/api/admin/observability/central", { cache: "no-store" });
        const json = await response.json();
        if (!stopped && response.ok && json.data?.snapshot) {
          setSnapshot(json.data.snapshot);
          setLiveState("fallback");
        }
      } catch {
        if (!stopped) setLiveState("offline");
      }
    }

    try {
      const source = new EventSource("/api/admin/observability/central/stream", { withCredentials: true });
      source.addEventListener("ready", () => setLiveState("live"));
      source.addEventListener("snapshot", (event) => {
        if (stopped) return;
        setSnapshot(JSON.parse((event as MessageEvent).data));
        setLiveState("live");
      });
      source.addEventListener("error", () => {
        source.close();
        if (stopped) return;
        setLiveState("fallback");
        pull();
        timer = setInterval(pull, initialSnapshot.realtime.intervalMs || 10000);
      });
      return () => {
        stopped = true;
        source.close();
        if (timer) clearInterval(timer);
      };
    } catch {
      setLiveState("fallback");
      pull();
      timer = setInterval(pull, initialSnapshot.realtime.intervalMs || 10000);
      return () => {
        stopped = true;
        if (timer) clearInterval(timer);
      };
    }
  }, [initialSnapshot.realtime.intervalMs]);

  const downServices = useMemo(() => snapshot.services.filter((service) => service.status === "down"), [snapshot.services]);
  const slowServices = useMemo(() => snapshot.services.filter((service) => (service.latencyMs || 0) > 1000 || service.status === "degraded"), [snapshot.services]);

  async function refresh() {
    setLoading(true);
    const response = await fetch("/api/admin/observability/central", { method: "POST" });
    const json = await response.json();
    setLoading(false);
    if (response.ok && json.data?.snapshot) {
      setSnapshot(json.data.snapshot);
      setMessage("✓ تم تحديث وحفظ لقطة المراقبة");
    } else {
      setMessage(json.message || "تعذر تحديث المراقبة");
    }
  }

  const scoreColor = snapshot.health.score >= 90 ? "from-emerald-500 to-green-400" : snapshot.health.score >= 75 ? "from-blue-500 to-cyan-400" : snapshot.health.score >= 55 ? "from-amber-500 to-orange-400" : "from-red-600 to-rose-500";

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border bg-white shadow-card">
        <div className="grid lg:grid-cols-[0.9fr_2.1fr]">
          <div className={`bg-gradient-to-br ${scoreColor} p-6 text-white`}>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-black"><Gauge className="h-4 w-4" /> Platform Health</div>
            <div className="flex items-end gap-2"><span className="text-7xl font-black leading-none">{snapshot.health.score}</span><span className="pb-2 text-2xl font-black">%</span></div>
            <p className="mt-3 text-xl font-black">{snapshot.health.label} — {snapshot.health.grade}</p>
            <div className="mt-6 h-3 rounded-full bg-white/25"><div className="h-3 rounded-full bg-white" style={{ width: `${snapshot.health.score}%` }} /></div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-xs font-bold">
              <div className="rounded-2xl bg-white/15 p-3">Live<br />{liveLabel(liveState)}</div>
              <div className="rounded-2xl bg-white/15 p-3">Updated<br />{formatTime(snapshot.generatedAt)}</div>
            </div>
          </div>
          <div className="p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Central Monitoring System</h2>
                <p className="mt-1 text-sm leading-7 text-slate-500">مراقبة لحظية للأداء، Redis، قاعدة البيانات، Queue، الرفع، الأخطاء، الحوادث، وPrometheus/Grafana/Sentry.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={liveState === "live" ? "success" : liveState === "offline" ? "danger" : "warning"}><Radio className="ml-1 h-3 w-3" /> {liveLabel(liveState)}</Badge>
                <Button onClick={refresh} disabled={loading}><RefreshCw className="h-4 w-4" /> تحديث وحفظ</Button>
              </div>
            </div>
            {message ? <div className="mb-4 rounded-2xl border bg-slate-50 p-3 text-sm font-bold text-slate-700">{message}</div> : null}
            <div className="grid gap-3 md:grid-cols-4">
              <Kpi title="Requests 5m" value={String(snapshot.requests.requestsLast5m)} icon={<BarChart3 className="h-5 w-5" />} tone="info" />
              <Kpi title="API P95" value={`${snapshot.requests.apiP95ResponseMs}ms`} icon={<Activity className="h-5 w-5" />} tone={snapshot.requests.apiP95ResponseMs > 1500 ? "danger" : snapshot.requests.apiP95ResponseMs > 700 ? "warn" : "ok"} />
              <Kpi title="Failed 1h" value={String(snapshot.requests.failedRequestsLast1h)} icon={<ServerCrash className="h-5 w-5" />} tone={snapshot.requests.failedRequestsLast1h ? "danger" : "ok"} />
              <Kpi title="Down Services" value={String(snapshot.health.stoppedServices)} icon={<XCircle className="h-5 w-5" />} tone={snapshot.health.stoppedServices ? "danger" : "ok"} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi title="CPU Load 1m" value={String(snapshot.load.cpu.load1m)} icon={<Cpu className="h-5 w-5" />} tone={snapshot.load.cpu.load1m > snapshot.load.cpu.cores ? "warn" : "ok"} />
        <Kpi title="Memory Heap" value={`${snapshot.load.memory.heapUsagePercent}%`} icon={<HardDrive className="h-5 w-5" />} tone={snapshot.load.memory.heapUsagePercent >= 85 ? "danger" : snapshot.load.memory.heapUsagePercent >= 70 ? "warn" : "ok"} />
        <Kpi title="DB Connections" value={`${snapshot.load.database.connectionsUsed}/${snapshot.load.database.maxConnections}`} icon={<Database className="h-5 w-5" />} tone={snapshot.load.database.usagePercent >= 70 ? "danger" : snapshot.load.database.usagePercent >= 50 ? "warn" : "ok"} />
        <Kpi title="Queue Failed/Stuck" value={`${snapshot.queues.failed}/${snapshot.queues.stuck}`} icon={<Activity className="h-5 w-5" />} tone={snapshot.queues.failed || snapshot.queues.stuck ? "danger" : "ok"} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Panel title="حالة الخدمات" icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.services.map((service) => <ServiceCard key={service.key} service={service} />)}
          </div>
        </Panel>
        <Panel title="الحمل الحالي والتكاملات" icon={<Zap className="h-5 w-5 text-amber-600" />}>
          <KeyValue label="API Requests 5m/1h" value={`${snapshot.requests.apiRequestsLast5m}/${snapshot.requests.apiRequestsLast1h}`} />
          <KeyValue label="All Requests 5m/1h" value={`${snapshot.requests.requestsLast5m}/${snapshot.requests.requestsLast1h}`} />
          <KeyValue label="Redis" value={snapshot.redis.status} />
          <KeyValue label="ERP Retry / Failed" value={`${snapshot.erp.retryQueue}/${snapshot.erp.failedSyncs}`} />
          <KeyValue label="ERP Awaiting Invoice" value={String(snapshot.erp.awaitingInvoice)} />
          <KeyValue label="Negative Available Stock" value={String(snapshot.erp.negativeAvailable)} />
          <KeyValue label="Upload Services" value={snapshot.uploads.status} />
          <KeyValue label="Prometheus" value={`${snapshot.integrations.prometheus.endpoint}${snapshot.integrations.prometheus.protected ? " محمي" : ""}`} />
          <KeyValue label="Grafana" value={snapshot.integrations.grafana.configured ? "Configured" : "Missing"} />
          <KeyValue label="Sentry" value={snapshot.integrations.sentry.configured ? "Configured" : "Missing"} />
          {snapshot.integrations.grafana.url ? <a href={snapshot.integrations.grafana.url} className="mt-3 inline-flex text-sm font-black text-blue-600" target="_blank" rel="noreferrer">فتح Grafana</a> : null}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel title="الخدمات المتوقفة والبطيئة" icon={<AlertTriangle className="h-5 w-5 text-red-600" />}>
          <div className="grid gap-3 md:grid-cols-2">
            <MiniList title="Stopped" items={downServices.map((item) => `${item.label}: ${item.message}`)} empty="لا توجد خدمات متوقفة." danger />
            <MiniList title="Slow / Degraded" items={slowServices.map((item) => `${item.label}: ${item.latencyMs || 0}ms — ${item.message}`)} empty="لا توجد خدمات بطيئة حالياً." />
          </div>
        </Panel>
        <Panel title="Incident Logs" icon={<ShieldAlert className="h-5 w-5 text-purple-600" />}>
          {!snapshot.incidents.length ? <Ok text="لا توجد حوادث حديثة." /> : <div className="space-y-3">{snapshot.incidents.slice(0, 8).map((incident) => <article key={incident.id} className="rounded-2xl border bg-slate-50 p-3"><div className="mb-1 flex flex-wrap gap-2"><Badge variant={incident.severity === "critical" ? "danger" : incident.severity === "warning" ? "warning" : "outline"}>{incident.severity}</Badge><Badge variant="outline">{incident.status}</Badge><Badge variant="outline">{incident.affectedService}</Badge></div><p className="font-black text-slate-900">{incident.title}</p><p className="mt-1 text-xs text-slate-500">{incident.incidentKey} — {formatTime(incident.lastSeenAt)}</p></article>)}</div>}
        </Panel>
      </section>

      <Panel title="Error Tracking" icon={<ServerCrash className="h-5 w-5 text-red-600" />}>
        {!snapshot.errors.length ? <Ok text="لا توجد أخطاء مسجلة في Structured Logs حالياً." /> : <div className="overflow-auto rounded-2xl border"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 text-right">Level</th><th className="p-3 text-right">Service</th><th className="p-3 text-right">Path</th><th className="p-3 text-right">Message</th><th className="p-3 text-right">Time</th></tr></thead><tbody>{snapshot.errors.map((error) => <tr key={error.id} className="border-t"><td className="p-3"><Badge variant={error.level === "critical" || error.level === "error" ? "danger" : "warning"}>{error.level}</Badge></td><td className="p-3 font-bold">{error.service}</td><td className="p-3 text-xs text-slate-500">{error.requestPath || "—"}</td><td className="p-3 text-slate-600">{error.message}</td><td className="p-3 text-xs text-slate-400">{formatTime(error.createdAt)}</td></tr>)}</tbody></table></div>}
      </Panel>
    </div>
  );
}

function Kpi({ title, value, icon, tone }: { title: string; value: string; icon: React.ReactNode; tone: "ok" | "warn" | "danger" | "info" }) {
  const cls = tone === "ok" ? "bg-emerald-50 text-emerald-700" : tone === "warn" ? "bg-amber-50 text-amber-700" : tone === "danger" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700";
  return <div className="rounded-3xl border bg-white p-5 shadow-card"><div className={`mb-3 inline-flex rounded-2xl p-3 ${cls}`}>{icon}</div><p className="text-sm font-bold text-slate-500">{title}</p><p className="mt-1 text-3xl font-black text-slate-950">{value}</p></div>;
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-[2rem] border bg-white p-6 shadow-card"><h2 className="mb-4 flex items-center gap-2 text-xl font-black text-slate-950">{icon}{title}</h2>{children}</section>;
}

function ServiceCard({ service }: { service: ServiceCheck }) {
  return <article className="rounded-2xl border bg-slate-50 p-4"><div className="mb-2 flex items-start justify-between gap-2"><div><h3 className="font-black text-slate-950">{service.label}</h3><p className="text-xs text-slate-400">{service.latencyMs || 0}ms</p></div><Badge variant={statusVariant(service.status)}>{service.status}</Badge></div><p className="text-sm leading-6 text-slate-600">{service.message}</p>{service.severity !== "success" ? <Badge className="mt-3" variant={severityVariant[service.severity]}>{service.severity}</Badge> : null}</article>;
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b py-2 text-sm"><span className="font-bold text-slate-500">{label}</span><span className="max-w-[55%] truncate text-left font-black text-slate-900">{value}</span></div>;
}

function MiniList({ title, items, empty, danger }: { title: string; items: string[]; empty: string; danger?: boolean }) {
  return <div className="rounded-2xl border bg-slate-50 p-4"><h3 className={`mb-3 font-black ${danger ? "text-red-700" : "text-amber-700"}`}>{title}</h3>{items.length ? <ul className="space-y-2 text-sm leading-6 text-slate-600">{items.slice(0, 8).map((item) => <li key={item}>• {item}</li>)}</ul> : <Ok text={empty} />}</div>;
}

function Ok({ text }: { text: string }) {
  return <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-700"><CheckCircle2 className="ml-1 inline h-4 w-4" /> {text}</div>;
}
