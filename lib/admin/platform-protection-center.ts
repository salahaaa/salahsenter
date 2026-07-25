import os from "node:os";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { cacheDeleteByTags } from "@/lib/redis/cache";
import { invalidatePrivateApiCacheTags } from "@/lib/cache/private-api-cache";
import { getCloudinaryConfig } from "@/lib/cloudinary";
import {
  auditLogs,
  backgroundJobs,
  db,
  notifications,
  platformHealthChecks,
  platformIncidentEvents,
  platformIncidents,
  platformStructuredLogs,
  securityAlerts,
  systemSettings,
  userSessions
} from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { getProductionReadiness } from "@/lib/production/readiness";
import { getBackupStorageConfig } from "@/lib/backup";
import { getRedisConfig, redisCommand } from "@/lib/redis/client";
import { defaultSecuritySettings, normalizeSecuritySettings } from "@/lib/security-settings";
import { analyzeRootCause, deploymentMetadata, type RootCauseAnalysis } from "@/lib/ai/security-root-cause";

export type ProtectionSeverity = "success" | "info" | "warning" | "critical";
export type ServiceStatus = "operational" | "degraded" | "down" | "unknown";
export type HealthGrade = "Excellent" | "Good" | "Warning" | "Critical";

export type ServiceCheck = {
  key: string;
  label: string;
  group: "infrastructure" | "security" | "application" | "operations";
  status: ServiceStatus;
  severity: ProtectionSeverity;
  latencyMs?: number | null;
  message: string;
  lastCheckedAt: string;
  evidence?: Record<string, unknown>;
};

export type IncidentSummary = {
  id: string;
  incidentKey: string;
  severity: string;
  status: string;
  title: string;
  description: string | null;
  affectedService: string;
  recommendation: string | null;
  lastSeenAt: string;
  startedAt: string;
};

export type StructuredLogSummary = {
  id: string;
  level: string;
  category: string;
  service: string;
  message: string;
  correlationId: string | null;
  requestPath: string | null;
  ipAddress: string | null;
  createdAt: string;
};

export type AdminProtectionSnapshot = {
  generatedAt: string;
  realtime: { transport: "sse"; intervalMs: number; websocketReady: boolean; message: string };
  score: number;
  grade: HealthGrade;
  statusLabel: string;
  services: ServiceCheck[];
  resources: {
    memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number; heapUsagePercent: number };
    cpu: { load1m: number; load5m: number; cores: number; uptimeSeconds: number };
    database: { connectionsUsed: number; maxConnections: number; usagePercent: number; waitingLocks: number; deadlocks: number; rollbackRatePercent: number; activeSlowQueries: number };
  };
  performance: { avgServiceLatencyMs: number; slowServices: number; failedJobs: number; queuedJobs: number; stuckJobs: number; failedTransactions24h: number };
  security: {
    failedLogins1h: number;
    failedLogins24h: number;
    suspiciousIps: Array<{ ipAddress: string | null; count: number }>;
    adminActions24h: number;
    destructiveActions24h: number;
    openAlerts: number;
    criticalAlerts: number;
    authProtection: "strong" | "basic" | "weak";
  };
  incidents: IncidentSummary[];
  alerts: Array<{ id: string; severity: string; status: string; type: string; title: string; createdAt: string }>;
  logs: StructuredLogSummary[];
  rootCauses: RootCauseAnalysis[];
  threatAnalysis: Array<{ id: string; severity: ProtectionSeverity; title: string; message: string; evidence?: Record<string, unknown>; recommendation: string }>;
  predictions: Array<{ id: string; severity: ProtectionSeverity; title: string; message: string; probability: number; recommendation: string }>;
  recommendations: Array<{ id: string; priority: ProtectionSeverity; title: string; action: string }>;
  alertChannels: { inApp: boolean; telegram: boolean; email: boolean; sentry: boolean };
  deploymentGate: { allowed: boolean; blockers: string[]; warnings: string[]; checkedAt: string };
  selfHealing: { enabledActions: Array<{ action: SelfHealingAction; label: string; risk: "safe" | "controlled" | "emergency"; description: string }> };
};

export type SelfHealingAction = "run_health_checks" | "retry_failed_jobs" | "release_stuck_jobs" | "cleanup_cache" | "enable_emergency_mode";

const LIVE_INTERVAL_MS = 10_000;
const MB = 1024 * 1024;

function nowIso() {
  return new Date().toISOString();
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function ms(started: number) {
  return Math.max(0, Math.round(performance.now() - started));
}

async function safe<T>(fallback: T, loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    console.error("platform protection center safe loader failed", error);
    return fallback;
  }
}

async function timedService(input: Omit<ServiceCheck, "latencyMs" | "lastCheckedAt" | "status" | "severity" | "message"> & { loader: () => Promise<Omit<ServiceCheck, "key" | "label" | "group" | "lastCheckedAt">> }): Promise<ServiceCheck> {
  const started = performance.now();
  try {
    const result = await input.loader();
    return { key: input.key, label: input.label, group: input.group, ...result, latencyMs: result.latencyMs ?? ms(started), lastCheckedAt: nowIso() };
  } catch (error) {
    return {
      key: input.key,
      label: input.label,
      group: input.group,
      status: "down",
      severity: "critical",
      latencyMs: ms(started),
      message: error instanceof Error ? error.message : "تعذر فحص الخدمة",
      lastCheckedAt: nowIso(),
      evidence: { error: error instanceof Error ? error.name : typeof error }
    };
  }
}

