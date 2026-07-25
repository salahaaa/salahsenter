"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, RefreshCw, RotateCcw, TimerReset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type DashboardData = {
  generatedAt: string;
  summary: Record<string, number>;
  failedSyncs: Array<{ id: string; integrationEventId: string | null; resource: string; direction: string; failureType: string; status: string; attempts: number; error: string | null; createdAt: string }>;
  retryQueue: Array<{ id: string; eventType: string; entityType: string; status: string; attempts: number; maxAttempts: number; nextAttemptAt: string; lastError: string | null }>;
  awaitingErpInvoice: Array<Record<string, unknown>>;
  staleReservations: Array<{ id: string; orderNumber: string; statusCode: string; reservationStatus: string; reservationExpiresAt: string | null; createdAt: string }>;
  negativeAvailable: Array<{ id: string; sku: string; stockQuantity: number; reservedQuantity: number }>;
  recentMovements: Array<Record<string, unknown>>;
  recentAudit: Array<Record<string, unknown>>;
};

export function ReconciliationDashboard({ initial }: { initial: DashboardData }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function retry(eventId: string | null) {
    if (!eventId) return;
    setLoading(true);
    const response = await fetch("/api/admin/integrations/reconciliation/retry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId }) });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? "✓ تمت إعادة الحدث إلى Retry Queue" : json.message || "تعذر إعادة المحاولة");
    if (response.ok) router.refresh();
  }

  async function expireReservations() {
    setLoading(true);
    const response = await fetch("/api/admin/integrations/reconciliation/expire-reservations", { method: "POST" });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? `✓ ${json.data?.message || "تم إنهاء الحجوزات"}` : json.message || "تعذر إنهاء الحجوزات");
    if (response.ok) router.refresh();
  }

  return (
    <div className="space-y-8">
      {message ? <div className="rounded-2xl border bg-white p-4 text-sm font-bold text-slate-700 shadow-card">{message}</div> : null}
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat title="Retry Queue" value={Number(initial.summary.retry_queue || 0)} tone={initial.summary.retry_queue ? "warn" : "ok"} />
        <Stat title="Failed Events" value={Number(initial.summary.failed_events || 0)} tone={initial.summary.failed_events ? "danger" : "ok"} />
        <Stat title="Failed Syncs" value={Number(initial.summary.failed_syncs || 0)} tone={initial.summary.failed_syncs ? "danger" : "ok"} />
        <Stat title="Expired Reservations" value={Number(initial.summary.expired_reservations || 0)} tone={initial.summary.expired_reservations ? "danger" : "ok"} />
        <Stat title="Awaiting ERP Invoice" value={Number(initial.summary.awaiting_erp_invoice || 0)} tone={initial.summary.awaiting_erp_invoice ? "warn" : "ok"} />
        <Stat title="Negative Available" value={Number(initial.summary.negative_available || 0)} tone={initial.summary.negative_available ? "danger" : "ok"} />
      </section>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => router.refresh()} variant="outline"><RefreshCw className="h-4 w-4" /> تحديث</Button>
        <Button onClick={expireReservations} disabled={loading}><TimerReset className="h-4 w-4" /> إنهاء الحجوزات المنتهية</Button>
      </div>

      <Table title="Failed Sync Queue" empty="لا توجد مزامنات فاشلة مفتوحة.">
        {initial.failedSyncs.map((item) => <tr key={item.id} className="border-t"><td className="p-3 font-black">{item.resource}</td><td className="p-3"><Badge variant="danger">{item.failureType}</Badge></td><td className="p-3">{item.attempts}</td><td className="p-3 max-w-md truncate text-red-700">{item.error || "—"}</td><td className="p-3"><Button size="sm" variant="outline" onClick={() => retry(item.integrationEventId)} disabled={!item.integrationEventId || loading}><RotateCcw className="h-4 w-4" /> Retry</Button></td></tr>)}
      </Table>

      <Table title="Retry Queue" empty="لا توجد أحداث في Retry Queue.">
        {initial.retryQueue.map((item) => <tr key={item.id} className="border-t"><td className="p-3 font-black">{item.eventType}</td><td className="p-3">{item.entityType}</td><td className="p-3"><Badge variant={item.status === "retry" ? "warning" : "outline"}>{item.status}</Badge></td><td className="p-3">{item.attempts}/{item.maxAttempts}</td><td className="p-3 text-xs">{String(item.nextAttemptAt)}</td></tr>)}
      </Table>

      <Table title="Reservations Awaiting Expiry / Release" empty="لا توجد حجوزات منتهية.">
        {initial.staleReservations.map((item) => <tr key={item.id} className="border-t"><td className="p-3 font-black">{item.orderNumber}</td><td className="p-3">{item.statusCode}</td><td className="p-3"><Badge variant="warning">{item.reservationStatus}</Badge></td><td className="p-3 text-xs">{item.reservationExpiresAt || "—"}</td></tr>)}
      </Table>

      <Table title="Orders Awaiting ERP Invoice" empty="لا توجد طلبات معلقة على فاتورة ERP.">
        {initial.awaitingErpInvoice.map((item) => <tr key={String(item.id)} className="border-t"><td className="p-3 font-black">{String(item.order_number || item.orderNumber || item.id)}</td><td className="p-3">{String(item.status_code || item.statusCode || "")}</td><td className="p-3">{String(item.payment_status || item.paymentStatus || "")}</td><td className="p-3 text-xs">{String(item.created_at || item.createdAt || "")}</td></tr>)}
      </Table>

      <Table title="Negative Available Stock" empty="لا توجد كميات متاحة سالبة.">
        {initial.negativeAvailable.map((item) => <tr key={item.id} className="border-t"><td className="p-3 font-black">{item.sku}</td><td className="p-3">ERP Stock: {item.stockQuantity}</td><td className="p-3">Reserved: {item.reservedQuantity}</td><td className="p-3"><Badge variant="danger">Needs ERP sync/release</Badge></td></tr>)}
      </Table>
    </div>
  );
}

function Stat({ title, value, tone }: { title: string; value: number; tone: "ok" | "warn" | "danger" }) {
  const cls = tone === "ok" ? "text-emerald-700 bg-emerald-50" : tone === "warn" ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
  const Icon = tone === "ok" ? CheckCircle2 : AlertTriangle;
  return <div className="rounded-3xl border bg-white p-5 shadow-card"><div className={`mb-2 inline-flex rounded-xl p-2 ${cls}`}><Icon className="h-5 w-5" /></div><p className="text-xs font-bold text-slate-500">{title}</p><p className="mt-1 text-3xl font-black text-slate-950">{value}</p></div>;
}

function Table({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="rounded-[2rem] border bg-white p-6 shadow-card"><h2 className="mb-4 text-xl font-black text-slate-950">{title}</h2>{hasRows ? <div className="overflow-auto rounded-2xl border"><table className="w-full text-sm"><tbody>{children}</tbody></table></div> : <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-700">{empty}</div>}</section>;
}
