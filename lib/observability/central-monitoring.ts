import { and, desc, gte, inArray, sql } from "drizzle-orm";
import { db, platformHealthChecks, platformStructuredLogs } from "@/lib/db";
import { getAdminProtectionSnapshot, type AdminProtectionSnapshot, type ServiceCheck } from "@/lib/admin/platform-protection-center";
import { getRequestTrafficSnapshot, type RequestTrafficSnapshot } from "@/lib/observability/request-metrics";
import { getReconciliationDashboardData } from "@/lib/integrations/accounting/reliability";

export type CentralMonitoringSnapshot = {
  generatedAt: string;
  health: {
    score: number;
    grade: AdminProtectionSnapshot["grade"];
    label: string;
    stoppedServices: number;
    slowServices: number;
    degradedServices: number;
  };
  realtime: AdminProtectionSnapshot["realtime"];
  services: ServiceCheck[];
  load: {
    memory: AdminProtectionSnapshot["resources"]["memory"];
    cpu: AdminProtectionSnapshot["resources"]["cpu"];
    database: AdminProtectionSnapshot["resources"]["database"];
  };
  requests: RequestTrafficSnapshot & {
    failedRequestsLast1h: number;
    errorsLast24h: number;
    apiP95ResponseMs: number;
    avgServiceResponseMs: number;
  };
  redis: {
    status: ServiceCheck["status"];
    message: string;
    evidence?: Record<string, unknown>;
  };
  queues: {
    queued: number;
    failed: number;
    stuck: number;
  };
  erp: {
    retryQueue: number;
    failedEvents: number;
    failedSyncs: number;
    awaitingInvoice: number;
    expiredReservations: number;
    negativeAvailable: number;
  };
  uploads: {
    status: ServiceCheck["status"];
    message: string;
    evidence?: Record<string, unknown>;
  };
  incidents: AdminProtectionSnapshot["incidents"];
  errors: Array<{ id: string; level: string; service: string; message: string; requestPath: string | null; createdAt: string; correlationId: string | null }>;
  integrations: {
    prometheus: { enabled: boolean; endpoint: string; protected: boolean };
    grafana: { configured: boolean; url?: string };
    sentry: { configured: boolean };
  };
};

async function safe<T>(fallback: T, loader: () => Promise<T>) {
  try {
    return await loader();
  } catch (error) {
    console.error("central monitoring loader failed", error);
    return fallback;
  }
}

function service(snapshot: AdminProtectionSnapshot, key: string) {
  return snapshot.services.find((item) => item.key === key);
}

async function errorMetrics() {
  const since1h = new Date(Date.now() - 60 * 60 * 1000);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [failed1h, errors24h, recentErrors, apiP95] = await Promise.all([
    safe(0, async () => Number((await db.select({ count: sql<number>`count(*)::int` }).from(platformStructuredLogs).where(and(gte(platformStructuredLogs.createdAt, since1h), inArray(platformStructuredLogs.level, ["error", "critical"]))))[0]?.count || 0)),
    safe(0, async () => Number((await db.select({ count: sql<number>`count(*)::int` }).from(platformStructuredLogs).where(and(gte(platformStructuredLogs.createdAt, since24h), inArray(platformStructuredLogs.level, ["error", "critical"]))))[0]?.count || 0)),
    safe([] as CentralMonitoringSnapshot["errors"], async () => {
      const rows = await db
        .select({
          id: platformStructuredLogs.id,
          level: platformStructuredLogs.level,
          service: platformStructuredLogs.service,
          message: platformStructuredLogs.message,
          requestPath: platformStructuredLogs.requestPath,
          correlationId: platformStructuredLogs.correlationId,
          createdAt: platformStructuredLogs.createdAt
        })
        .from(platformStructuredLogs)
        .where(inArray(platformStructuredLogs.level, ["error", "critical"]))
        .orderBy(desc(platformStructuredLogs.createdAt))
        .limit(20);
      return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
    }),
    safe(0, async () => {
      const result = await db.execute(sql`
        select coalesce(percentile_disc(0.95) within group (order by latency_ms), 0)::int as p95
        from platform_health_checks
        where check_key in ('apis','database','redis','uploads')
          and latency_ms is not null
          and created_at >= now() - interval '1 hour'
      `);
      return Number((result as any)[0]?.p95 || 0);
    })
  ]);
  return { failed1h, errors24h, recentErrors, apiP95 };
}