export function gradeFromScore(score: number): HealthGrade {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 55) return "Warning";
  return "Critical";
}

export function scorePlatformHealth(services: Array<Pick<ServiceCheck, "severity" | "status">>, extras: { dbUsagePercent?: number; heapUsagePercent?: number; failedJobs?: number; criticalAlerts?: number; failedLogins1h?: number } = {}) {
  let score = 100;
  for (const service of services) {
    if (service.status === "down" || service.severity === "critical") score -= 14;
    else if (service.status === "degraded" || service.severity === "warning") score -= 7;
    else if (service.status === "unknown" || service.severity === "info") score -= 2;
  }
  if ((extras.dbUsagePercent || 0) >= 70) score -= 12;
  else if ((extras.dbUsagePercent || 0) >= 50) score -= 6;
  if ((extras.heapUsagePercent || 0) >= 85) score -= 10;
  else if ((extras.heapUsagePercent || 0) >= 70) score -= 5;
  if ((extras.failedJobs || 0) > 0) score -= Math.min(12, (extras.failedJobs || 0) * 2);
  if ((extras.criticalAlerts || 0) > 0) score -= Math.min(20, (extras.criticalAlerts || 0) * 8);
  if ((extras.failedLogins1h || 0) >= 20) score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function serviceSeverity(status: ServiceStatus, warning = false): ProtectionSeverity {
  if (status === "down") return "critical";
  if (status === "degraded" || warning) return "warning";
  if (status === "unknown") return "info";
  return "success";
}

async function databaseService(): Promise<ServiceCheck> {
  return timedService({
    key: "database",
    label: "PostgreSQL Database",
    group: "infrastructure",
    loader: async () => {
      if (!hasDatabase()) return { status: "down", severity: "critical", message: "DATABASE_URL غير مضبوط" };
      const ping = await db.execute(sql`select now() as now`);
      return { status: "operational", severity: "success", message: "قاعدة البيانات متصلة وتستجيب", evidence: { now: (ping as any)[0]?.now || null } };
    }
  });
}

async function redisService(): Promise<ServiceCheck> {
  return timedService({
    key: "redis",
    label: "Upstash Redis / Cache",
    group: "infrastructure",
    loader: async () => {
      const config = getRedisConfig();
      if (config.backend === "unconfigured") {
        return { status: config.productionStrict ? "down" : "degraded", severity: config.productionStrict ? "critical" : "warning", message: "Redis غير متصل في هذه البيئة", evidence: { required: config.productionStrict } };
      }
      const pong = await redisCommand<string>(["PING"], { context: "security center redis ping", optional: true });
      const dbSize = await redisCommand<number>(["DBSIZE"], { context: "security center redis dbsize", optional: true }).catch(() => null);
      return { status: pong ? "operational" : "degraded", severity: pong ? "success" : "warning", message: pong ? "Redis متصل" : "Redis مضبوط لكن لم يرجع PING", evidence: { backend: config.backend, dbSize } };
    }
  });
}

async function cloudinaryService(): Promise<ServiceCheck> {
  return timedService({
    key: "cloudinary",
    label: "Cloudinary Media Storage",
    group: "infrastructure",
    loader: async () => {
      try {
        const config = getCloudinaryConfig();
        return { status: "operational", severity: "success", message: "Cloudinary مضبوط للرفع والتحسين", evidence: { cloudName: config.cloudName, apiKeyConfigured: Boolean(config.apiKey), secretConfigured: Boolean(config.apiSecret) } };
      } catch (error) {
        return { status: "degraded", severity: "warning", message: error instanceof Error ? error.message : "Cloudinary غير مكتمل" };
      }
    }
  });
}

async function authService(): Promise<ServiceCheck> {
  return timedService({
    key: "authentication",
    label: "Authentication / Sessions / CSRF",
    group: "security",
    loader: async () => {
      const jwtStrong = Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32);
      const activeSessions = await safe(0, async () => {
        const result = await db.select({ count: sql<number>`count(*)::int` }).from(userSessions).where(and(isNull(userSessions.revokedAt), sql`${userSessions.expiresAt} > now()`));
        return Number(result[0]?.count || 0);
      });
      return { status: jwtStrong ? "operational" : "down", severity: jwtStrong ? "success" : "critical", message: jwtStrong ? "JWT/Session guard يعمل و CSRF مفعّل في middleware" : "JWT_SECRET ضعيف أو غير موجود", evidence: { activeSessions, csrf: true } };
    }
  });
}

