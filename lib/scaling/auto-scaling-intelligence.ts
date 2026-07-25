import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, platformScalingEvents, systemSettings } from "@/lib/db";
import { getCentralMonitoringSnapshot, type CentralMonitoringSnapshot } from "@/lib/observability/central-monitoring";

export type ScalingDirection = "scale_out" | "scale_in" | "hold" | "emergency";
export type ScalingSeverity = "success" | "info" | "warning" | "critical";
export type ScalingActionType =
  | "api_instances"
  | "queue_workers"
  | "worker_batch_limit"
  | "redis_resources"
  | "load_balancing"
  | "cost_optimization"
  | "provider_webhook";

export type ScalingSignals = {
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  queueLength: number;
  stuckJobs: number;
  failedJobs: number;
  concurrentRequestsEstimate: number;
  requestsLast5m: number;
  apiRequestsLast5m: number;
  responseTimeP95Ms: number;
  dbConnectionsUsagePercent: number;
  redisStatus: string;
  uploadStatus: string;
  healthScore: number;
  downServices: number;
  slowServices: number;
};

export type ScalingPolicy = {
  minApiInstances: number;
  maxApiInstances: number;
  minQueueWorkers: number;
  maxQueueWorkers: number;
  minWorkerBatchLimit: number;
  maxWorkerBatchLimit: number;
  cpuScaleOutPercent: number;
  cpuEmergencyPercent: number;
  memoryScaleOutPercent: number;
  memoryEmergencyPercent: number;
  queueScaleOutLength: number;
  queueEmergencyLength: number;
  concurrentScaleOut: number;
  concurrentEmergency: number;
  responseScaleOutMs: number;
  responseEmergencyMs: number;
  dbScaleOutPercent: number;
  dbEmergencyPercent: number;
  cooldownSeconds: number;
  scaleInCpuPercent: number;
  scaleInMemoryPercent: number;
  scaleInQueueLength: number;
  scaleInResponseMs: number;
};

export type DesiredScalingState = {
  apiInstances: number;
  queueWorkers: number;
  workerBatchLimit: number;
  redisMode: "normal" | "scale_up" | "emergency";
  loadBalancingMode: "normal" | "balanced" | "shed_non_critical" | "emergency";
  updatedAt: string;
};

export type ScalingAction = {
  type: ScalingActionType;
  label: string;
  from: string | number;
  to: string | number;
  automatic: boolean;
  reason: string;
  provider: "internal" | "vercel" | "worker" | "redis" | "load_balancer" | "external_webhook";
};

export type ScalingDecision = {
  direction: ScalingDirection;
  severity: ScalingSeverity;
  confidence: number;
  summary: string;
  reasons: string[];
  signals: ScalingSignals;
  current: DesiredScalingState;
  desired: DesiredScalingState;
  actions: ScalingAction[];
  prediction: {
    next15mLoad: "low" | "normal" | "high" | "critical";
    probability: number;
    explanation: string;
  };
  emergencyMode: boolean;
  generatedAt: string;
};

export type AutoScalingSnapshot = {
  generatedAt: string;
  autopilot: boolean;
  providerWebhookConfigured: boolean;
  policy: ScalingPolicy;
  decision: ScalingDecision;
  monitoring: Pick<CentralMonitoringSnapshot, "health" | "load" | "requests" | "queues" | "redis" | "uploads">;
  logs: Array<{
    id: string;
    mode: string;
    direction: string;
    severity: string;
    trigger: string;
    status: string;
    desiredState: Record<string, unknown>;
    signals: Record<string, unknown>;
    actions: Record<string, unknown>[];
    providerResponse: Record<string, unknown>;
    createdAt: string;
  }>;
  runtimeHints: {
    workerBatchLimit: number;
    queueWorkers: number;
    loopIntervalMs: number;
    loadBalancingMode: DesiredScalingState["loadBalancingMode"];
  };
};