export async function getCentralMonitoringSnapshot(options: { persist?: boolean } = {}): Promise<CentralMonitoringSnapshot> {
  const [protection, traffic, errors, erp] = await Promise.all([
    getAdminProtectionSnapshot({ persist: options.persist }),
    getRequestTrafficSnapshot(60),
    errorMetrics(),
    safe<any>({ summary: {} }, () => getReconciliationDashboardData())
  ]);

  const redis = service(protection, "redis");
  const uploads = service(protection, "uploads");
  const stoppedServices = protection.services.filter((item) => item.status === "down").length;
  const slowServices = protection.services.filter((item) => (item.latencyMs || 0) > 1000).length;
  const degradedServices = protection.services.filter((item) => item.status === "degraded").length;

  return {
    generatedAt: protection.generatedAt,
    health: {
      score: protection.score,
      grade: protection.grade,
      label: protection.statusLabel,
      stoppedServices,
      slowServices,
      degradedServices
    },
    realtime: protection.realtime,
    services: protection.services,
    load: protection.resources,
    requests: {
      ...traffic,
      failedRequestsLast1h: errors.failed1h,
      errorsLast24h: errors.errors24h,
      apiP95ResponseMs: errors.apiP95 || protection.performance.avgServiceLatencyMs,
      avgServiceResponseMs: protection.performance.avgServiceLatencyMs
    },
    redis: {
      status: redis?.status || "unknown",
      message: redis?.message || "لم يتم فحص Redis",
      evidence: redis?.evidence
    },
    queues: {
      queued: protection.performance.queuedJobs,
      failed: protection.performance.failedJobs,
      stuck: protection.performance.stuckJobs
    },
    erp: {
      retryQueue: Number(erp.summary.retry_queue || 0),
      failedEvents: Number(erp.summary.failed_events || 0),
      failedSyncs: Number(erp.summary.failed_syncs || 0),
      awaitingInvoice: Number(erp.summary.awaiting_erp_invoice || 0),
      expiredReservations: Number(erp.summary.expired_reservations || 0),
      negativeAvailable: Number(erp.summary.negative_available || 0)
    },
    uploads: {
      status: uploads?.status || "unknown",
      message: uploads?.message || "لم يتم فحص خدمة الرفع",
      evidence: uploads?.evidence
    },
    incidents: protection.incidents,
    errors: errors.recentErrors,
    integrations: {
      prometheus: { enabled: true, endpoint: "/api/metrics", protected: Boolean(process.env.METRICS_TOKEN) },
      grafana: { configured: Boolean(process.env.GRAFANA_URL || process.env.GRAFANA_DASHBOARD_URL), url: process.env.GRAFANA_DASHBOARD_URL || process.env.GRAFANA_URL || undefined },
      sentry: { configured: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) }
    }
  };
}

export function prometheusStatusValue(status: ServiceCheck["status"]) {
  if (status === "operational") return 1;
  if (status === "degraded") return 0.5;
  return 0;
}

export function renderPrometheusMetrics(snapshot: CentralMonitoringSnapshot) {
  const lines: string[] = [];
  const push = (name: string, value: number, help: string, labels: Record<string, string> = {}) => {
    const labelText = Object.keys(labels).length
      ? `{${Object.entries(labels).map(([key, val]) => `${key}=${JSON.stringify(val)}`).join(",")}}`
      : "";
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} gauge`);
    lines.push(`${name}${labelText} ${Number.isFinite(value) ? value : 0}`);
  };

  push("platform_health_score", snapshot.health.score, "Overall platform health score 0-100");
  push("platform_services_down", snapshot.health.stoppedServices, "Number of down services");
  push("platform_services_slow", snapshot.health.slowServices, "Number of slow services");
  push("platform_memory_heap_usage_percent", snapshot.load.memory.heapUsagePercent, "Node heap usage percent");
  push("platform_memory_rss_mb", snapshot.load.memory.rssMb, "Node RSS memory in MB");
  push("platform_cpu_load_1m", snapshot.load.cpu.load1m, "CPU load average 1 minute");
  push("platform_db_connections_used", snapshot.load.database.connectionsUsed, "Used database connections");
  push("platform_db_connections_usage_percent", snapshot.load.database.usagePercent, "Database connections usage percent");
  push("platform_queue_failed_jobs", snapshot.queues.failed, "Failed background jobs");
  push("platform_queue_queued_jobs", snapshot.queues.queued, "Queued/retry/processing background jobs");
  push("platform_erp_retry_queue", snapshot.erp.retryQueue, "ERP events waiting for retry");
  push("platform_erp_failed_syncs", snapshot.erp.failedSyncs, "ERP failed synchronization records");
  push("platform_erp_awaiting_invoice", snapshot.erp.awaitingInvoice, "Orders awaiting ERP invoice reconciliation");
  push("platform_inventory_negative_available", snapshot.erp.negativeAvailable, "Variants with negative available inventory");
  push("platform_requests_last_5m",  snapshot.requests.requestsLast5m, "Observed requests in the last 5 minutes");
  push("platform_api_requests_last_5m", snapshot.requests.apiRequestsLast5m, "Observed API requests in the last 5 minutes");
  push("platform_failed_requests_last_1h", snapshot.requests.failedRequestsLast1h, "Tracked failed API/server requests in the last hour");
  push("platform_api_p95_response_ms", snapshot.requests.apiP95ResponseMs, "API/check p95 response time in ms");
  for (const item of snapshot.services) {
    push("platform_service_status", prometheusStatusValue(item.status), "Service status: 1 operational, 0.5 degraded, 0 down", { service: item.key, group: item.group });
    push("platform_service_latency_ms", item.latencyMs || 0, "Service check latency in ms", { service: item.key, group: item.group });
  }
  return `${lines.join("\n")}\n`;
}