async function apiService(): Promise<ServiceCheck> {
  return timedService({
    key: "apis",
    label: "Internal APIs",
    group: "application",
    loader: async () => {
      const recentErrors = await safe(0, async () => {
        const result = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(platformStructuredLogs)
          .where(and(inArray(platformStructuredLogs.level, ["error", "critical"]), gte(platformStructuredLogs.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
        return Number(result[0]?.count || 0);
      });
      return { status: recentErrors > 10 ? "degraded" : "operational", severity: recentErrors > 10 ? "warning" : "success", message: recentErrors > 10 ? "هناك أخطاء API كثيرة في آخر ساعة" : "لا توجد أخطاء API حرجة مرصودة", evidence: { recentErrors } };
    }
  });
}

async function uploadService(): Promise<ServiceCheck> {
  return timedService({
    key: "uploads",
    label: "Upload Services",
    group: "application",
    loader: async () => {
      const mediaProvider = process.env.MEDIA_PROVIDER || (process.env.CLOUDINARY_CLOUD_NAME ? "cloudinary" : "local");
      const inlineMedia = await safe(0, async () => {
        const result = await db.execute(sql`
          select coalesce(sum(row_count),0)::int as count from (
            select count(*) filter (where main_image_url like 'data:image/%')::int as row_count from products
            union all select count(*) filter (where image_url like 'data:image/%')::int from banners
            union all select count(*) filter (where image_url like 'data:image/%')::int from announcements
            union all select count(*) filter (where url like 'data:image/%')::int from media_assets
          ) t
        `);
        return Number((result as any)[0]?.count || 0);
      });
      const ok = mediaProvider === "cloudinary" && inlineMedia === 0;
      return { status: ok ? "operational" : "degraded", severity: ok ? "success" : "warning", message: ok ? "الرفع يعمل عبر Cloudinary ولا يوجد base64 مرصود" : "راجع مزود الرفع أو بقايا base64", evidence: { mediaProvider, inlineMedia } };
    }
  });
}

async function notificationsService(): Promise<ServiceCheck> {
  return timedService({
    key: "notifications",
    label: "Notifications / Alerts",
    group: "operations",
    loader: async () => {
      const outbound = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID) || Boolean(process.env.EMAIL_WEBHOOK_URL || process.env.SMTP_HOST || process.env.RESEND_API_KEY);
      const pendingNotificationJobs = await safe(0, async () => {
        const result = await db.select({ count: sql<number>`count(*)::int` }).from(backgroundJobs).where(and(sql`${backgroundJobs.type} like '%notification%'`, inArray(backgroundJobs.status, ["queued", "retry", "processing"])));
        return Number(result[0]?.count || 0);
      });
      return { status: outbound ? "operational" : "degraded", severity: outbound ? "success" : "warning", message: outbound ? "قنوات التنبيه الخارجية/الداخلية جاهزة" : "التنبيهات الداخلية تعمل، لكن Telegram/Email غير مضبوطين", evidence: { pendingNotificationJobs, telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN), email: Boolean(process.env.EMAIL_WEBHOOK_URL || process.env.SMTP_HOST || process.env.RESEND_API_KEY) } };
    }
  });
}

async function queueService(): Promise<ServiceCheck> {
  return timedService({
    key: "queue_jobs",
    label: "Queue Jobs / Cron",
    group: "operations",
    loader: async () => {
      const [failed, queued, stuck] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(backgroundJobs).where(inArray(backgroundJobs.status, ["failed", "dead_letter"])),
        db.select({ count: sql<number>`count(*)::int` }).from(backgroundJobs).where(inArray(backgroundJobs.status, ["queued", "retry", "processing"])),
        db.select({ count: sql<number>`count(*)::int` }).from(backgroundJobs).where(and(eq(backgroundJobs.status, "processing"), sql`${backgroundJobs.lockedUntil} < now()`))
      ]);
      const failedCount = Number(failed[0]?.count || 0);
      const queuedCount = Number(queued[0]?.count || 0);
      const stuckCount = Number(stuck[0]?.count || 0);
      const degraded = failedCount > 0 || stuckCount > 0 || queuedCount > 100;
      return { status: degraded ? "degraded" : "operational", severity: failedCount || stuckCount ? "warning" : "success", message: degraded ? "الطابور يحتاج معالجة" : "Jobs/Cron بحالة جيدة", evidence: { failedCount, queuedCount, stuckCount, cronSecret: Boolean(process.env.CRON_SECRET) } };
    }
  });
}

async function monitoringService(): Promise<ServiceCheck> {
  return timedService({
    key: "monitoring_stack",
    label: "Sentry / Prometheus / Grafana",
    group: "operations",
    loader: async () => {
      const sentry = Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
      const prometheus = Boolean(process.env.PROMETHEUS_PUSHGATEWAY_URL || process.env.METRICS_EXPORT_ENABLED === "true");
      const grafana = Boolean(process.env.GRAFANA_URL || process.env.GRAFANA_CLOUD_API_KEY);
      const external = sentry || prometheus || grafana;
      return { status: external ? "operational" : "degraded", severity: external ? "success" : "warning", message: external ? "يوجد تكامل مراقبة خارجي" : "المراقبة الداخلية تعمل، لكن Sentry/Prometheus/Grafana غير مكتملة", evidence: { sentry, prometheus, grafana } };
    }
  });
}

async function backupService(): Promise<ServiceCheck> {
  return timedService({
    key: "backup_recovery",
    label: "Backup & Recovery",
    group: "operations",
    loader: async () => {
      const storage = getBackupStorageConfig();
      const configured = storage.provider !== "local" && Boolean(storage.bucket && storage.accessKeyId && storage.secretAccessKey);
      const lastBackupLogs = await safe(0, async () => {
        const result = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(auditLogs)
          .where(and(inArray(auditLogs.entityType, ["administrative.backup_created", "system.automatic_backup"]), gte(auditLogs.createdAt, new Date(Date.now() - 36 * 60 * 60 * 1000))));
        return Number(result[0]?.count || 0);
      });
      const healthy = configured && lastBackupLogs > 0;
      return { status: healthy ? "operational" : "degraded", severity: healthy ? "success" : "warning", message: healthy ? "نسخ خارجية حديثة متاحة" : "تحقق من backup bucket أو cron؛ لا توجد نسخة موثقة خلال 36 ساعة", evidence: { provider: storage.provider, bucketConfigured: Boolean(storage.bucket), configured, lastBackupLogs } };
    }
  });
}