const SETTING_GROUP = "scaling";
const DESIRED_STATE_KEY = "desired_state";
const POLICY_KEY = "policy";

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function envFlag(name: string, fallback = false) {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on", "enabled"].includes(value.trim().toLowerCase());
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function nowIso() {
  return new Date().toISOString();
}

function safeJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function defaultScalingPolicy(): ScalingPolicy {
  return {
    minApiInstances: envNumber("AUTO_SCALING_MIN_API_INSTANCES", 1),
    maxApiInstances: envNumber("AUTO_SCALING_MAX_API_INSTANCES", 8),
    minQueueWorkers: envNumber("AUTO_SCALING_MIN_QUEUE_WORKERS", 1),
    maxQueueWorkers: envNumber("AUTO_SCALING_MAX_QUEUE_WORKERS", 6),
    minWorkerBatchLimit: envNumber("AUTO_SCALING_MIN_WORKER_BATCH", 10),
    maxWorkerBatchLimit: envNumber("AUTO_SCALING_MAX_WORKER_BATCH", 100),
    cpuScaleOutPercent: envNumber("AUTO_SCALING_CPU_SCALE_OUT", 70),
    cpuEmergencyPercent: envNumber("AUTO_SCALING_CPU_EMERGENCY", 90),
    memoryScaleOutPercent: envNumber("AUTO_SCALING_MEMORY_SCALE_OUT", 78),
    memoryEmergencyPercent: envNumber("AUTO_SCALING_MEMORY_EMERGENCY", 90),
    queueScaleOutLength: envNumber("AUTO_SCALING_QUEUE_SCALE_OUT", 50),
    queueEmergencyLength: envNumber("AUTO_SCALING_QUEUE_EMERGENCY", 300),
    concurrentScaleOut: envNumber("AUTO_SCALING_CONCURRENT_SCALE_OUT", 40),
    concurrentEmergency: envNumber("AUTO_SCALING_CONCURRENT_EMERGENCY", 120),
    responseScaleOutMs: envNumber("AUTO_SCALING_RESPONSE_SCALE_OUT_MS", 1200),
    responseEmergencyMs: envNumber("AUTO_SCALING_RESPONSE_EMERGENCY_MS", 3000),
    dbScaleOutPercent: envNumber("AUTO_SCALING_DB_SCALE_OUT", 65),
    dbEmergencyPercent: envNumber("AUTO_SCALING_DB_EMERGENCY", 85),
    cooldownSeconds: envNumber("AUTO_SCALING_COOLDOWN_SECONDS", 300),
    scaleInCpuPercent: envNumber("AUTO_SCALING_SCALE_IN_CPU", 30),
    scaleInMemoryPercent: envNumber("AUTO_SCALING_SCALE_IN_MEMORY", 55),
    scaleInQueueLength: envNumber("AUTO_SCALING_SCALE_IN_QUEUE", 10),
    scaleInResponseMs: envNumber("AUTO_SCALING_SCALE_IN_RESPONSE_MS", 500)
  };
}

function normalizePolicy(value: Record<string, unknown>, fallback = defaultScalingPolicy()): ScalingPolicy {
  return { ...fallback, ...Object.fromEntries(Object.entries(value).filter(([, v]) => Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)])) } as ScalingPolicy;
}

export function defaultDesiredScalingState(policy = defaultScalingPolicy()): DesiredScalingState {
  return {
    apiInstances: clamp(envNumber("AUTO_SCALING_DEFAULT_API_INSTANCES", policy.minApiInstances), policy.minApiInstances, policy.maxApiInstances),
    queueWorkers: clamp(envNumber("AUTO_SCALING_DEFAULT_QUEUE_WORKERS", policy.minQueueWorkers), policy.minQueueWorkers, policy.maxQueueWorkers),
    workerBatchLimit: clamp(envNumber("JOBS_PROCESS_LIMIT", 25), policy.minWorkerBatchLimit, policy.maxWorkerBatchLimit),
    redisMode: "normal",
    loadBalancingMode: "normal",
    updatedAt: nowIso()
  };
}

function normalizeDesiredState(value: Record<string, unknown>, policy: ScalingPolicy): DesiredScalingState {
  const fallback = defaultDesiredScalingState(policy);
  const redisMode = ["normal", "scale_up", "emergency"].includes(String(value.redisMode)) ? value.redisMode as DesiredScalingState["redisMode"] : fallback.redisMode;
  const loadBalancingMode = ["normal", "balanced", "shed_non_critical", "emergency"].includes(String(value.loadBalancingMode)) ? value.loadBalancingMode as DesiredScalingState["loadBalancingMode"] : fallback.loadBalancingMode;
  return {
    apiInstances: clamp(Number(value.apiInstances || fallback.apiInstances), policy.minApiInstances, policy.maxApiInstances),
    queueWorkers: clamp(Number(value.queueWorkers || fallback.queueWorkers), policy.minQueueWorkers, policy.maxQueueWorkers),
    workerBatchLimit: clamp(Number(value.workerBatchLimit || fallback.workerBatchLimit), policy.minWorkerBatchLimit, policy.maxWorkerBatchLimit),
    redisMode,
    loadBalancingMode,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : fallback.updatedAt
  };
}

