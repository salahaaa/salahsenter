"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Cloud,
  Database,
  Gauge,
  HeartPulse,
  Lock,
  MailWarning,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  TerminalSquare,
  Wrench,
  XCircle,
  Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminProtectionSnapshot, ProtectionSeverity, SelfHealingAction, ServiceCheck } from "@/lib/admin/platform-protection-center";

type Props = {
  initialSnapshot: AdminProtectionSnapshot;
};

type ConnectionState = "connecting" | "live" | "fallback" | "offline";

const severityVariant: Record<ProtectionSeverity, "success" | "warning" | "danger" | "outline"> = {
  success: "success",
  info: "outline",
  warning: "warning",
  critical: "danger"
};

const statusIcon: Record<ServiceCheck["status"], React.ReactNode> = {
  operational: <CheckCircle2 className="h-4 w-4" />,
  degraded: <AlertTriangle className="h-4 w-4" />,
  down: <XCircle className="h-4 w-4" />,
  unknown: <Activity className="h-4 w-4" />
};

const serviceIcons: Record<string, React.ReactNode> = {
  database: <Database className="h-5 w-5" />,
  redis: <Zap className="h-5 w-5" />,
  cloudinary: <Cloud className="h-5 w-5" />,
  authentication: <Lock className="h-5 w-5" />,
  apis: <TerminalSquare className="h-5 w-5" />,
  uploads: <Cloud className="h-5 w-5" />,
  notifications: <MailWarning className="h-5 w-5" />,
  queue_jobs: <Activity className="h-5 w-5" />,
  monitoring_stack: <Radio className="h-5 w-5" />,
  backup_recovery: <ShieldCheck className="h-5 w-5" />
};

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

function connectionLabel(state: ConnectionState) {
  if (state === "live") return "Live متصل";
  if (state === "connecting") return "جارٍ الاتصال";
  if (state === "fallback") return "تحديث دوري";
  return "غير متصل";
}