async function collectServices() {
  return Promise.all([
    databaseService(),
    redisService(),
    cloudinaryService(),
    authService(),
    apiService(),
    uploadService(),
    notificationsService(),
    queueService(),
    monitoringService(),
    backupService()
  ]);
}

async function resourceMetrics() {
  const memory = process.memoryUsage();
  const heapUsagePercent = memory.heapTotal ? Math.round((memory.heapUsed / memory.heapTotal) * 100) : 0;
  const [load1m, load5m] = os.loadavg();
  const cpu = { load1m: round(load1m, 2), load5m: round(load5m, 2), cores: os.cpus().length || 1, uptimeSeconds: Math.round(process.uptime()) };
  const database = await safe({ connectionsUsed: 0, maxConnections: 0, usagePercent: 0, waitingLocks: 0, deadlocks: 0, rollbackRatePercent: 0, activeSlowQueries: 0 }, async () => {
    const [connections, locks, stats, slow] = await Promise.all([
      db.execute(sql`select count(*)::int as used, (select setting::int from pg_settings where name='max_connections')::int as max from pg_stat_activity`),
      db.execute(sql`select count(*)::int as waiting from pg_locks where not granted`),
      db.execute(sql`select deadlocks::int, xact_commit::bigint, xact_rollback::bigint from pg_stat_database where datname=current_database()`),
      db.execute(sql`select count(*)::int as count from pg_stat_activity where state='active' and now() - query_start > interval '3 seconds'`)
    ]);
    const used = Number((connections as any)[0]?.used || 0);
    const max = Number((connections as any)[0]?.max || 0);
    const commits = Number((stats as any)[0]?.xact_commit || 0);
    const rollbacks = Number((stats as any)[0]?.xact_rollback || 0);
    return {
      connectionsUsed: used,
      maxConnections: max,
      usagePercent: max ? Math.round((used / max) * 100) : 0,
      waitingLocks: Number((locks as any)[0]?.waiting || 0),
      deadlocks: Number((stats as any)[0]?.deadlocks || 0),
      rollbackRatePercent: commits + rollbacks ? round((rollbacks / (commits + rollbacks)) * 100, 2) : 0,
      activeSlowQueries: Number((slow as any)[0]?.count || 0)
    };
  });
  return {
    memory: { rssMb: Math.round(memory.rss / MB), heapUsedMb: Math.round(memory.heapUsed / MB), heapTotalMb: Math.round(memory.heapTotal / MB), heapUsagePercent },
    cpu,
    database
  };
}

async function performanceMetrics() {
  const [failed, queued, stuck, failedTransactions] = await Promise.all([
    safe(0, async () => Number((await db.select({ count: sql<number>`count(*)::int` }).from(backgroundJobs).where(inArray(backgroundJobs.status, ["failed", "dead_letter"])))[0]?.count || 0)),
    safe(0, async () => Number((await db.select({ count: sql<number>`count(*)::int` }).from(backgroundJobs).where(inArray(backgroundJobs.status, ["queued", "retry", "processing"])))[0]?.count || 0)),
    safe(0, async () => Number((await db.select({ count: sql<number>`count(*)::int` }).from(backgroundJobs).where(and(eq(backgroundJobs.status, "processing"), sql`${backgroundJobs.lockedUntil} < now()`)))[0]?.count || 0)),
    safe(0, async () => {
      const result = await db.execute(sql`select xact_rollback::bigint as rollbacks from pg_stat_database where datname=current_database()`);
      return Number((result as any)[0]?.rollbacks || 0);
    })
  ]);
  return { failedJobs: failed, queuedJobs: queued, stuckJobs: stuck, failedTransactions24h: failedTransactions };
}

