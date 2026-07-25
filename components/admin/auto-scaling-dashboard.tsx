"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Bot, CheckCircle2, Cpu, Database, Gauge, HardDrive, RefreshCw, Server, ServerCog, Shuffle, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AutoScalingSnapshot, ScalingDecision } from "@/lib/scaling/auto-scaling-intelligence";

type Props = { initialSnapshot: AutoScalingSnapshot };
type LiveState = "connecting" | "live" | "fallback" | "offline";

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

function liveLabel(state: LiveState) {
  if (state === "live") return "Live";
  if (state === "fallback") return "Polling";
  if (state === "connecting") return "Connecting";
  return "Offline";
}

function directionLabel(direction: ScalingDecision["direction"]) {
  if (direction === "scale_out") return "Scale Out";
  if (direction === "scale_in") return "Scale In";
  if (direction === "emergency") return "Emergency Scaling";
  return "Hold";
}

export function AutoScalingDashboard({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [liveState, setLiveState] = useState<LiveState>("connecting");
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function pull() {
      try {
        const response = await fetch("/api/admin/scaling", { cache: "no-store" });
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
      const source = new EventSource("/api/admin/scaling/stream", { withCredentials: true });
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
        timer = setInterval(pull, 10_000);
      });
      return () => {
        stopped = true;
        source.close();
        if (timer) clearInterval(timer);
      };
    } catch {
      setLiveState("fallback");
      pull();
      timer = setInterval(pull, 10_000);
      return () => {
        stopped = true;
        if (timer) clearInterval(timer);
      };
    }
  }, []);

  const decision = snapshot.decision;
  const directionTone = decision.direction === "emergency" ? "from-red-600 to-rose-500" : decision.direction === "scale_out" ? "from-amber-500 to-orange-400" : decision.direction === "scale_in" ? "from-blue-600 to-cyan-500" : "from-emerald-600 to-green-400";
  const totalDesired = useMemo(() => decision.desired.apiInstances + decision.desired.queueWorkers, [decision.desired.apiInstances, decision.desired.queueWorkers]);

  async function refresh(persist = false) {
    setLoading("refresh");
    const response = await fetch("/api/admin/scaling", { method: persist ? "POST" : "GET" });
    const json = await response.json().catch(() => ({}));
    setLoading(null);
    if (response.ok && json.data?.snapshot) {
      setSnapshot(json.data.snapshot);
      setMessage(persist ? "✓ تم حفظ توصية التوسع" : "✓ تم تحديث القراءة");
    } else setMessage(json.message || "تعذر التحديث");
  }

  async function apply(mode: "manual" | "dry_run") {
    if (mode === "manual" && !window.confirm("سيتم تحديث desired scaling state وربما استدعاء webhook خارجي إذا كان مضبوطاً. هل تريد المتابعة؟")) return;
    setLoading(mode);
    const response = await fetch("/api/admin/scaling/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
    const json = await response.json().catch(() => ({}));
    setLoading(null);
    if (response.ok && json.data?.snapshot) {
      setSnapshot(json.data.snapshot);
      setMessage(`✓ ${json.data.message || "تم التنفيذ"}`);
    } else setMessage(json.message || "تعذر تنفيذ القرار");
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border bg-white shadow-card">
        <div className="grid lg:grid-cols-[0.95fr_2.05fr]">
          <div className={`bg-gradient-to-br ${directionTone} p-6 text-white`}>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-black"><Bot className="h-4 w-4" /> Auto Scaling AI</div>
            <p className="text-sm font-bold opacity-90">القرار الحالي</p>
            <h2 className="mt-2 text-4xl font-black">{directionLabel(decision.direction)}</h2>
            <p className="mt-3 text-sm leading-7 opacity-90">{decision.summary}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-xs font-bold">
              <div className="rounded-2xl bg-white/15 p-3">Confidence<br />{Math.round(decision.confidence * 100)}%</div>
              <div className="rounded-2xl bg-white/15 p-3">Live<br />{liveLabel(liveState)}</div>
              <div className="rounded-2xl bg-white/15 p-3">Autopilot<br />{snapshot.autopilot ? "ON" : "OFF"}</div>
              <div className="rounded-2xl bg-white/15 p-3">Desired Units<br />{totalDesired}</div>
            </div>
          </div>
          <div className="p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black text-slate-950">Auto Scaling Intelligence</h1>
                <p className="mt-1 max-w-3xl text-sm leading-7 text-slate-500">يتابع CPU وMemory وQueue وConcurrent Requests وResponse Time ثم يقرر Scale Out/In أو Emergency Scaling مع logs وdesired state.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={snapshot.providerWebhookConfigured ? "success" : "warning"}>{snapshot.providerWebhookConfigured ? "Webhook جاهز" : "Webhook غير مضبوط"}</Badge>
                <Badge variant={snapshot.autopilot ? "success" : "outline"}>{snapshot.autopilot ? "Autopilot" : "Manual"}</Badge>
              </div>
            </div>
            {message ? <p className="mb-4 rounded-2xl border bg-slate-50 p-3 text-sm font-bold text-slate-700">{message}</p> : null}
            <div className="grid gap-3 md:grid-cols-5">
              <Kpi title="CPU" value={`${decision.signals.cpuUsagePercent}%`} icon={<Cpu className="h-5 w-5" />} tone={decision.signals.cpuUsagePercent >= snapshot.policy.cpuEmergencyPercent ? "danger" : decision.signals.cpuUsagePercent >= snapshot.policy.cpuScaleOutPercent ? "warn" : "ok"} />
              <Kpi title="Memory" value={`${decision.signals.memoryUsagePercent}%`} icon={<HardDrive className="h-5 w-5" />} tone={decision.signals.memoryUsagePercent >= snapshot.policy.memoryEmergencyPercent ? "danger" : decision.signals.memoryUsagePercent >= snapshot.policy.memoryScaleOutPercent ? "warn" : "ok"} />
              <Kpi title="Queue" value={String(decision.signals.queueLength)} icon={<Activity className="h-5 w-5" />} tone={decision.signals.queueLength >= snapshot.policy.queueEmergencyLength ? "danger" : decision.signals.queueLength >= snapshot.policy.queueScaleOutLength ? "warn" : "ok"} />
              <Kpi title="Concurrent" value={String(decision.signals.concurrentRequestsEstimate)} icon={<Shuffle className="h-5 w-5" />} tone={decision.signals.concurrentRequestsEstimate >= snapshot.policy.concurrentEmergency ? "danger" : decision.signals.concurrentRequestsEstimate >= snapshot.policy.concurrentScaleOut ? "warn" : "ok"} />
              <Kpi title="P95" value={`${decision.signals.responseTimeP95Ms}ms`} icon={<Gauge className="h-5 w-5" />} tone={decision.signals.responseTimeP95Ms >= snapshot.policy.responseEmergencyMs ? "danger" : decision.signals.responseTimeP95Ms >= snapshot.policy.responseScaleOutMs ? "warn" : "ok"} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => refresh(false)} disabled={Boolean(loading)}><RefreshCw className="h-4 w-4" /> تحديث</Button>
              <Button variant="outline" onClick={() => refresh(true)} disabled={Boolean(loading)}>حفظ توصية</Button>
              <Button variant="secondary" onClick={() => apply("dry_run")} disabled={Boolean(loading)}>محاكاة القرار</Button>
              <Button onClick={() => apply("manual")} disabled={Boolean(loading) || decision.direction === "hold"}>تطبيق القرار</Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="Desired Capacity" icon={<ServerCog className="h-5 w-5 text-blue-600" />}>
          <Capacity label="API Instances" from={decision.current.apiInstances} to={decision.desired.apiInstances} />
          <Capacity label="Queue Workers" from={decision.current.queueWorkers} to={decision.desired.queueWorkers} />
          <Capacity label="Worker Batch" from={decision.current.workerBatchLimit} to={decision.desired.workerBatchLimit} />
          <Capacity label="Redis Mode" from={decision.current.redisMode} to={decision.desired.redisMode} />
          <Capacity label="Load Balancing" from={decision.current.loadBalancingMode} to={decision.desired.loadBalancingMode} />
        </Panel>
        <Panel title="Predictive Scaling" icon={<Zap className="h-5 w-5 text-amber-600" />}>
          <div className="rounded-2xl bg-slate-50 p-4">
            <Badge variant={decision.prediction.next15mLoad === "critical" ? "danger" : decision.prediction.next15mLoad === "high" ? "warning" : "success"}>{decision.prediction.next15mLoad}</Badge>
            <p className="mt-3 text-3xl font-black text-slate-950">{decision.prediction.probability}%</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">{decision.prediction.explanation}</p>
          </div>
          <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-600">{decision.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>
        </Panel>
        <Panel title="Runtime Support" icon={<Server className="h-5 w-5 text-emerald-600" />}>
          <KeyValue label="Background Workers" value={`${snapshot.runtimeHints.queueWorkers} desired`} />
          <KeyValue label="Queue Batch Limit" value={String(snapshot.runtimeHints.workerBatchLimit)} />
          <KeyValue label="Loop Interval" value={`${snapshot.runtimeHints.loopIntervalMs}ms`} />
          <KeyValue label="Redis Scaling" value={decision.desired.redisMode} />
          <KeyValue label="Load Balancing" value={decision.desired.loadBalancingMode} />
          <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs font-bold leading-6 text-amber-700">ملاحظة: Vercel/Upstash لا يسمحان دائماً بتغيير الموارد مباشرة من التطبيق؛ لذلك النظام يطبق desired state داخلياً ويستدعي webhook خارجي عند ضبطه.</p>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Scaling Actions" icon={<ArrowUpRight className="h-5 w-5 text-indigo-600" />}>
          {!decision.actions.length ? <Ok text="لا توجد إجراءات مطلوبة حالياً." /> : <div className="space-y-3">{decision.actions.map((action) => <article key={`${action.type}-${action.to}`} className="rounded-2xl border bg-slate-50 p-4"><div className="mb-2 flex flex-wrap gap-2"><Badge variant="outline">{action.provider}</Badge><Badge variant={action.automatic ? "success" : "warning"}>{action.automatic ? "auto" : "manual"}</Badge></div><h3 className="font-black text-slate-950">{action.label}</h3><p className="mt-1 text-sm text-slate-600">{String(action.from)} → <b>{String(action.to)}</b></p><p className="mt-2 text-xs leading-6 text-slate-500">{action.reason}</p></article>)}</div>}
        </Panel>
        <Panel title="Scaling Logs" icon={<Database className="h-5 w-5 text-slate-700" />}>
          {!snapshot.logs.length ? <Ok text="لا توجد Scaling Logs بعد، اضغط حفظ توصية أو فعّل Cron." /> : <div className="overflow-auto rounded-2xl border"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 text-right">Mode</th><th className="p-3 text-right">Direction</th><th className="p-3 text-right">Status</th><th className="p-3 text-right">Time</th></tr></thead><tbody>{snapshot.logs.map((log) => <tr key={log.id} className="border-t"><td className="p-3"><Badge variant="outline">{log.mode}</Badge></td><td className="p-3"><Badge variant={log.severity === "critical" ? "danger" : log.severity === "warning" ? "warning" : "success"}>{log.direction}</Badge></td><td className="p-3 font-bold text-slate-600">{log.status}</td><td className="p-3 text-xs text-slate-400">{formatTime(log.createdAt)}</td></tr>)}</tbody></table></div>}
        </Panel>
      </section>
    </div>
  );
}

