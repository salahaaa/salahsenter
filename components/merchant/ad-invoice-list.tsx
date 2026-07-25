import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

type Invoice = { id: string; invoiceNumber: string; totalAmount: string | number; currency: string; status: string; dueAt: Date | string | null; periodStart: Date | string; periodEnd: Date | string };

function badge(status: string) {
  if (status === "paid") return "success" as const;
  if (status === "void") return "outline" as const;
  return status === "overdue" ? "danger" as const : "warning" as const;
}

/** Merchant-visible invoice history. Collection remains intentionally manual until a vetted provider is connected. */
export function AdInvoiceList({ invoices }: { invoices: Invoice[] }) {
  if (!invoices.length) return <section className="mt-8 rounded-3xl border border-dashed bg-white p-6 text-sm font-bold text-slate-500">لا توجد فواتير إعلان صادرة بعد. تصدر رسوم اليوم السابق من دفتر الإعلانات، ولا تعني هذه الشاشة أنه تم تحصيل مبلغ تلقائياً.</section>;
  return <section className="mt-8 rounded-3xl border bg-white p-6 shadow-card"><div className="mb-4"><h2 className="text-xl font-black text-slate-950">فواتير الإعلانات</h2><p className="mt-1 text-xs font-bold leading-6 text-slate-500">اعرض تكلفة الحملات الصادرة. عند تفعيل مزود تحصيل معتمد ستظهر طريقة السداد وإثباته هنا.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="bg-slate-100"><tr><th className="p-3">الرقم</th><th className="p-3">الفترة</th><th className="p-3">المبلغ</th><th className="p-3">الاستحقاق</th><th className="p-3">الحالة</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id} className="border-t"><td className="p-3 font-black">{invoice.invoiceNumber}</td><td className="p-3 text-xs text-slate-600">{new Intl.DateTimeFormat("ar", { dateStyle: "short" }).format(new Date(invoice.periodStart))} — {new Intl.DateTimeFormat("ar", { dateStyle: "short" }).format(new Date(invoice.periodEnd))}</td><td className="p-3 font-black text-primary">{formatCurrency(invoice.totalAmount, invoice.currency)}</td><td className="p-3 text-xs text-slate-600">{invoice.dueAt ? new Intl.DateTimeFormat("ar", { dateStyle: "short" }).format(new Date(invoice.dueAt)) : "-"}</td><td className="p-3"><Badge variant={badge(invoice.status)}>{invoice.status}</Badge></td></tr>)}</tbody></table></div></section>;
}
