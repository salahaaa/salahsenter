"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUrlInput } from "@/components/media/media-url-input";
import { formatCurrency } from "@/lib/utils";

type InvoiceRow = { invoice: any; storeName: string };

type Proof = {
  url?: string;
  status?: "submitted" | "approved" | "rejected";
  paymentReference?: string | null;
  note?: string | null;
  reviewNote?: string | null;
};

function paymentProof(invoice: any): Proof | null {
  const value = invoice?.metadata?.paymentProof;
  return value && typeof value === "object" ? value as Proof : null;
}

function invoiceBadge(status: string) {
  if (status === "paid") return "success";
  if (status === "overdue") return "danger";
  if (status === "payment_submitted") return "warning";
  return "warning";
}

function RentalPaymentProofForm({ invoice }: { invoice: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const proofUrl = String(data.get("proofUrl") || "");
    if (!proofUrl) {
      setMessage("ارفع صورة أو PDF للإيصال أولاً.");
      return;
    }

    setLoading(true);
    const response = await fetch(`/api/merchant/billing/invoices/${invoice.id}/proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proofUrl,
        paymentReference: String(data.get("paymentReference") || "") || null,
        note: String(data.get("note") || "") || null
      })
    });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? "✓ تم إرسال الإثبات للإدارة للمراجعة." : json.message || "تعذر إرسال إثبات السداد");
    if (response.ok) router.refresh();
  }

  return <form onSubmit={submit} className="mt-4 grid gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 md:grid-cols-2">
    <div className="md:col-span-2">
      <p className="text-sm font-black text-amber-950">رفع إثبات سداد الإيجار</p>
      <p className="mt-1 text-xs leading-6 text-amber-800">ارفع صورة الإيصال أو ملف PDF من الزر أدناه، ثم أرسلها للمراجعة. لا يثبت السداد إلا بعد اعتماد الإدارة.</p>
    </div>
    <div className="space-y-2">
      <Label>مرجع التحويل/السداد — اختياري</Label>
      <Input name="paymentReference" maxLength={180} placeholder="رقم الحوالة أو الإيصال" />
    </div>
    <div className="md:col-span-2">
      <MediaUrlInput label="إيصال السداد (صورة أو PDF)" name="proofUrl" folder={`rental-payment-proofs/${invoice.id}`} accept="image/*,application/pdf" required />
    </div>
    <div className="space-y-2 md:col-span-2">
      <Label>ملاحظة للإدارة — اختيارية</Label>
      <Textarea name="note" maxLength={1500} placeholder="أي توضيح متعلق بالسداد" />
    </div>
    <div className="flex flex-wrap items-center gap-3 md:col-span-2">
      <Button disabled={loading}>{loading ? "جارٍ الإرسال..." : "إرسال الإثبات للمراجعة"}</Button>
      {message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}
    </div>
  </form>;
}

export function RentalBillingPanel({ agreements, invoices, addons }: { agreements: any[]; invoices: InvoiceRow[]; addons: any[] }) {
  const openInvoices = invoices.filter((row) => ["issued", "pending", "overdue", "payment_submitted"].includes(row.invoice.status));
  return <div className="space-y-6">
    <section className="grid gap-4 md:grid-cols-3">
      <Metric title="اتفاقات الإيجار" value={String(agreements.length)} />
      <Metric title="فواتير مفتوحة" value={String(openInvoices.length)} />
      <Metric title="إضافات مفعلة" value={String(addons.filter((row) => row.assignment.status === "active").length)} />
    </section>

    <section className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl border bg-white p-6 shadow-card">
        <h2 className="mb-4 text-xl font-black">اتفاقات متاجرك</h2>
        {agreements.length ? <div className="space-y-3">{agreements.map((row) => <article key={row.agreement.id} className="rounded-2xl border bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3"><h3 className="font-black">{row.storeName}</h3><Badge variant={row.agreement.status === "active" ? "success" : row.agreement.status === "overdue" ? "danger" : "warning"}>{row.agreement.status}</Badge></div>
          <p className="mt-2 text-sm text-slate-600">الخطة: {row.plan?.name || "اتفاق مخصص"}</p>
          <p className="mt-1 font-black text-primary">{formatCurrency(row.agreement.baseRent, row.agreement.currency)} / {row.agreement.billingCycle}</p>
          <p className="mt-1 text-xs text-slate-500">الفاتورة القادمة: {row.agreement.nextInvoiceAt ? new Intl.DateTimeFormat("ar").format(new Date(row.agreement.nextInvoiceAt)) : "تحددها الإدارة"}</p>
        </article>)}</div> : <p className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">لا يوجد اتفاق إيجار ظاهر حتى الآن. راجع الإدارة إذا تم اعتماد متجرك حديثًا.</p>}
      </div>

      <div className="rounded-3xl border bg-white p-6 shadow-card">
        <h2 className="mb-4 text-xl font-black">فواتير الإيجار وإثباتات السداد</h2>
        {invoices.length ? <div className="space-y-3">{invoices.map((row) => {
          const proof = paymentProof(row.invoice);
          const canSubmit = ["issued", "pending", "overdue"].includes(row.invoice.status);
          return <article key={row.invoice.id} className="rounded-2xl border bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><b>{row.invoice.invoiceNumber}</b><Badge variant={invoiceBadge(row.invoice.status)}>{row.invoice.status}</Badge></div>
            <p className="mt-2 text-sm text-slate-600">{row.storeName}</p>
            <p className="mt-1 font-black text-primary">{formatCurrency(row.invoice.totalAmount, row.invoice.currency)}</p>
            <p className="mt-1 text-xs text-slate-500">الاستحقاق: {row.invoice.dueAt ? new Intl.DateTimeFormat("ar").format(new Date(row.invoice.dueAt)) : "-"}</p>
            {proof?.paymentReference ? <p className="mt-2 text-xs font-bold text-slate-600">مرجع السداد: {proof.paymentReference}</p> : null}
            {proof?.url ? <a className="mt-2 inline-flex text-xs font-black text-primary underline" href={proof.url} target="_blank" rel="noreferrer">عرض الإثبات المرفوع</a> : null}
            {row.invoice.status === "payment_submitted" ? <p className="mt-3 rounded-xl bg-blue-50 p-2 text-xs font-bold text-blue-800">تم إرسال الإثبات وهو الآن قيد مراجعة الإدارة.</p> : null}
            {proof?.status === "rejected" ? <p className="mt-3 rounded-xl bg-red-50 p-2 text-xs font-bold text-red-800">لم يُعتمد الإثبات: {proof.reviewNote || "يرجى رفع إثبات أوضح."}</p> : null}
            {canSubmit ? <RentalPaymentProofForm invoice={row.invoice} /> : null}
          </article>;
        })}</div> : <p className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">لا توجد فواتير إيجار.</p>}
      </div>
    </section>

    <section className="rounded-3xl border bg-white p-6 shadow-card">
      <h2 className="mb-4 text-xl font-black">الإضافات المفعلة</h2>
      {addons.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{addons.map((row) => <div key={row.assignment.id} className="rounded-2xl bg-slate-50 p-4"><p className="font-black">{row.addon.name}</p><p className="mt-1 text-sm text-slate-500">{row.addon.entitlementKey}</p><p className="mt-2 font-black text-primary">{formatCurrency(Number(row.assignment.unitPrice) * Number(row.assignment.quantity))} / {row.addon.billingCycle}</p></div>)}</div> : <p className="text-sm font-bold text-slate-500">لا توجد إضافات مدفوعة مفعلة.</p>}
    </section>
  </div>;
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="rounded-3xl border bg-white p-5 shadow-card"><p className="text-sm font-bold text-slate-500">{title}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p></div>;
}
