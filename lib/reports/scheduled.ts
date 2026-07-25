import { and, eq, lte } from "drizzle-orm";
import { db, scheduledReportDeliveries, scheduledReports } from "@/lib/db";
import { calculateFinancialCloseSnapshot, utcDayRange } from "@/lib/finance/close";
import { getReconciliationDashboardData } from "@/lib/integrations/accounting/reliability";
import { sendTransactionalMessage } from "@/lib/outbound";
import { renderReportPdf } from "@/lib/reports/pdf-renderer";

export type ScheduledReportFrequency = "daily" | "weekly" | "monthly";
export type ScheduledReportType = "financial_summary" | "reconciliation";

export function nextScheduledRun(from: Date, frequency: ScheduledReportFrequency) {
  const next = new Date(from);
  if (frequency === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else if (frequency === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function csvSummary(snapshot: Record<string, unknown>) {
  const rows = [["metric", "value"]];
  for (const [section, values] of Object.entries(snapshot)) {
    if (values && typeof values === "object" && !Array.isArray(values)) for (const [key, value] of Object.entries(values as Record<string, unknown>)) rows.push([`${section}.${key}`, String(value ?? "")]);
  }
  return `\uFEFF${rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n")}`;
}

async function buildSnapshot(type: ScheduledReportType) {
  if (type === "reconciliation") return { type, generatedAt: new Date().toISOString(), reconciliation: await getReconciliationDashboardData() };
  const range = utcDayRange();
  return { type, periodStart: range.start.toISOString(), periodEnd: range.end.toISOString(), generatedAt: new Date().toISOString(), financial: await calculateFinancialCloseSnapshot({ periodStart: range.start, periodEnd: range.end }) };
}

export async function processScheduledReports(limit = 25) {
  const now = new Date();
  const due = await db.select().from(scheduledReports).where(and(eq(scheduledReports.isActive, true), lte(scheduledReports.nextRunAt, now))).limit(Math.max(1, Math.min(limit, 100)));
  const results = [];
  for (const report of due) {
    const recipients = report.recipients || [];
    const frequency = report.frequency as ScheduledReportFrequency;
    try {
      const rawSnapshot = await buildSnapshot(report.reportType as ScheduledReportType);
      const pdfUrl = report.outputFormat === "pdf" ? await renderReportPdf({ title: report.name, snapshot: rawSnapshot }) : null;
      const snapshot = pdfUrl ? { ...rawSnapshot, pdfUrl } : rawSnapshot;
      const [delivery] = await db.insert(scheduledReportDeliveries).values({ reportId: report.id, status: "generated", recipients, snapshot, outputFormat: report.outputFormat, generatedAt: now }).returning();
      const body = report.outputFormat === "csv" ? csvSummary(snapshot) : report.outputFormat === "pdf" ? `تم إنشاء تقرير PDF: ${pdfUrl}` : JSON.stringify(snapshot, null, 2);
      const outcomes = await Promise.all(recipients.map(async (recipient) => sendTransactionalMessage({ channel: "email", to: recipient, subject: `تقرير ${report.name}`, message: body, template: "scheduled_report", data: { reportId: report.id, deliveryId: delivery.id, outputFormat: report.outputFormat } })));
      const delivered = outcomes.some((outcome: any) => outcome?.delivered === true);
      const skipped = outcomes.length > 0 && outcomes.every((outcome: any) => outcome?.skipped || outcome?.logged);
      await db.update(scheduledReportDeliveries).set({ status: delivered ? "delivered" : skipped ? "generated" : "failed", deliveredAt: delivered ? new Date() : null, updatedAt: new Date() }).where(eq(scheduledReportDeliveries.id, delivery.id));
      await db.update(scheduledReports).set({ lastRunAt: now, nextRunAt: nextScheduledRun(now, frequency), updatedAt: now }).where(eq(scheduledReports.id, report.id));
      results.push({ reportId: report.id, deliveryId: delivery.id, status: delivered ? "delivered" : skipped ? "generated_no_email_provider" : "failed" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.insert(scheduledReportDeliveries).values({ reportId: report.id, status: "failed", recipients, snapshot: {}, outputFormat: report.outputFormat, error: message.slice(0, 5000), generatedAt: now }).catch(() => undefined);
      await db.update(scheduledReports).set({ nextRunAt: nextScheduledRun(now, frequency), updatedAt: now }).where(eq(scheduledReports.id, report.id));
      results.push({ reportId: report.id, status: "failed", error: message });
    }
  }
  return { due: due.length, results };
}