async function readSetting(key: string) {
  try {
    const [row] = await db.select({ value: systemSettings.value }).from(systemSettings).where(and(eq(systemSettings.group, SETTING_GROUP), eq(systemSettings.key, key))).limit(1);
    return safeJsonObject(row?.value);
  } catch {
    return {};
  }
}

async function writeSetting(key: string, value: Record<string, unknown>, actorId?: string | null) {
  await db
    .insert(systemSettings)
    .values({ group: SETTING_GROUP, key, value, isPublic: false, updatedBy: actorId || null })
    .onConflictDoUpdate({ target: [systemSettings.group, systemSettings.key], set: { value, updatedBy: actorId || null, updatedAt: new Date() } });
}

export async function getScalingPolicy() {
  return normalizePolicy(await readSetting(POLICY_KEY));
}

export async function getDesiredScalingState(policy = defaultScalingPolicy()) {
  return normalizeDesiredState(await readSetting(DESIRED_STATE_KEY), policy);
}

export function extractScalingSignals(snapshot: CentralMonitoringSnapshot): ScalingSignals {
  const avgResponseSeconds = Math.max(0.05, (snapshot.requests.avgServiceResponseMs || snapshot.requests.apiP95ResponseMs || 50) / 1000);
  const rps = snapshot.requests.requestsLast5m / 300;
  const cpuUsagePercent = snapshot.load.cpu.cores ? Math.min(100, Math.round((snapshot.load.cpu.load1m / snapshot.load.cpu.cores) * 100)) : 0;
  return {
    cpuUsagePercent,
    memoryUsagePercent: snapshot.load.memory.heapUsagePercent,
    queueLength: snapshot.queues.queued,
    stuckJobs: snapshot.queues.stuck,
    failedJobs: snapshot.queues.failed,
    concurrentRequestsEstimate: Math.round(rps * avgResponseSeconds),
    requestsLast5m: snapshot.requests.requestsLast5m,
    apiRequestsLast5m: snapshot.requests.apiRequestsLast5m,
    responseTimeP95Ms: snapshot.requests.apiP95ResponseMs,
    dbConnectionsUsagePercent: snapshot.load.database.usagePercent,
    redisStatus: snapshot.redis.status,
    uploadStatus: snapshot.uploads.status,
    healthScore: snapshot.health.score,
    downServices: snapshot.health.stoppedServices,
    slowServices: snapshot.health.slowServices
  };
}

function predictiveLoad(signals: ScalingSignals, policy: ScalingPolicy): ScalingDecision["prediction"] {
  let pressure = 0;
  pressure += signals.cpuUsagePercent / policy.cpuScaleOutPercent;
  pressure += signals.memoryUsagePercent / policy.memoryScaleOutPercent;
  pressure += signals.queueLength / Math.max(1, policy.queueScaleOutLength);
  pressure += signals.concurrentRequestsEstimate / Math.max(1, policy.concurrentScaleOut);
  pressure += signals.responseTimeP95Ms / Math.max(1, policy.responseScaleOutMs);
  pressure += signals.dbConnectionsUsagePercent / Math.max(1, policy.dbScaleOutPercent);
  pressure += signals.downServices * 1.5 + signals.slowServices * 0.4;
  pressure = pressure / 6;

  if (pressure >= 2.2) return { next15mLoad: "critical", probability: 92, explanation: "عدة مؤشرات وصلت نطاق الخطر؛ يلزم توسع طارئ وتخفيف الحمل غير الأساسي." };
  if (pressure >= 1.2) return { next15mLoad: "high", probability: Math.min(88, Math.round(60 + pressure * 12)), explanation: "الحمل مرشح للارتفاع خلال 15 دقيقة بسبب تراكم queue/latency أو ضغط CPU/DB." };
  if (pressure <= 0.35) return { next15mLoad: "low", probability: 72, explanation: "المؤشرات منخفضة ويمكن تقليل موارد العمال تدريجياً بعد cooldown." };
  return { next15mLoad: "normal", probability: 65, explanation: "الحمل ضمن نطاق طبيعي مع استمرار المراقبة." };
}

