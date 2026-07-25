export const dynamic = "force-dynamic";
export const revalidate = 0;

import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getOrderDetails } from "@/lib/order-details";
import { formatCurrency } from "@/lib/utils";

export default async function OrderInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth();
  const data = await getOrderDetails(id, session);
  if (!data) notFound();
  const { order, invoice, store, customer, items } = data;
  return (
    <main className="min-h-screen bg-white p-6 text-slate-950 print:p-0">
      <section className="mx-auto max-w-5xl rounded-3xl border bg-white p-8 shadow-card print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b pb-6">
          <div><h1 className="text-3xl font-black">فاتورة طلب</h1><p className="mt-2 text-sm text-slate-500">مرجع رسمي للمنتجات والمواصفات وقت الشراء</p></div>
          <div className="text-left"><p className="font-black">{invoice?.invoiceNumber || order.orderNumber}</p><p className="text-sm text-slate-500">{new Intl.DateTimeFormat("ar", { dateStyle: "full", timeStyle: "short" }).format(invoice?.invoiceDate || order.createdAt)}</p></div>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2"><Box title="البائع" lines={[store.name, `رقم المتجر: ${store.storeNumber}`, store.contactPhone ? `جوال: ${store.contactPhone}` : ""]} /><Box title="العميل" lines={[customer.fullName, customer.email, customer.phone || ""]} /></div>
        <div className="mt-8 overflow-x-auto"><table className="w-full min-w-[900px] text-right text-sm"><thead className="bg-slate-100"><tr><th className="p-3">#</th><th className="p-3">المنتج</th><th className="p-3">SKU/الكود</th><th className="p-3">المواصفات</th><th className="p-3">الكمية</th><th className="p-3">السعر</th><th className="p-3">الإجمالي</th></tr></thead><tbody className="divide-y">{items.map((item, index) => { const snap = item.productSnapshot as Record<string, any>; return <tr key={item.id}><td className="p-3">{index + 1}</td><td className="p-3 font-black">{item.productName}<p className="text-xs font-normal text-slate-500">{item.variantTitle || "افتراضي"}</p></td><td className="p-3">{item.sku || snap?.sku || "-"}<p className="text-xs text-slate-500">{item.productCode || snap?.productCode || "-"}</p></td><td className="p-3 text-xs">{Object.entries(snap?.attributes || {}).map(([k, v]) => `${k}: ${v}`).join("، ") || "-"}</td><td className="p-3">{item.quantity}</td><td className="p-3">{formatCurrency(item.unitPrice, order.currency)}</td><td className="p-3 font-black">{formatCurrency(item.totalPrice, order.currency)}</td></tr>})}</tbody></table></div>
        <div className="mr-auto mt-8 max-w-sm space-y-2"><Line label="المجموع" value={formatCurrency(order.subtotal, order.currency)} /><Line label="الشحن" value={formatCurrency(order.shippingFee, order.currency)} /><Line label="الإجمالي" value={formatCurrency(order.grandTotal, order.currency)} strong /></div>
        <p className="mt-8 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">هذه الفاتورة تحفظ مواصفات المنتج وقت الطلب، وتشمل اللون/المقاس/SKU والكود لتقليل أي خلاف بين العميل والتاجر.</p>
      </section>
    </main>
  );
}

function Box({ title, lines }: { title: string; lines: string[] }) { return <div className="rounded-2xl bg-slate-50 p-4"><p className="mb-2 font-black">{title}</p>{lines.filter(Boolean).map((line) => <p key={line} className="text-sm text-slate-600">{line}</p>)}</div>; }
function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="flex justify-between rounded-xl bg-slate-50 p-3"><span className="font-bold text-slate-500">{label}</span><span className={strong ? "text-xl font-black text-primary" : "font-black"}>{value}</span></div>; }
