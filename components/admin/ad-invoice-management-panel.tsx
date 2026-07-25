"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { apiClient, ApiClientError } from "@/lib/client/api-client";
import { formatCurrency } from "@/lib/utils";

type InvoiceRow = { invoice: { id: string; invoiceNumber: string; totalAmount: string | number; currency: string; status: string; dueAt: string | Date | null; periodStart: string | Date; periodEnd: string | Date; metadata?: Record<string, unknown> }; storeName: string; storeNumber: string | null; merchantName: string | null; merchantEmail: string | null };

function badge(status: string) {
  if (status === "paid") return "success" as const;
  if (status === "void") return "outline" as const;
  return status === "overdue" ? "danger" as const : "warning" as const;
}

export function AdInvoiceManagementPanel({ invoices }: { invoices: InvoiceRow[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<{ invoice: InvoiceRow["invoice"]; action: "mark_paid" | "void" } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function settle(reason: string) {
    if (!target) return;
    setLoading(true); setError(null);
    try {
      await apiClient.patch("/api/admin/ads/invoices", { invoiceId: target.invoice.id, action: target.action, note: reason }, { invalidateTags: ["admin:ads", "ads:billing"] });
      setTarget(null); router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "تعذر تحديث الفاتورة");
    } finally { setLoading(false); }
  }

  if (!invoices.length) return <div className="rounded-3xl border border-dashed bg-white p-8 text-center text-sm font-bold text-slate-500">لا توجد فواتير إعلانية صادرة بعد. يصدر cron اليوم السابق فقط من قيود التكلفة المستحقة.</div>;
  return <>
    <div className="overflow-x-auto rounded-3xl border bg-white shadow-card"><table className="w-full min-w-[1050px] text-right text-sm"><thead className="bg-slate-100"><tr><th className="p-3">الفاتورة</th><th className="p-3">المتجر/التاجر</th><th className="p-3">فترة الرسوم</th><th className="p-3">المبلغ</th><th className="p-3">الاستحقاق</th><th className="p-3">الحالة</th><th className="p-3">إجراء</th></tr></thead><tbody>{invoices.map((row) => <tr key={row.invoice.id} className="border-t align-top"><td className="p-3 font-black">{row.invoice.invoiceNumber}<div className="mt-1 text-xs font-normal text-slate-500">{Number(row.invoice.metadata?.billingCount || 0)} قيد تكلفة</div></td><td className="p-3"><div className="font-black">{row.storeName}</div><div className="text-xs text-slate-500">{row.storeNumber || "-"} · {row.merchantName || row.merchantEmail || "-"}</div></td><td className="p-3 text-xs text-slate-600">{new Intl.DateTimeFormat("ar", { dateStyle: "short" }).format(new Date(row.invoice.periodStart))} — {new Intl.DateTimeFormat("ar", { dateStyle: "short" }).format(new Date(row.invoice.periodEnd))}</td><td className="p-3 font-black text-primary">{formatCurrency(row.invoice.totalAmount, row.invoice.currency)}</td><td className="p-3 text-xs text-slate-600">{row.invoice.dueAt ? new Intl.DateTimeFormat("ar", { dateStyle: "short" }).format(new Date(row.invoice.dueAt)) : "-"}</td><td className="p-3"><Badge variant={badge(row.invoice.status)}>{row.invoice.status}</Badge></td><td className="p-3">{["issued", "pending", "payment_submitted"].includes(row.invoice.status) ? <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => setTarget({ invoice: row.invoice, action: "mark_paid" })}>تأكيد سداد</Button><Button size="sm" variant="destructive" onClick={() => setTarget({ invoice: row.invoice, action: "void" })}>إلغاء الفاتورة</Button></div> : <span className="text-xs font-bold text-slate-400">لا يوجد إجراء متاح</span>}</td></tr>)}</tbody></table></div>
    <ActionConfirmationDialog open={Boolean(target)} title={target?.action === "mark_paid" ? "تأكيد تسوية فاتورة إعلان" : "إلغاء فاتورة إعلان"} description={target?.action === "mark_paid" ? "لن يتم تنفيذ تحصيل خارجي؛ هذا يسجل فقط تأكيداً تشغيلياً من الموظف ويحوّل قيود الفاتورة إلى paid." : "سيتم وسم الفاتورة وقيودها void مع الاحتفاظ بالسجل الكامل؛ لا يُحذف أي قيد."} actionLabel={target?.action === "mark_paid" ? "تأكيد السداد" : "إلغاء الفاتورة"} destructive={target?.action === "void"} reasonRequired auditContext={`ad_invoice:${target?.invoice.invoiceNumber || ""}`} loading={loading} error={error} onClose={() => { if (!loading) { setTarget(null); setError(null); } }} onConfirm={({ reason }) => settle(reason)} />
  </>;
}