async function securityMetrics() {
  const since1h = new Date(Date.now() - 60 * 60 * 1000);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [failed1h, failed24h, suspiciousIps, adminActions, destructiveActions, openAlerts, criticalAlerts] = await Promise.all([
    safe(0, async () => Number((await db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(and(eq(auditLogs.action, "login"), gte(auditLogs.createdAt, since1h), sql`${auditLogs.afterData}->>'success' = 'false'`)))[0]?.count || 0)),
    safe(0, async () => Number((await db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(and(eq(auditLogs.action, "login"), gte(auditLogs.createdAt, since24h), sql`${auditLogs.afterData}->>'success' = 'false'`)))[0]?.count || 0)),
    safe([] as Array<{ ipAddress: string | null; count: number }>, async () => {
      const rows = await db
        .select({ ipAddress: auditLogs.ipAddress, count: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(and(eq(auditLogs.action, "login"), gte(auditLogs.createdAt, since1h), sql`${auditLogs.afterData}->>'success' = 'false'`))
        .groupBy(auditLogs.ipAddress)
        .orderBy(sql`count(*) desc`)
        .limit(8);
      return rows.map((row) => ({ ipAddress: row.ipAddress, count: Number(row.count || 0) }));
    }),
    safe(0, async () => Number((await db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(gte(auditLogs.createdAt, since24h)))[0]?.count || 0)),
    safe(0, async () => Number((await db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(and(eq(auditLogs.action, "delete"), gte(auditLogs.createdAt, since24h))))[0]?.count || 0)),
    safe(0, async () => Number((await db.select({ count: sql<number>`count(*)::int` }).from(securityAlerts).where(inArray(securityAlerts.status, ["open", "investigating"])))[0]?.count || 0)),
    safe(0, async () => Number((await db.select({ count: sql<number>`count(*)::int` }).from(securityAlerts).where(and(inArray(securityAlerts.status, ["open", "investigating"]), eq(securityAlerts.severity, "critical"))))[0]?.count || 0))
  ]);
  const authProtection = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 && getRedisConfig().backend !== "unconfigured" ? "strong" : process.env.JWT_SECRET ? "basic" : "weak";
  return { failedLogins1h: failed1h, failedLogins24h: failed24h, suspiciousIps, adminActions24h: adminActions, destructiveActions24h: destructiveActions, openAlerts, criticalAlerts, authProtection } as AdminProtectionSnapshot["security"];
}

function buildThreatAnalysis(security: AdminProtectionSnapshot["security"]): AdminProtectionSnapshot["threatAnalysis"] {
  const threats: AdminProtectionSnapshot["threatAnalysis"] = [];
  if (security.failedLogins1h >= 20) threats.push({ id: "brute-force-global", severity: "critical", title: "محاولات دخول فاشلة مرتفعة", message: `${security.failedLogins1h} محاولة فاشلة خلال آخر ساعة.`, evidence: { failedLogins1h: security.failedLogins1h, suspiciousIps: security.suspiciousIps }, recommendation: "فعّل مراقبة مشددة، راجع IPs، ارفع القيود، واطلب MFA للأدمن." });
  for (const ip of security.suspiciousIps.filter((item) => item.count >= 5)) {
    threats.push({ id: `suspicious-ip-${ip.ipAddress || "unknown"}`, severity: ip.count >= 10 ? "critical" : "warning", title: "IP مشبوه بمحاولات دخول متكررة", message: `${ip.count} محاولات فاشلة من ${ip.ipAddress || "unknown"}.`, evidence: ip, recommendation: "راقب هذا العنوان، أضفه لقائمة حظر في WAF إذا استمر، وراجع الحسابات المستهدفة." });
  }
  if (security.destructiveActions24h >= 10) threats.push({ id: "destructive-admin-actions", severity: "critical", title: "عمليات حذف كثيرة", message: `${security.destructiveActions24h} عملية حذف خلال 24 ساعة.`, evidence: { destructiveActions24h: security.destructiveActions24h }, recommendation: "راجع سجل التدقيق فوراً، وتأكد أنها صادرة من موظف مخول." });
  if (security.authProtection === "weak") threats.push({ id: "weak-auth-secret", severity: "critical", title: "حماية المصادقة ضعيفة", message: "JWT_SECRET غير قوي أو غير موجود.", recommendation: "اضبط JWT_SECRET عشوائي بطول 32+ حرفاً فوراً." });
  if (!threats.length) threats.push({ id: "threats-clear", severity: "success", title: "لا توجد تهديدات ظاهرة الآن", message: "لم تظهر مؤشرات brute-force أو حذف جماعي أو IPs عالية الخطورة ضمن البيانات المتاحة.", recommendation: "استمر في المراقبة وفعّل Telegram/Email للإشعارات الفورية." });
  return threats;
}

function buildPredictions(resources: AdminProtectionSnapshot["resources"], performance: AdminProtectionSnapshot["performance"], services: ServiceCheck[]): AdminProtectionSnapshot["predictions"] {
  const predictions: AdminProtectionSnapshot["predictions"] = [];
  if (resources.database.usagePercent >= 60) predictions.push({ id: "db-connection-exhaustion", severity: resources.database.usagePercent >= 75 ? "critical" : "warning", title: "احتمال استنزاف اتصالات قاعدة البيانات", message: `استخدام الاتصالات ${resources.database.usagePercent}% وقد يسبب timeouts عند حمل مفاجئ.`, probability: Math.min(95, resources.database.usagePercent + 15), recommendation: "استخدم pooler واضبط DB_POOL_MAX=3 وراقب pg_stat_activity." });
  if (resources.memory.heapUsagePercent >= 75) predictions.push({ id: "memory-pressure", severity: resources.memory.heapUsagePercent >= 88 ? "critical" : "warning", title: "احتمال ضغط ذاكرة", message: `استخدام heap ${resources.memory.heapUsagePercent}%.`, probability: Math.min(92, resources.memory.heapUsagePercent + 8), recommendation: "راجع payloads الكبيرة والعمليات الثقيلة، وفعّل مراقبة Sentry للأخطاء." });
  if (performance.failedJobs > 0 || performance.stuckJobs > 0) predictions.push({ id: "queue-backlog-growth", severity: "warning", title: "احتمال تراكم jobs", message: `فاشلة: ${performance.failedJobs}، عالقة: ${performance.stuckJobs}.`, probability: Math.min(90, 50 + performance.failedJobs * 5 + performance.stuckJobs * 10), recommendation: "نفّذ self-healing لإعادة المحاولة وتحرير العالق، ثم راقب Cron." });
  if (services.some((service) => service.key === "redis" && service.status !== "operational")) predictions.push({ id: "redis-cache-bypass-pressure", severity: "warning", title: "ضغط قاعدة البيانات بسبب Redis", message: "Redis غير مستقر/غير متصل مما يقلل cache hit-rate.", probability: 70, recommendation: "أعد ضبط Redis وتأكد من REDIS_REQUIRED=true في الإنتاج." });
  if (!predictions.length) predictions.push({ id: "stable-next-window", severity: "success", title: "لا توجد مؤشرات انهيار قريبة", message: "الموارد والطابور والخدمات ضمن حدود آمنة من البيانات الحالية.", probability: 15, recommendation: "استمر في الفحص الدوري كل 5 دقائق والتكامل مع Sentry." });
  return predictions;
}

function buildRootCauses(services: ServiceCheck[]) {
  return services
    .filter((service) => service.status !== "operational")
    .slice(0, 6)
    .map((service) => analyzeRootCause({ service: service.key, title: service.label, message: service.message, logs: [JSON.stringify(service.evidence || {})], deployment: deploymentMetadata() }));
}

function buildRecommendations(services: ServiceCheck[], resources: AdminProtectionSnapshot["resources"], security: AdminProtectionSnapshot["security"]): AdminProtectionSnapshot["recommendations"] {
  const recommendations: AdminProtectionSnapshot["recommendations"] = [];
  for (const service of services.filter((item) => item.status !== "operational")) {
    recommendations.push({ id: `service-${service.key}`, priority: service.severity, title: `تحسين ${service.label}`, action: service.message });
  }
  if (resources.database.usagePercent >= 50) recommendations.push({ id: "db-pooler", priority: "warning", title: "تقليل ضغط DB", action: "اضبط pooler و DB_POOL_MAX=3 وراجع slow queries." });
  if (security.failedLogins1h >= 5) recommendations.push({ id: "auth-hardening", priority: security.failedLogins1h >= 20 ? "critical" : "warning", title: "تقوية حماية الدخول", action: "فعّل MFA للأدمن وراجع IPs المشبوهة و rate limit." });
  if (!recommendations.length) recommendations.push({ id: "keep-watch", priority: "success", title: "المؤشرات مستقرة", action: "لا توجد إجراءات عاجلة؛ استمر بالمراقبة والتقارير اليومية." });
  return recommendations.slice(0, 10);
}

async function recentIncidents(): Promise<IncidentSummary[]> {
  return safe([] as IncidentSummary[], async () => {
    const rows = await db.select().from(platformIncidents).orderBy(desc(platformIncidents.lastSeenAt)).limit(20);
    return rows.map((row) => ({
      id: row.id,
      incidentKey: row.incidentKey,
      severity: row.severity,
      status: row.status,
      title: row.title,
      description: row.description,
      affectedService: row.affectedService,
      recommendation: row.recommendation,
      lastSeenAt: row.lastSeenAt.toISOString(),
      startedAt: row.startedAt.toISOString()
    }));
  });
}

async function recentAlerts() {
  return safe([] as AdminProtectionSnapshot["alerts"], async () => {
    const rows = await db.select({ id: securityAlerts.id, severity: securityAlerts.severity, status: securityAlerts.status, type: securityAlerts.type, title: securityAlerts.title, createdAt: securityAlerts.createdAt }).from(securityAlerts).orderBy(desc(securityAlerts.createdAt)).limit(10);
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  });
}

async function recentLogs(): Promise<StructuredLogSummary[]> {
  return safe([] as StructuredLogSummary[], async () => {
    const rows = await db.select().from(platformStructuredLogs).orderBy(desc(platformStructuredLogs.createdAt)).limit(20);
    return rows.map((row) => ({ id: row.id, level: row.level, category: row.category, service: row.service, message: row.message, correlationId: row.correlationId, requestPath: row.requestPath, ipAddress: row.ipAddress, createdAt: row.createdAt.toISOString() }));
  });
}

export async function writeStructuredLog(input: { level?: "debug" | "info" | "warn" | "error" | "critical"; category?: string; service?: string; message: string; correlationId?: string | null; actorId?: string | null; requestPath?: string | null; ipAddress?: string | null; metadata?: Record<string, unknown> }) {
  await safe(null, async () => {
    await db.insert(platformStructuredLogs).values({
      level: input.level || "info",
      category: input.category || "system",
      service: input.service || "platform",
      message: input.message,
      correlationId: input.correlationId || null,
      actorId: input.actorId || null,
      requestPath: input.requestPath || null,
      ipAddress: input.ipAddress || null,
      metadata: input.metadata || {}
    });
    return null;
  });
}

export async function persistHealthChecks(services: ServiceCheck[]) {
  await safe(null, async () => {
    if (!services.length) return null;
    await db.insert(platformHealthChecks).values(services.map((service) => ({ checkKey: service.key, service: service.label, status: service.status, latencyMs: service.latencyMs == null ? null : Math.round(service.latencyMs), message: service.message, details: service.evidence || {} })));
    return null;
  });
}

export async function createOrRefreshIncident(input: { incidentKey: string; severity: "info" | "warning" | "critical"; title: string; description?: string; affectedService: string; rootCause?: Record<string, unknown>; recommendation?: string; metadata?: Record<string, unknown>; actorId?: string | null }) {
  return safe(null, async () => {
    const [incident] = await db
      .insert(platformIncidents)
      .values({
        incidentKey: input.incidentKey,
        severity: input.severity,
        status: "open",
        title: input.title,
        description: input.description,
        affectedService: input.affectedService,
        rootCause: input.rootCause || {},
        recommendation: input.recommendation,
        metadata: input.metadata || {},
        createdBy: input.actorId || null,
        lastSeenAt: new Date(),
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: platformIncidents.incidentKey,
        set: {
          severity: input.severity,
          status: "open",
          title: input.title,
          description: input.description,
          affectedService: input.affectedService,
          rootCause: input.rootCause || {},
          recommendation: input.recommendation,
          metadata: input.metadata || {},
          lastSeenAt: new Date(),
          resolvedAt: null,
          updatedAt: new Date()
        }
      })
      .returning();
    await db.insert(platformIncidentEvents).values({ incidentId: incident.id, type: "detected", message: input.description || input.title, actorId: input.actorId || null, metadata: input.metadata || {} });
    return incident;
  });
}

async function autoIncidentsFromSnapshot(services: ServiceCheck[], rootCauses: RootCauseAnalysis[]) {
  const failing = services.filter((service) => service.status === "down" || service.severity === "critical" || service.status === "degraded");
  await Promise.all(failing.slice(0, 8).map((service) => {
    const root = rootCauses.find((item) => item.affectedService === service.key || item.relatedServices.includes(service.key));
    return createOrRefreshIncident({
      incidentKey: `service:${service.key}:${service.status}`,
      severity: service.severity === "critical" ? "critical" : "warning",
      title: `${service.label} ${service.status === "down" ? "متوقف" : "متدهور"}`,
      description: service.message,
      affectedService: service.key,
      rootCause: root as unknown as Record<string, unknown> | undefined,
      recommendation: root?.recommendation,
      metadata: { evidence: service.evidence, latencyMs: service.latencyMs }
    });
  }));
}

async function deploymentGate(services: ServiceCheck[], score: number) {
  const readiness = await safe(null as Awaited<ReturnType<typeof getProductionReadiness>> | null, () => getProductionReadiness());
  const blockers: string[] = [];
  const warnings: string[] = [];
  for (const service of services) {
    if (service.severity === "critical") blockers.push(`${service.label}: ${service.message}`);
    else if (service.severity === "warning") warnings.push(`${service.label}: ${service.message}`);
  }
  if (score < 55) blockers.push(`Health score منخفض: ${score}%`);
  else if (score < 75) warnings.push(`Health score يحتاج متابعة: ${score}%`);
  if (readiness) {
    for (const check of readiness.checks) {
      if (!check.ok && check.severity === "danger") blockers.push(`${check.label}: ${check.description}`);
      else if (!check.ok) warnings.push(`${check.label}: ${check.description}`);
    }
  }
  return { allowed: blockers.length === 0, blockers: [...new Set(blockers)].slice(0, 12), warnings: [...new Set(warnings)].slice(0, 12), checkedAt: nowIso() };
}

export async function getAdminProtectionSnapshot(options: { persist?: boolean } = {}): Promise<AdminProtectionSnapshot> {
  const [services, resources, performance, security] = await Promise.all([collectServices(), resourceMetrics(), performanceMetrics(), securityMetrics()]);
  const latencyValues = services.map((service) => service.latencyMs || 0).filter((value) => value > 0);
  const performanceWithLatency = { ...performance, avgServiceLatencyMs: latencyValues.length ? Math.round(latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length) : 0, slowServices: services.filter((service) => (service.latencyMs || 0) > 1000).length };
  const score = scorePlatformHealth(services, { dbUsagePercent: resources.database.usagePercent, heapUsagePercent: resources.memory.heapUsagePercent, failedJobs: performance.failedJobs, criticalAlerts: security.criticalAlerts, failedLogins1h: security.failedLogins1h });
  const grade = gradeFromScore(score);
  const rootCauses = buildRootCauses(services);
  const threatAnalysis = buildThreatAnalysis(security);
  const predictions = buildPredictions(resources, performanceWithLatency, services);
  const recommendations = buildRecommendations(services, resources, security);
  if (options.persist) {
    await persistHealthChecks(services);
    await autoIncidentsFromSnapshot(services, rootCauses);
  }
  const [incidents, alerts, logs, gate] = await Promise.all([recentIncidents(), recentAlerts(), recentLogs(), deploymentGate(services, score)]);
  return {
    generatedAt: nowIso(),
    realtime: { transport: "sse", intervalMs: LIVE_INTERVAL_MS, websocketReady: true, message: "Live updates مفعلة عبر SSE المتوافق مع Vercel، والهيكل جاهز للترقية إلى WebSocket worker عند الحاجة." },
    score,
    grade,
    statusLabel: grade === "Excellent" ? "ممتاز" : grade === "Good" ? "جيد" : grade === "Warning" ? "تحذير" : "حرج",
    services,
    resources,
    performance: performanceWithLatency,
    security,
    incidents,
    alerts,
    logs,
    rootCauses: rootCauses.length ? rootCauses : [analyzeRootCause({ service: "platform", title: "وضع مستقر", message: "لا توجد خدمات متدهورة في هذه اللقطة", deployment: deploymentMetadata() })].map((item) => ({ ...item, severity: "warning" as const, likelyCause: "لا توجد أعطال ظاهرة؛ التحليل الاحترازي يراقب تغيرات الموارد والسجلات." })),
    threatAnalysis,
    predictions,
    recommendations,
    alertChannels: { inApp: true, telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID), email: Boolean(process.env.EMAIL_WEBHOOK_URL || process.env.SMTP_HOST || process.env.RESEND_API_KEY), sentry: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) },
    deploymentGate: gate,
    selfHealing: {
      enabledActions: [
        { action: "run_health_checks", label: "تشغيل فحص شامل", risk: "safe", description: "يحفظ نتائج health checks وينشئ Incidents للخدمات المتدهورة." },
        { action: "retry_failed_jobs", label: "إعادة jobs الفاشلة", risk: "controlled", description: "ينقل jobs الفاشلة إلى retry إذا لم تتجاوز maxAttempts." },
        { action: "release_stuck_jobs", label: "تحرير jobs العالقة", risk: "controlled", description: "يعيد jobs التي انتهى lock الخاص بها إلى retry." },
        { action: "cleanup_cache", label: "تنظيف الكاش", risk: "safe", description: "يمسح cache tags العامة والخاصة المعروفة بدون حذف Redis بالكامل." },
        { action: "enable_emergency_mode", label: "تفعيل وضع الطوارئ", risk: "emergency", description: "يفعل lockdown/maintenance لحماية قاعدة البيانات عند خطر شديد." }
      ]
    }
  };
}