function Kpi({ title, value, icon, tone }: { title: string; value: string; icon: React.ReactNode; tone: "ok" | "warn" | "danger" }) {
  const cls = tone === "ok" ? "bg-emerald-50 text-emerald-700" : tone === "warn" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return <div className="rounded-2xl border bg-white p-4"><div className={`mb-2 inline-flex rounded-xl p-2 ${cls}`}>{icon}</div><p className="text-xs font-bold text-slate-500">{title}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div>;
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-[2rem] border bg-white p-6 shadow-card"><h2 className="mb-4 flex items-center gap-2 text-xl font-black text-slate-950">{icon}{title}</h2>{children}</section>;
}

function Capacity({ label, from, to }: { label: string; from: string | number; to: string | number }) {
  const changed = String(from) !== String(to);
  const up = Number(to) > Number(from);
  return <div className="flex items-center justify-between border-b py-3 text-sm"><span className="font-bold text-slate-500">{label}</span><span className="flex items-center gap-2 font-black text-slate-900">{String(from)} {changed ? up ? <ArrowUpRight className="h-4 w-4 text-emerald-600" /> : <ArrowDownRight className="h-4 w-4 text-blue-600" /> : null} {changed ? String(to) : ""}</span></div>;
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b py-2 text-sm"><span className="font-bold text-slate-500">{label}</span><span className="font-black text-slate-900">{value}</span></div>;
}

function Ok({ text }: { text: string }) {
  return <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-700"><CheckCircle2 className="ml-1 inline h-4 w-4" /> {text}</div>;
}