export function calculateScalingDecision(input: { signals: ScalingSignals; current: DesiredScalingState; policy?: ScalingPolicy; generatedAt?: string }): ScalingDecision {
  const policy = input.policy || defaultScalingPolicy();
  const signals = input.signals;
  const current = input.current;
  const generatedAt = input.generatedAt || nowIso();
  const reasons: string[] = [];
  const desired: DesiredScalingState = { ...current, updatedAt: generatedAt };
  const actions: ScalingAction[] = [];
  const emergency =
    signals.cpuUsagePercent >= policy.cpuEmergencyPercent ||
    signals.memoryUsagePercent >= policy.memoryEmergencyPercent ||
    signals.queueLength >= policy.queueEmergencyLength ||
    signals.concurrentRequestsEstimate >= policy.concurrentEmergency ||
    signals.responseTimeP95Ms >= policy.responseEmergencyMs ||
    signals.dbConnectionsUsagePercent >= policy.dbEmergencyPercent ||
    signals.downServices > 0;

  const scaleOut = emergency ||
    signals.cpuUsagePercent >= policy.cpuScaleOutPercent ||
    signals.memoryUsagePercent >= policy.memoryScaleOutPercent ||
    signals.queueLength >= policy.queueScaleOutLength ||
    signals.concurrentRequestsEstimate >= policy.concurrentScaleOut ||
    signals.responseTimeP95Ms >= policy.responseScaleOutMs ||
    signals.dbConnectionsUsagePercent >= policy.dbScaleOutPercent ||
    signals.redisStatus !== "operational";

  const scaleIn = !scaleOut &&
    signals.cpuUsagePercent <= policy.scaleInCpuPercent &&
    signals.memoryUsagePercent <= policy.scaleInMemoryPercent &&
    signals.queueLength <= policy.scaleInQueueLength &&
    signals.concurrentRequestsEstimate <= Math.max(2, Math.floor(policy.concurrentScaleOut / 6)) &&
    signals.responseTimeP95Ms <= policy.scaleInResponseMs &&
    signals.failedJobs === 0 &&
    signals.stuckJobs === 0;

  if (emergency) {
    reasons.push("تم تفعيل Emergency Scaling بسبب وصول مؤشر أو أكثر إلى نطاق الخطر.");
    desired.apiInstances = policy.maxApiInstances;
    desired.queueWorkers = policy.maxQueueWorkers;
    desired.workerBatchLimit = policy.maxWorkerBatchLimit;
    desired.redisMode = "emergency";
    desired.loadBalancingMode = "emergency";
  } else if (scaleOut) {
    reasons.push("الحمل مرتفع ويحتاج Scale Out تدريجي.");
    const pressureSteps = 1 + Number(signals.queueLength >= policy.queueScaleOutLength * 2) + Number(signals.responseTimeP95Ms >= policy.responseScaleOutMs * 1.5) + Number(signals.dbConnectionsUsagePercent >= policy.dbScaleOutPercent);
    desired.apiInstances = clamp(current.apiInstances + pressureSteps, policy.minApiInstances, policy.maxApiInstances);
    desired.queueWorkers = clamp(current.queueWorkers + Math.max(1, Math.ceil(signals.queueLength / Math.max(1, policy.queueScaleOutLength * 2))), policy.minQueueWorkers, policy.maxQueueWorkers);
    desired.workerBatchLimit = clamp(current.workerBatchLimit + 10 + Math.floor(signals.queueLength / 20), policy.minWorkerBatchLimit, policy.maxWorkerBatchLimit);
    desired.redisMode = signals.redisStatus === "operational" ? "scale_up" : "emergency";
    desired.loadBalancingMode = signals.responseTimeP95Ms >= policy.responseScaleOutMs ? "balanced" : "normal";
  } else if (scaleIn) {
    reasons.push("الحمل منخفض ويمكن تقليل الموارد تدريجياً لتخفيض التكلفة.");
    desired.apiInstances = clamp(current.apiInstances - 1, policy.minApiInstances, policy.maxApiInstances);
    desired.queueWorkers = clamp(current.queueWorkers - 1, policy.minQueueWorkers, policy.maxQueueWorkers);
    desired.workerBatchLimit = clamp(current.workerBatchLimit - 10, policy.minWorkerBatchLimit, policy.maxWorkerBatchLimit);
    desired.redisMode = "normal";
    desired.loadBalancingMode = "normal";
  } else {
    reasons.push("الحمل مستقر ولا يحتاج تغييراً فورياً.");
  }

  if (signals.cpuUsagePercent >= policy.cpuScaleOutPercent) reasons.push(`CPU مرتفع: ${signals.cpuUsagePercent}%`);
  if (signals.memoryUsagePercent >= policy.memoryScaleOutPercent) reasons.push(`Memory مرتفع: ${signals.memoryUsagePercent}%`);
  if (signals.queueLength >= policy.queueScaleOutLength) reasons.push(`Queue Length مرتفع: ${signals.queueLength}`);
  if (signals.concurrentRequestsEstimate >= policy.concurrentScaleOut) reasons.push(`Concurrent Requests تقديري مرتفع: ${signals.concurrentRequestsEstimate}`);
  if (signals.responseTimeP95Ms >= policy.responseScaleOutMs) reasons.push(`Response Time P95 مرتفع: ${signals.responseTimeP95Ms}ms`);
  if (signals.dbConnectionsUsagePercent >= policy.dbScaleOutPercent) reasons.push(`DB Connections مرتفعة: ${signals.dbConnectionsUsagePercent}%`);
  if (signals.redisStatus !== "operational") reasons.push(`Redis ليس operational: ${signals.redisStatus}`);

  const addAction = (type: ScalingActionType, label: string, from: string | number, to: string | number, reason: string, provider: ScalingAction["provider"], automatic = true) => {
    if (String(from) === String(to)) return;
    actions.push({ type, label, from, to, automatic, reason, provider });
  };

  addAction("api_instances", "تعديل API Instances المطلوبة", current.apiInstances, desired.apiInstances, "توسيع/تقليل capacity لخدمات API حسب الحمل", "vercel");
  addAction("queue_workers", "تعديل Queue Workers", current.queueWorkers, desired.queueWorkers, "زيادة/تقليل عدد العمال لمعالجة الطابور", "worker");
  addAction("worker_batch_limit", "تعديل حجم دفعة معالجة jobs", current.workerBatchLimit, desired.workerBatchLimit, "رفع أو تقليل JOBS_PROCESS_LIMIT التشغيلي", "worker");
  addAction("redis_resources", "تعديل وضع Redis", current.redisMode, desired.redisMode, "اقتراح رفع موارد Redis/مراقبة memory/evictions", "redis", false);
  addAction("load_balancing", "تعديل وضع توزيع الحمل", current.loadBalancingMode, desired.loadBalancingMode, "تغيير استراتيجية التعامل مع الطلبات غير الأساسية", "load_balancer");

  const direction: ScalingDirection = emergency ? "emergency" : scaleOut ? "scale_out" : scaleIn ? "scale_in" : "hold";
  const severity: ScalingSeverity = emergency ? "critical" : scaleOut ? "warning" : scaleIn ? "info" : "success";
  const prediction = predictiveLoad(signals, policy);
  return {
    direction,
    severity,
    confidence: emergency ? 0.94 : scaleOut || scaleIn ? 0.82 : 0.7,
    summary: direction === "emergency" ? "توسع طارئ مطلوب الآن" : direction === "scale_out" ? "توسع تلقائي/مقترح حسب الحمل" : direction === "scale_in" ? "تقليل موارد تدريجي لتخفيض التكلفة" : "لا تغيير مطلوب حالياً",
    reasons,
    signals,
    current,
    desired,
    actions,
    prediction,
    emergencyMode: emergency,
    generatedAt
  };
}

