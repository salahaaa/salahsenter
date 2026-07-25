"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Eye, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type AlertRow = {
  alert: {
    id: string;
    severity: string;
    status: string;
    type: string;
    title: string;
    description: string | null;
    ipAddress: string | null;
    recommendedAction: string | null;
    evidence: Record<string, unknown>;
    createdAt: Date;
  };
  actorName: string | null;
  actorEmail: string | null;
};

export function SecurityAlertsPanel({ alerts }: { alerts: AlertRow[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function scan() {
    setLoading(true);
    const response = await fetch("/api/admin/security/scan", { method: "POST" });
    const json = await response.json();
    setLoading(false);
    setMessage(response.ok ? `✓ ${json.data?.message || json.message}` : json.message || "تعذر الفحص");
    if (response.ok) router.refresh();
  }

  async function update(id: string, status: string) {
    const note = status === "resolved" || status === "ignored" ? window.prompt("ملاحظة الإغلاق", "تمت المراجعة") || undefined : undefined;
    const response = await fetch(`/api/admin/security/alerts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, note }) });
    const json = await response.json();
    setMessage(response.ok ? "✓ تم تحديث التنبيه" : json.message || "تعذر التحديث");
    if (response.ok) router.refresh();
  }

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-card">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-950">مراقبة النشاط المشبوه</h2>
          <p className="mt-1 text-sm text-slate-500">يفحص النظام محاولات الدخول الفاشلة، الحذف الجماعي، والتعديلات غير المعتادة.</p>
        </div>
        <Button onClick={scan} disabled={loading}><ShieldAlert className="h-4 w-4" /> {loading ? "جارٍ الفحص..." : "فحص النشاط الآن"}</Button>
      </div>
      {message ? <p className="mb-4 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-600">{message}</p> : null}
      {!alerts.length ? <div className="rounded-2xl bg-emerald-50 p-5 text-sm font-black text-emerald-700"><CheckCircle2 className="ml-2 inline h-5 w-5" /> لا توجد تنبيهات أمنية حالياً.</div> : <div className="space-y-3">{alerts.map((row) => <SecurityAlertCard key={row.alert.id} row={row} onUpdate={update} />)}</div>}
    </section>
  );
}

function SecurityAlertCard({ row, onUpdate }: { row: AlertRow; onUpdate: (id: string, status: string) => void }) {
  const alert = row.alert;
  const variant = alert.severity === "critical" ? "danger" : alert.severity === "high" ? "warning" : "outline";
  return (
    <article className="rounded-2xl border bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap gap-2"><Badge variant={variant as any}>{alert.severity}</Badge><Badge variant="outline">{alert.status}</Badge><Badge variant="outline">{alert.type}</Badge></div>
          <h3 className="font-black text-slate-950"><AlertTriangle className="ml-1 inline h-4 w-4 text-amber-500" /> {alert.title}</h3>
          {alert.description ? <p className="mt-2 text-sm leading-7 text-slate-600">{alert.description}</p> : null}
          <p className="mt-2 text-xs font-bold text-slate-500">المستخدم: {row.actorName || row.actorEmail || "غير معروف"} — IP: {alert.ipAddress || "غير معروف"}</p>
          {alert.recommendedAction ? <p className="mt-3 rounded-xl bg-white p-3 text-xs font-bold leading-6 text-slate-600">الإجراء المقترح: {alert.recommendedAction}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onUpdate(alert.id, "investigating")}><Eye className="h-4 w-4" /> تحقيق</Button>
          <Button size="sm" variant="secondary" onClick={() => onUpdate(alert.id, "resolved")}><CheckCircle2 className="h-4 w-4" /> حل</Button>
          <Button size="sm" variant="outline" onClick={() => onUpdate(alert.id, "ignored")}><XCircle className="h-4 w-4" /> تجاهل</Button>
        </div>
      </div>
    </article>
  );
}
