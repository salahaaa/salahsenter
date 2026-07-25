import "dotenv/config";
import { getReconciliationDashboardData } from "@/lib/integrations/accounting/reliability";
import { getProductionReadiness } from "@/lib/production/readiness";
import { client } from "@/lib/db";

try {
  const [reconciliation, readiness] = await Promise.all([getReconciliationDashboardData(), getProductionReadiness()]);
  const summary = reconciliation.summary as Record<string, unknown>;
  const checks = {
    negativeAvailableInventory: Number(summary.negative_available || 0) === 0,
    expiredReservations: Number(summary.expired_reservations || 0) === 0,
    failedSyncs: Number(summary.failed_syncs || 0) === 0,
    retryQueue: Number(summary.retry_queue || 0) === 0,
    duplicateIdempotency: readiness.metrics.duplicateIdempotency === 0,
    duplicateInventoryMovements: readiness.metrics.duplicateInventoryMovements === 0,
    negativeStock: readiness.metrics.negativeStock === 0
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  console.log(JSON.stringify({ ok: failed.length === 0, failed, checks, generatedAt: new Date().toISOString(), reconciliation: summary, readinessMetrics: readiness.metrics }, null, 2));
  if (failed.length) process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 }).catch(() => undefined);
}