async function recentScalingEvents() {
  try {
    const rows = await db.select().from(platformScalingEvents).orderBy(desc(platformScalingEvents.createdAt)).limit(30);
    return rows.map((row) => ({
      id: row.id,
      mode: row.mode,
      direction: row.direction,
      severity: row.severity,
      trigger: row.trigger,
      status: row.status,
      desiredState: row.desiredState,
      signals: row.signals,
      actions: row.actions,
      providerResponse: row.providerResponse,
      createdAt: row.createdAt.toISOString()
    }));
  } catch {
    return [];
  }
}

async function persistScalingEvent(input: { decision: ScalingDecision; mode: string; status: string; actorId?: string | null; providerResponse?: Record<string, unknown>; correlationId?: string }) {
  try {
    const [row] = await db.insert(platformScalingEvents).values({
      mode: input.mode,
      direction: input.decision.direction,
      severity: input.decision.severity,
      trigger: "auto_scaling_intelligence",
      status: input.status,
      beforeState: input.decision.current as unknown as Record<string, unknown>,
      desiredState: input.decision.desired as unknown as Record<string, unknown>,
      signals: input.decision.signals as unknown as Record<string, unknown>,
      actions: input.decision.actions as unknown as Record<string, unknown>[],
      providerResponse: input.providerResponse || {},
      actorId: input.actorId || null,
      correlationId: input.correlationId || crypto.randomUUID()
    }).returning();
    return row;
  } catch (error) {
    console.error("persist scaling event failed", error);
    return null;
  }
}

