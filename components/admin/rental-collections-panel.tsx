"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatNumber } from "@/lib/utils";

type Proof = { url?: string; paymentReference?: string | null; note?: string | null };

function paymentProof(invoice: any): Proof | null {
  const value = invoice?.metadata?.paymentProof;
  return value && typeof value === "object" ? value as Proof : null;
}

function statusVariant(status: string) {
  if (status === "overdue") return "danger";
  if (status === "payment_submitted") return "warning";
  return "warning";
}

export function RentalCollectionsPanel({ agreements, invoices, addons, outstandingTotal }: { agreements: any[]; invoices: any[]; addons: any[]; outstandingTotal: number }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function updateInvoice(id: string, action: "mark_paid" | "approve_proof" | "reject_proof", input: { paymentReference?: string | null; reviewNote?: string | null } = {}) {
    setLoading(`${action}:${id}`);
    const response = await fetch(`/api/admin/rentals/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...input })
    });
    const json = await response.json().catch(() => ({}));
    setLoading(null);
    setMessage(response.ok ? `✓ ${json.data?.message || "تم تحديث الفاتورة"}` : json.message || "تعذر تحديث الفاتورة");
    if (response.ok) router.refresh();
  }

  async function markPaid(id: string) {
    const reference = window.prompt("رقم التحويل أو مرجع إثبات الدفع (اختياري):") || "";
    await updateInvoice(id, "mark_paid", { paymentReference: reference || null });
  }

  async function approveProof(id: string, proof: Proof | null) {
    const reference = window.prompt("مرجع السداد المعتمد:", proof?.paymentReference || "") ?? null;
    if (reference === null) return;
    const note = window.prompt("ملاحظة للمراجعة (اختيارية):") || null;
    await updateInvoice(id, "approve_proof", { paymentReference: reference || null, reviewNote: note });
  }

  async function rejectProof(id: string) {
    const note = window.prompt("سبب رفض الإثبات للتاجر:");
    if (!note?.trim()) {
      setMessage("سبب الرفض مطلوب حتى يتمكن التاجر من تصحيح الإثبات.");
      return;
    }
    await updateInvoice(id, "reject_proof", { reviewNote: note.trim() });
  }

  async function assignAddon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading("addon");
    const response = await fetch("/api/admin/rentals/addons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", agreementId: form.get("agreementId"), addonId: form.get("addonId"), quantity: Number(form.get("quantity") || 1) })
    });
    const json = await response.json().catch(() => ({}));
    setLoading(null);
    setMessage(response.ok ? "✓ تم تفعيل الإضافة وسيظهر أثرها في فاتورة الإيجار القادمة" : json.message || "تعذر تفعيل الإضافة");
    if (response.ok) { event.currentTarget.reset(); router.refresh(); }
  }

  return <div className="space-y-8">
    <section className="grid gap-4 md:grid-cols-3">
      <Metric title="اتفاقات الإيجار" value={formatNumber(agreements.length)} />
      <Metric title="فواتير معلقة/متأخرة/قيد مراجعة" value={formatNumber(invoices.length)} />
      <Metric title="المستحق للتحصيل" value={formatCurrency(outstandingTotal)} />
    </section>
    {message ? <p className="rounded-2xl border bg-white p-4 text-sm font-bold text-slate-700">{message}</p> : null}

    <section className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
      <div className="rounded-3xl border bg-white p-6 shadow-card">
        <h2 className="mb-4 text-xl font-black">فواتير الإيجار المفتوحة</h2>
        {invoices.length ? <div className="space-y-3">{invoices.map((row) => {
          const proof = paymentProof(row.invoice);
          const isProofReview = row.invoice.status === "payment_submitted";
          return <article key={row.invoice.id} className="rounded-2xl border bg-slate-50 p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <div className="flex flex-wrap gap-2"><b>{row.invoice.invoiceNumber}</b><Badge variant={statusVariant(row.invoice.status)}>{row.invoice.status}</Badge></div>
                <p className="mt-2 text-sm text-slate-600">{row.storeName} — {row.merchantName}</p>
                <p className="mt-1 font-black text-primary">{formatCurrency(row.invoice.totalAmount, row.invoice.currency)}</p>
                <p className="mt-1 text-xs text-slate-500">الاستحقاق: {row.invoice.dueAt ? new Intl.DateTimeFormat("ar").format(new Date(row.invoice.dueAt)) : "-"}</p>
                {proof?.paymentReference ? <p className="mt-1 text-xs font-bold text-slate-600">مرجع التاجر: {proof.paymentReference}</p> : null}
                {proof?.note ? <p className="mt-1 text-xs text-slate-600">ملاحظة: {proof.note}</p> : null}
                {proof?.url ? <a className="mt-2 inline-flex text-xs font-black text-primary underline" href={proof.url} target="_blank" rel="noreferrer">فتح إثبات السداد</a> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {isProofReview ? <>
                  <Button disabled={loading === `approve_proof:${row.invoice.id}`} onClick={() => approveProof(row.invoice.id, proof)}>{loading === `approve_proof:${row.invoice.id}` ? "..." : "اعتماد الإثبات"}</Button>
                  <Button variant="destructive" disabled={loading === `reject_proof:${row.invoice.id}`} onClick={() => rejectProof(row.invoice.id)}>{loading === `reject_proof:${row.invoice.id}` ? "..." : "رفض الإثبات"}</Button>
                </> : <Button disabled={loading === `mark_paid:${row.invoice.id}`} onClick={() => markPaid(row.invoice.id)}>{loading === `mark_paid:${row.invoice.id}` ? "..." : "تأكيد سداد يدوي"}</Button>}
              </div>
            </div>
          </article>;
        })}</div> : <p className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">لا توجد فواتير مفتوحة.</p>}
      </div>

      <div className="rounded-3xl border bg-white p-6 shadow-card">
        <h2 className="mb-4 text-xl font-black">تفعيل إضافة مدفوعة</h2>
        <form onSubmit={assignAddon} className="space-y-3">
          <div className="space-y-2"><Label>اتفاق المتجر</Label><select name="agreementId" required className="h-11 w-full rounded-xl border bg-white px-3 text-sm"><option value="">اختر المتجر</option>{agreements.map((row) => <option key={row.agreement.id} value={row.agreement.id}>{row.storeName} — {row.agreement.status}</option>)}</select></div>
          <div className="space-y-2"><Label>الإضافة</Label><select name="addonId" required className="h-11 w-full rounded-xl border bg-white px-3 text-sm"><option value="">اختر الإضافة</option>{addons.filter((addon) => addon.isActive).map((addon) => <option key={addon.id} value={addon.id}>{addon.name} — {formatCurrency(addon.price)} / {addon.billingCycle}</option>)}</select></div>
          <div className="space-y-2"><Label>الكمية</Label><Input name="quantity" type="number" min={1} defaultValue={1} /></div>
          <Button disabled={loading === "addon"}>{loading === "addon" ? "جارٍ التفعيل..." : "تفعيل الإضافة"}</Button>
        </form>
      </div>
    </section>

    <section className="rounded-3xl border bg-white p-6 shadow-card">
      <h2 className="mb-4 text-xl font-black">اتفاقات المتاجر</h2>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-right text-sm"><thead className="bg-slate-100"><tr><th className="p-3">المتجر</th><th className="p-3">التاجر</th><th className="p-3">الخطة</th><th className="p-3">الإيجار</th><th className="p-3">الدورة</th><th className="p-3">الحالة</th><th className="p-3">الفاتورة القادمة</th></tr></thead><tbody>{agreements.map((row) => <tr key={row.agreement.id} className="border-t"><td className="p-3 font-black">{row.storeName}<div className="text-xs text-slate-500">{row.storeNumber}</div></td><td className="p-3">{row.merchantName}<div className="text-xs text-slate-500">{row.merchantEmail}</div></td><td className="p-3">{row.plan?.name || "اتفاق مخصص"}</td><td className="p-3 font-black text-primary">{formatCurrency(row.agreement.baseRent, row.agreement.currency)}</td><td className="p-3">{row.agreement.billingCycle}</td><td className="p-3"><Badge variant={row.agreement.status === "active" ? "success" : row.agreement.status === "overdue" ? "danger" : "warning"}>{row.agreement.status}</Badge></td><td className="p-3">{row.agreement.nextInvoiceAt ? new Intl.DateTimeFormat("ar").format(new Date(row.agreement.nextInvoiceAt)) : "-"}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="rounded-3xl border bg-white p-5 shadow-card"><p className="text-sm font-bold text-slate-500">{title}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p></div>;
}