export async function sendSmartAlert(input: { severity: "info" | "warning" | "critical"; title: string; message: string; actorId?: string | null; metadata?: Record<string, unknown> }) {
  const payload = { severity: input.severity, title: input.title, message: input.message, metadata: input.metadata || {}, createdAt: nowIso() };
  await safe(null, async () => {
    await db.insert(notifications).values({ userId: input.actorId || null, title: input.title, body: input.message, type: "platform_security_alert", data: payload });
    return null;
  });

  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID) {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID, text: `🚨 ${input.title}\n${input.message}\nSeverity: ${input.severity}` })
    }).catch((error) => console.error("telegram alert failed", error));
  }

  const emailWebhook = process.env.ALERT_EMAIL_WEBHOOK_URL || process.env.EMAIL_WEBHOOK_URL;
  if (emailWebhook) {
    await fetch(emailWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: input.title, text: input.message, payload })
    }).catch((error) => console.error("email alert webhook failed", error));
  }
}

export async function runSelfHealing(action: SelfHealingAction, actorId?: string | null) {
  if (action === "run_health_checks") {
    const snapshot = await getAdminProtectionSnapshot({ persist: true });
    await writeStructuredLog({ level: "info", category: "self_healing", service: "security_center", message: "تم تشغيل فحص شامل من مركز الحماية", actorId, metadata: { score: snapshot.score, grade: snapshot.grade } });
    return { message: "تم تشغيل الفحص وحفظ النتائج", details: { score: snapshot.score, incidents: snapshot.incidents.length } };
  }

  if (action === "retry_failed_jobs") {
    const result = await db
      .update(backgroundJobs)
      .set({ status: "retry", availableAt: new Date(), lockedAt: null, lockedUntil: null, updatedAt: new Date() })
      .where(and(eq(backgroundJobs.status, "failed"), sql`${backgroundJobs.attempts} < ${backgroundJobs.maxAttempts}`))
      .returning({ id: backgroundJobs.id });
    await writeStructuredLog({ level: "warn", category: "self_healing", service: "queue_jobs", message: `تمت إعادة ${result.length} jobs فاشلة إلى retry`, actorId, metadata: { count: result.length } });
    return { message: `تمت إعادة ${result.length} jobs فاشلة إلى retry`, details: { count: result.length } };
  }

  if (action === "release_stuck_jobs") {
    const result = await db
      .update(backgroundJobs)
      .set({ status: "retry", lockedAt: null, lockedUntil: null, availableAt: new Date(), updatedAt: new Date(), lastError: sql`coalesce(${backgroundJobs.lastError}, '') || '\nReleased by self-healing center'` })
      .where(and(eq(backgroundJobs.status, "processing"), sql`${backgroundJobs.lockedUntil} < now()`))
      .returning({ id: backgroundJobs.id });
    await writeStructuredLog({ level: "warn", category: "self_healing", service: "queue_jobs", message: `تم تحرير ${result.length} jobs عالقة`, actorId, metadata: { count: result.length } });
    return { message: `تم تحرير ${result.length} jobs عالقة`, details: { count: result.length } };
  }

  if (action === "cleanup_cache") {
    await Promise.all([
      cacheDeleteByTags(["home", "stores", "products", "wings", "offers", "settings", "search", "search:home", "search:smart", "search:advanced"]),
      invalidatePrivateApiCacheTags(["admin:wings", "admin:stores"])
    ]);
    await writeStructuredLog({ level: "info", category: "self_healing", service: "redis", message: "تم تنظيف cache tags المعروفة", actorId });
    return { message: "تم تنظيف cache tags العامة والخاصة المعروفة", details: { safe: true } };
  }

  if (action === "enable_emergency_mode") {
    const settings = normalizeSecuritySettings({ ...defaultSecuritySettings, emergencyLockdown: true, maintenanceMode: true, securityLevel: "lockdown", reason: "تم التفعيل تلقائياً/يدوياً من مركز حماية المنصة بسبب خطر شديد", updatedAt: nowIso(), updatedBy: actorId || undefined });
    await db
      .insert(systemSettings)
      .values({ group: "security", key: "platform_guard", value: settings, isPublic: false, updatedBy: actorId || null })
      .onConflictDoUpdate({ target: [systemSettings.group, systemSettings.key], set: { value: settings, updatedBy: actorId || null, updatedAt: new Date() } });
    await writeStructuredLog({ level: "critical", category: "self_healing", service: "emergency_mode", message: "تم تفعيل وضع الطوارئ من مركز الحماية", actorId, metadata: settings as Record<string, unknown> });
    await sendSmartAlert({ severity: "critical", title: "تم تفعيل وضع الطوارئ", message: "تم إيقاف/حماية المنصة من مركز الحماية بسبب خطر شديد.", actorId, metadata: settings as Record<string, unknown> });
    return { message: "تم تفعيل وضع الطوارئ", details: { securityLevel: settings.securityLevel } };
  }

  throw new Error("إجراء self-healing غير معروف");
}