async function callScalingWebhook(decision: ScalingDecision) {
  const url = process.env.SCALING_CONTROLLER_WEBHOOK_URL;
  if (!url) return { configured: false, message: "SCALING_CONTROLLER_WEBHOOK_URL غير مضبوط؛ تم حفظ desired state داخلياً فقط." };
  const token = process.env.SCALING_CONTROLLER_WEBHOOK_TOKEN || "";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ decision, app: "salahsentar22", generatedAt: decision.generatedAt }),
      cache: "no-store"
    });
    const body = await response.json().catch(() => ({}));
    return { configured: true, ok: response.ok, status: response.status, body };
  } catch (error) {
    return { configured: true, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function getAutoScalingSnapshot(options: { persistRecommendation?: boolean } = {}): Promise<AutoScalingSnapshot> {
  const [monitoring, policySetting] = await Promise.all([getCentralMonitoringSnapshot(), readSetting(POLICY_KEY)]);
  const policy = normalizePolicy(policySetting);
  const current = await getDesiredScalingState(policy);
  const decision = calculateScalingDecision({ signals: extractScalingSignals(monitoring), current, policy, generatedAt: monitoring.generatedAt });
  if (options.persistRecommendation && decision.direction !== "hold") {
    await persistScalingEvent({ decision, mode: "recommendation", status: "recommended" });
  }
  return {
    generatedAt: nowIso(),
    autopilot: envFlag("AUTO_SCALING_AUTOPILOT", false),
    providerWebhookConfigured: Boolean(process.env.SCALING_CONTROLLER_WEBHOOK_URL),
    policy,
    decision,
    monitoring: { health: monitoring.health, load: monitoring.load, requests: monitoring.requests, queues: monitoring.queues, redis: monitoring.redis, uploads: monitoring.uploads },
    logs: await recentScalingEvents(),
    runtimeHints: {
      workerBatchLimit: decision.desired.workerBatchLimit,
      queueWorkers: decision.desired.queueWorkers,
      loopIntervalMs: decision.emergencyMode ? 1500 : decision.direction === "scale_out" ? 2500 : 5000,
      loadBalancingMode: decision.desired.loadBalancingMode
    }
  };
}

export async function applyAutoScalingDecision(input: { actorId?: string | null; mode?: "manual" | "auto" | "dry_run" } = {}) {
  const snapshot = await getAutoScalingSnapshot();
  const decision = snapshot.decision;
  const mode = input.mode || "manual";
  if (mode === "dry_run" || decision.direction === "hold") {
    await persistScalingEvent({ decision, mode, status: decision.direction === "hold" ? "no_change" : "dry_run", actorId: input.actorId || null });
    return { snapshot, providerResponse: { skipped: true }, message: decision.direction === "hold" ? "لا يوجد تغيير مطلوب حالياً" : "تم تنفيذ محاكاة التوسع بدون تطبيق" };
  }

  await writeSetting(DESIRED_STATE_KEY, decision.desired as unknown as Record<string, unknown>, input.actorId || null);
  const providerResponse = await callScalingWebhook(decision);
  await persistScalingEvent({ decision, mode, status: providerResponse.configured && (providerResponse as any).ok === false ? "applied_internal_webhook_failed" : "applied", actorId: input.actorId || null, providerResponse });
  return { snapshot: await getAutoScalingSnapshot(), providerResponse, message: "تم تحديث desired scaling state وتسجيل القرار" };
}

export async function getAutoScalingRuntimeHints() {
  const policy = await getScalingPolicy();
  const desired = await getDesiredScalingState(policy);
  return {
    workerBatchLimit: desired.workerBatchLimit,
    queueWorkers: desired.queueWorkers,
    loopIntervalMs: desired.loadBalancingMode === "emergency" ? 1500 : desired.loadBalancingMode === "balanced" ? 2500 : 5000,
    loadBalancingMode: desired.loadBalancingMode,
    redisMode: desired.redisMode
  };
}