export function PlatformProtectionCenter({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [message, setMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    async function pullFallback() {
      try {
        const response = await fetch("/api/admin/security/center", { cache: "no-store" });
        const json = await response.json();
        if (response.ok && json.data?.snapshot) {
          setSnapshot(json.data.snapshot);
          setConnection("fallback");
        }
      } catch {
        setConnection("offline");
      }
    }

    try {
      const source = new EventSource("/api/admin/security/center/stream", { withCredentials: true });
      source.addEventListener("ready", () => setConnection("live"));
      source.addEventListener("snapshot", (event) => {
        if (stopped) return;
        setSnapshot(JSON.parse((event as MessageEvent).data));
        setConnection("live");
      });
      source.addEventListener("error", () => {
        if (stopped) return;
        setConnection("fallback");
        source.close();
        pullFallback();
        fallbackTimer = setInterval(pullFallback, initialSnapshot.realtime.intervalMs || 10000);
      });
      return () => {
        stopped = true;
        source.close();
        if (fallbackTimer) clearInterval(fallbackTimer);
      };
    } catch {
      setConnection("fallback");
      pullFallback();
      fallbackTimer = setInterval(pullFallback, initialSnapshot.realtime.intervalMs || 10000);
      return () => {
        stopped = true;
        if (fallbackTimer) clearInterval(fallbackTimer);
      };
    }
  }, [initialSnapshot.realtime.intervalMs]);

  const groupedServices = useMemo(() => {
    return snapshot.services.reduce<Record<string, ServiceCheck[]>>((acc, service) => {
      acc[service.group] = acc[service.group] || [];
      acc[service.group].push(service);
      return acc;
    }, {});
  }, [snapshot.services]);

  async function refreshAndPersist() {
    setActionLoading("refresh");
    const response = await fetch("/api/admin/security/center", { method: "POST" });
    const json = await response.json();
    setActionLoading(null);
    if (response.ok && json.data?.snapshot) {
      setSnapshot(json.data.snapshot);
      setMessage(`✓ ${json.data.message || "تم تحديث الفحص"}`);
    } else {
      setMessage(json.message || "تعذر تحديث الفحص");
    }
  }

  async function runHealing(action: SelfHealingAction, risky = false) {
    if (risky && !window.confirm("هذا إجراء طوارئ وقد يؤثر على المستخدمين. هل تريد المتابعة؟")) return;
    setActionLoading(action);
    const response = await fetch("/api/admin/security/self-heal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const json = await response.json();
    setActionLoading(null);
    setMessage(response.ok ? `✓ ${json.data?.message || "تم التنفيذ"}` : json.message || "تعذر التنفيذ");
    if (response.ok) await refreshAndPersist();
  }

  async function updateIncident(id: string, status: "investigating" | "mitigated" | "resolved") {
    const note = window.prompt("ملاحظة الإجراء", status === "resolved" ? "تم حل الحادث" : "تمت المراجعة") || undefined;
    setActionLoading(`incident:${id}`);
    const response = await fetch(`/api/admin/security/incidents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, note }) });
    const json = await response.json();
    setActionLoading(null);
    setMessage(response.ok ? "✓ تم تحديث الحادث" : json.message || "تعذر تحديث الحادث");
    if (response.ok) await refreshAndPersist();
  }

  const scoreTone = snapshot.score >= 90 ? "from-emerald-500 to-green-400" : snapshot.score >= 75 ? "from-blue-500 to-cyan-400" : snapshot.score >= 55 ? "from-amber-500 to-orange-400" : "from-red-600 to-rose-500";

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border bg-white shadow-card">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_1.9fr]">
          <div className={`bg-gradient-to-br ${scoreTone} p-6 text-white`}>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-black backdrop-blur">
              <HeartPulse className="h-4 w-4" /> الحالة العامة للمنصة
            </div>
            <div className="flex items-end gap-3">
              <span className="text-7xl font-black leading-none">{snapshot.score}</span>
              <span className="pb-2 text-2xl font-black">%</span>
            </div>
            <p className="mt-3 text-xl font-black">{snapshot.statusLabel} — {snapshot.grade}</p>
            <div className="mt-6 h-3 rounded-full bg-white/25">
              <div className="h-3 rounded-full bg-white" style={{ width: `${snapshot.score}%` }} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm font-bold">
              <div className="rounded-2xl bg-white/15 p-3">آخر تحديث<br />{formatTime(snapshot.generatedAt)}</div>
              <div className="rounded-2xl bg-white/15 p-3">Realtime<br />{connectionLabel(connection)}</div>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950">مركز الحماية الذكي للأدمن</h2>
                <p className="mt-1 text-sm leading-7 text-slate-500">مراقبة صحّة المنصة، الأعطال، الأمان، الأداء، التنبيهات، الحوادث والإصلاح الذاتي من مكان واحد.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={connection === "live" ? "success" : connection === "offline" ? "danger" : "warning"}><Radio className="ml-1 h-3 w-3" /> {connectionLabel(connection)}</Badge>
                <Button onClick={refreshAndPersist} disabled={Boolean(actionLoading)}><RefreshCw className="h-4 w-4" /> فحص وحفظ الآن</Button>
              </div>
            </div>
            {message ? <div className="mb-4 rounded-2xl border bg-slate-50 p-3 text-sm font-bold text-slate-700">{message}</div> : null}
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard title="DB Usage" value={`${snapshot.resources.database.usagePercent}%`} tone={snapshot.resources.database.usagePercent >= 70 ? "danger" : snapshot.resources.database.usagePercent >= 50 ? "warn" : "ok"} icon={<Database className="h-5 w-5" />} />
              <MetricCard title="Heap" value={`${snapshot.resources.memory.heapUsagePercent}%`} tone={snapshot.resources.memory.heapUsagePercent >= 85 ? "danger" : snapshot.resources.memory.heapUsagePercent >= 70 ? "warn" : "ok"} icon={<Gauge className="h-5 w-5" />} />
              <MetricCard title="Failed Jobs" value={String(snapshot.performance.failedJobs)} tone={snapshot.performance.failedJobs ? "danger" : "ok"} icon={<Activity className="h-5 w-5" />} />
              <MetricCard title="Failed Logins 1h" value={String(snapshot.security.failedLogins1h)} tone={snapshot.security.failedLogins1h >= 20 ? "danger" : snapshot.security.failedLogins1h >= 5 ? "warn" : "ok"} icon={<ShieldAlert className="h-5 w-5" />} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <InfoPanel title="حالة الموارد" icon={<Gauge className="h-5 w-5 text-blue-600" />}>
          <KeyValue label="Memory RSS" value={`${snapshot.resources.memory.rssMb}MB`} />
          <KeyValue label="Heap Used/Total" value={`${snapshot.resources.memory.heapUsedMb}/${snapshot.resources.memory.heapTotalMb}MB`} />
          <KeyValue label="CPU Load 1m/5m" value={`${snapshot.resources.cpu.load1m}/${snapshot.resources.cpu.load5m}`} />
          <KeyValue label="DB Connections" value={`${snapshot.resources.database.connectionsUsed}/${snapshot.resources.database.maxConnections}`} />
          <KeyValue label="Waiting Locks" value={String(snapshot.resources.database.waitingLocks)} />
          <KeyValue label="Slow Queries" value={String(snapshot.resources.database.activeSlowQueries)} />
        </InfoPanel>
        <InfoPanel title="قنوات التنبيه" icon={<MailWarning className="h-5 w-5 text-amber-600" />}>
          <Channel name="In-App" enabled={snapshot.alertChannels.inApp} />
          <Channel name="Telegram" enabled={snapshot.alertChannels.telegram} />
          <Channel name="Email" enabled={snapshot.alertChannels.email} />
          <Channel name="Sentry" enabled={snapshot.alertChannels.sentry} />
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-500">فعّل متغيرات Telegram/Email/Sentry في Vercel لتصل التنبيهات خارج لوحة الأدمن.</p>
        </InfoPanel>
        <InfoPanel title="حماية النشر" icon={<ShieldCheck className="h-5 w-5 text-emerald-600" />}>
          <div className={`rounded-2xl p-4 ${snapshot.deploymentGate.allowed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            <p className="font-black">{snapshot.deploymentGate.allowed ? "النشر مسموح" : "النشر ممنوع مؤقتاً"}</p>
            <p className="mt-1 text-xs font-bold">Blockers: {snapshot.deploymentGate.blockers.length} — Warnings: {snapshot.deploymentGate.warnings.length}</p>
          </div>
          <ul className="mt-3 max-h-36 space-y-2 overflow-auto text-xs leading-6 text-slate-600">
            {[...snapshot.deploymentGate.blockers, ...snapshot.deploymentGate.warnings].slice(0, 6).map((item) => <li key={item}>• {item}</li>)}
            {!snapshot.deploymentGate.blockers.length && !snapshot.deploymentGate.warnings.length ? <li>لا توجد عوائق حالياً.</li> : null}
          </ul>
        </InfoPanel>
      </section>

      <section className="rounded-[2rem] border bg-white p-6 shadow-card">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">حالة الخدمات</h2>
            <p className="mt-1 text-sm text-slate-500">Database, Redis, Cloudinary, Auth, APIs, Uploads, Notifications, Queue, Monitoring, Backup.</p>
          </div>
          <Badge variant="outline">{snapshot.services.length} services</Badge>
        </div>
        <div className="space-y-5">
          {Object.entries(groupedServices).map(([group, services]) => (
            <div key={group}>
              <h3 className="mb-3 text-sm font-black uppercase text-slate-400">{group}</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {services.map((service) => <ServiceCard key={service.key} service={service} />)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-950"><Siren className="h-5 w-5 text-red-600" /> Incident Management</h2>
            <Badge variant={snapshot.incidents.some((i) => i.status === "open" && i.severity === "critical") ? "danger" : "outline"}>{snapshot.incidents.length} incidents</Badge>
          </div>
          {!snapshot.incidents.length ? (
            <EmptyOk text="لا توجد حوادث مسجلة حتى الآن." />
          ) : (
            <div className="space-y-3">
              {snapshot.incidents.slice(0, 8).map((incident) => (
                <article key={incident.id} className="rounded-2xl border bg-slate-50 p-4">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Badge variant={incident.severity === "critical" ? "danger" : incident.severity === "warning" ? "warning" : "outline"}>{incident.severity}</Badge>
                    <Badge variant="outline">{incident.status}</Badge>
                    <Badge variant="outline">{incident.affectedService}</Badge>
                  </div>
                  <h3 className="font-black text-slate-950">{incident.title}</h3>
                  {incident.description ? <p className="mt-1 text-sm leading-6 text-slate-600">{incident.description}</p> : null}
                  {incident.recommendation ? <p className="mt-2 rounded-xl bg-white p-3 text-xs font-bold leading-6 text-slate-600">الحل المقترح: {incident.recommendation}</p> : null}
                  <p className="mt-2 text-xs text-slate-400">Incident ID: {incident.incidentKey} — {formatTime(incident.lastSeenAt)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateIncident(incident.id, "investigating")} disabled={Boolean(actionLoading)}>تحقيق</Button>
                    <Button size="sm" variant="secondary" onClick={() => updateIncident(incident.id, "mitigated")} disabled={Boolean(actionLoading)}>تم الاحتواء</Button>
                    <Button size="sm" onClick={() => updateIncident(incident.id, "resolved")} disabled={Boolean(actionLoading)}>إغلاق</Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border bg-white p-6 shadow-card">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-slate-950"><Wrench className="h-5 w-5 text-blue-600" /> Self-Healing</h2>
          <div className="space-y-3">
            {snapshot.selfHealing.enabledActions.map((item) => (
              <button key={item.action} onClick={() => runHealing(item.action, item.risk === "emergency")} disabled={Boolean(actionLoading)} className="w-full rounded-2xl border bg-slate-50 p-4 text-right transition hover:border-blue-200 hover:bg-blue-50 disabled:opacity-60">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-black text-slate-950">{actionLoading === item.action ? "جارٍ التنفيذ..." : item.label}</span>
                  <Badge variant={item.risk === "emergency" ? "danger" : item.risk === "controlled" ? "warning" : "success"}>{item.risk}</Badge>
                </div>
                <p className="mt-1 text-xs leading-6 text-slate-500">{item.description}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <AiPanel title="AI Root Cause" icon={<BrainCircuit className="h-5 w-5 text-purple-600" />} items={snapshot.rootCauses.map((item) => ({ id: `${item.category}-${item.affectedService}`, severity: item.severity === "critical" ? "critical" : "warning", title: item.category, message: item.likelyCause, footer: `${item.affectedService} — confidence ${Math.round(item.confidence * 100)}%${item.expectedFile ? ` — ${item.expectedFile}` : ""}`, recommendation: item.recommendation }))} />
        <AiPanel title="AI Threat Analysis" icon={<ShieldAlert className="h-5 w-5 text-red-600" />} items={snapshot.threatAnalysis.map((item) => ({ id: item.id, severity: item.severity, title: item.title, message: item.message, footer: item.evidence ? JSON.stringify(item.evidence).slice(0, 120) : undefined, recommendation: item.recommendation }))} />
        <AiPanel title="Predictive Failure" icon={<Zap className="h-5 w-5 text-amber-600" />} items={snapshot.predictions.map((item) => ({ id: item.id, severity: item.severity, title: item.title, message: item.message, footer: `probability ${item.probability}%`, recommendation: item.recommendation }))} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border bg-white p-6 shadow-card">
          <h2 className="mb-4 text-xl font-black text-slate-950">Security Alerts</h2>
          {!snapshot.alerts.length ? <EmptyOk text="لا توجد تنبيهات أمنية حديثة." /> : <div className="space-y-2">{snapshot.alerts.map((alert) => <div key={alert.id} className="rounded-2xl border bg-slate-50 p-3"><div className="mb-1 flex flex-wrap gap-2"><Badge variant={alert.severity === "critical" ? "danger" : alert.severity === "high" ? "warning" : "outline"}>{alert.severity}</Badge><Badge variant="outline">{alert.status}</Badge></div><p className="font-black text-slate-800">{alert.title}</p><p className="text-xs text-slate-500">{alert.type} — {formatTime(alert.createdAt)}</p></div>)}</div>}
        </div>
        <div className="rounded-[2rem] border bg-white p-6 shadow-card">
          <h2 className="mb-4 text-xl font-black text-slate-950">Structured Logs</h2>
          {!snapshot.logs.length ? <EmptyOk text="لا توجد structured logs حديثة أو لم تُطبّق migration بعد." /> : <div className="max-h-96 overflow-auto rounded-2xl border"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 text-right">Level</th><th className="p-3 text-right">Service</th><th className="p-3 text-right">Message</th><th className="p-3 text-right">Time</th></tr></thead><tbody>{snapshot.logs.map((log) => <tr key={log.id} className="border-t"><td className="p-3"><Badge variant={log.level === "critical" || log.level === "error" ? "danger" : log.level === "warn" ? "warning" : "outline"}>{log.level}</Badge></td><td className="p-3 font-bold text-slate-700">{log.service}</td><td className="p-3 text-slate-600">{log.message}</td><td className="p-3 text-xs text-slate-400">{formatTime(log.createdAt)}</td></tr>)}</tbody></table></div>}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ title, value, tone, icon }: { title: string; value: string; tone: "ok" | "warn" | "danger"; icon: React.ReactNode }) {
  const cls = tone === "ok" ? "bg-emerald-50 text-emerald-700" : tone === "warn" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return <div className="rounded-2xl border bg-white p-4"><div className={`mb-2 inline-flex rounded-xl p-2 ${cls}`}>{icon}</div><p className="text-xs font-bold text-slate-500">{title}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div>;
}

function InfoPanel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-[2rem] border bg-white p-6 shadow-card"><h2 className="mb-4 flex items-center gap-2 text-xl font-black text-slate-950">{icon}{title}</h2>{children}</section>;
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b py-2 text-sm"><span className="font-bold text-slate-500">{label}</span><span className="font-black text-slate-900">{value}</span></div>;
}

function Channel({ name, enabled }: { name: string; enabled: boolean }) {
  return <div className="flex items-center justify-between border-b py-2 text-sm"><span className="font-bold text-slate-600">{name}</span><Badge variant={enabled ? "success" : "warning"}>{enabled ? "Enabled" : "Missing"}</Badge></div>;
}

function ServiceCard({ service }: { service: ServiceCheck }) {
  return (
    <article className="rounded-2xl border bg-slate-50 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-xl p-2 ${service.severity === "critical" ? "bg-red-100 text-red-700" : service.severity === "warning" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{serviceIcons[service.key] || <Activity className="h-5 w-5" />}</span>
          <div>
            <h3 className="font-black text-slate-950">{service.label}</h3>
            <p className="text-xs text-slate-400">{service.latencyMs ?? 0}ms</p>
          </div>
        </div>
        <Badge variant={severityVariant[service.severity]}>{statusIcon[service.status]} <span className="mr-1">{service.status}</span></Badge>
      </div>
      <p className="text-sm leading-6 text-slate-600">{service.message}</p>
      {service.evidence ? <details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-slate-400">Evidence</summary><pre className="mt-2 max-h-32 overflow-auto rounded-xl bg-white p-3 text-left text-[11px] text-slate-500">{JSON.stringify(service.evidence, null, 2)}</pre></details> : null}
    </article>
  );
}

function EmptyOk({ text }: { text: string }) {
  return <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-700"><CheckCircle2 className="ml-1 inline h-4 w-4" /> {text}</div>;
}

function AiPanel({ title, icon, items }: { title: string; icon: React.ReactNode; items: Array<{ id: string; severity: ProtectionSeverity; title: string; message: string; footer?: string; recommendation: string }> }) {
  return (
    <section className="rounded-[2rem] border bg-white p-6 shadow-card">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-slate-950">{icon}{title}</h2>
      <div className="space-y-3">
        {items.slice(0, 5).map((item) => (
          <article key={item.id} className="rounded-2xl border bg-slate-50 p-4">
            <div className="mb-2 flex flex-wrap gap-2"><Badge variant={severityVariant[item.severity]}>{item.severity}</Badge><Badge variant="outline">{item.title}</Badge></div>
            <p className="text-sm leading-7 text-slate-700">{item.message}</p>
            <p className="mt-2 rounded-xl bg-white p-3 text-xs font-bold leading-6 text-slate-600">{item.recommendation}</p>
            {item.footer ? <p className="mt-2 text-xs text-slate-400">{item.footer}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
