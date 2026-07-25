import Link from "next/link";
import { CalendarDays, CreditCard, FileText, PackageCheck, ShieldCheck, Store, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HelpCard } from "@/components/ui/help-card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { canOpenDispute, orderStatusLabels } from "@/lib/order-details";
import { DisputeForm } from "@/components/orders/dispute-form";
import { ReturnRequestForm } from "@/components/orders/return-request-form";
import { ReturnRequestActions } from "@/components/merchant/return-request-actions";
import { PaymentReceiptActions } from "@/components/merchant/payment-receipt-actions";

type OrderDetails = NonNullable<Awaited<ReturnType<typeof import("@/lib/order-details").getOrderDetails>>>;

export function OrderDetailView({ data, viewer }: { data: OrderDetails; viewer: "customer" | "merchant" | "admin" }) {
  const { order, store, customer, items, invoice, payments, shipments, paymentReceipts, history, disputes, disputeMessages, returns } = data;
  const isCustomer = viewer === "customer";
  return (
    <div className="space-y-6">
      <HelpCard title="كيف تقرأ هذه الصفحة؟">
        <p><b>الفاتورة:</b> هي المرجع الرسمي بين العميل والتاجر، وتحتوي على رقم الصنف و SKU واللون والمقاس والمواصفات المحفوظة وقت الطلب.</p>
        <p><b>سجل الحالات:</b> يوضح كل مرحلة مر بها الطلب ومن قام بتحديثها.</p>
        <p><b>النزاع:</b> يظهر للعميل بعد التسليم إذا كان المنتج المستلم مختلفاً عن الفاتورة.</p>
      </HelpCard>

      <section className="grid gap-4 md:grid-cols-4">
        <Info title="رقم الطلب" value={order.orderNumber} icon={<PackageCheck className="h-5 w-5" />} />
        <Info title="رقم الفاتورة" value={invoice?.invoiceNumber || "-"} icon={<FileText className="h-5 w-5" />} />
        <Info title="الحالة" value={orderStatusLabels[order.statusCode] || order.statusCode} icon={<ShieldCheck className="h-5 w-5" />} />
        <Info title="الإجمالي" value={formatCurrency(order.grandTotal, order.currency)} icon={<CalendarDays className="h-5 w-5" />} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border bg-white p-5 shadow-card">
          <h2 className="mb-4 flex items-center gap-2 font-black text-slate-950"><Store className="h-5 w-5 text-blue-600" /> بيانات المتجر</h2>
          <p className="font-black">{store.name}</p>
          <p className="mt-1 text-sm text-slate-500">رقم المتجر: {store.storeNumber}</p>
          {store.contactPhone ? <p className="mt-1 text-sm text-slate-500">جوال: {store.contactPhone}</p> : null}
        </div>
        <div className="rounded-3xl border bg-white p-5 shadow-card">
          <h2 className="mb-4 flex items-center gap-2 font-black text-slate-950"><UserRound className="h-5 w-5 text-blue-600" /> بيانات العميل</h2>
          <p className="font-black">{customer.fullName}</p>
          <p className="mt-1 text-sm text-slate-500">{customer.email}</p>
          {customer.phone ? <p className="mt-1 text-sm text-slate-500">{customer.phone}</p> : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-card">
        <div className="border-b p-5"><h2 className="text-xl font-black text-slate-950">الفاتورة التفصيلية للمنتجات</h2><p className="mt-1 text-sm text-slate-500">هذه البيانات محفوظة وقت الطلب حتى لا يحدث خلاف إذا تغير المنتج لاحقاً.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-right text-sm">
            <thead className="bg-slate-100"><tr><th className="p-4">الصورة</th><th className="p-4">المنتج</th><th className="p-4">SKU / الكود</th><th className="p-4">المواصفات المطلوبة</th><th className="p-4">الكمية</th><th className="p-4">سعر الوحدة</th><th className="p-4">الإجمالي</th></tr></thead>
            <tbody className="divide-y">
              {items.map((item) => {
                const snapshot = (item.productSnapshot || {}) as Record<string, any>;
                const attributes = snapshot.attributes || {};
                const specs = snapshot.specifications || {};
                return <tr key={item.id}><td className="p-4">{item.imageUrl ? <img src={item.imageUrl} alt={item.productName} className="h-16 w-16 rounded-2xl object-cover" /> : <div className="h-16 w-16 rounded-2xl bg-slate-100" />}</td><td className="p-4"><p className="font-black text-slate-950">{item.productName}</p><p className="text-xs text-slate-500">{item.variantTitle || "افتراضي"}</p></td><td className="p-4"><p className="font-bold">SKU: {item.sku || snapshot.sku || "-"}</p><p className="text-xs text-slate-500">كود: {item.productCode || snapshot.productCode || "-"}</p></td><td className="p-4"><div className="flex flex-wrap gap-1">{Object.entries(attributes).map(([key, value]) => <Badge key={key} variant="outline">{key}: {String(value)}</Badge>)}{Object.entries(specs).slice(0, 4).map(([key, value]) => <Badge key={key} variant="secondary">{key}: {String(value)}</Badge>)}</div></td><td className="p-4 font-black">{formatNumber(item.quantity)}</td><td className="p-4">{formatCurrency(item.unitPrice, order.currency)}</td><td className="p-4 font-black text-primary">{formatCurrency(item.totalPrice, order.currency)}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 border-t bg-slate-50 p-5 md:grid-cols-3"><InfoLine label="المجموع" value={formatCurrency(order.subtotal, order.currency)} /><InfoLine label="الشحن" value={formatCurrency(order.shippingFee, order.currency)} /><InfoLine label="الإجمالي النهائي" value={formatCurrency(order.grandTotal, order.currency)} /></div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border bg-white p-5 shadow-card"><h2 className="mb-4 text-xl font-black">سجل حالات الطلب</h2>{history.length ? <div className="space-y-3">{history.map((event) => <div key={event.id} className="rounded-2xl bg-slate-50 p-3"><p className="font-black">{orderStatusLabels[event.fromStatus || ""] || "بداية"} ← {orderStatusLabels[event.toStatus] || event.toStatus}</p><p className="mt-1 text-xs text-slate-500">{event.note || "-"} — {new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "short" }).format(event.createdAt)}</p></div>)}</div> : <p className="text-sm text-slate-400">لا يوجد سجل بعد</p>}</div>
        <div className="rounded-3xl border bg-white p-5 shadow-card">
          <h2 className="mb-4 text-xl font-black">الدفع والشحن والنزاعات</h2>
          <div className="space-y-2 text-sm text-slate-600"><p>حالة الدفع: <b>{order.paymentStatus}</b></p><p>عمليات الدفع: <b>{payments.length}</b></p><p>إثباتات الدفع: <b>{paymentReceipts.length}</b></p><p>الشحنات: <b>{shipments.length}</b></p><p>النزاعات: <b>{disputes.length}</b></p><p>طلبات الإرجاع: <b>{returns.length}</b></p></div>
          {isCustomer && order.paymentStatus !== "paid" ? <div className="mt-4"><Button asChild className="w-full"><Link href={`/checkout/payment/${order.id}`}><CreditCard className="h-4 w-4" /> إتمام الدفع لهذا الطلب</Link></Button></div> : null}
          {paymentReceipts.length ? <div className="mt-5 space-y-2">{paymentReceipts.map((receipt) => <div key={receipt.id} className="rounded-2xl bg-slate-50 p-3"><p className="font-black">إثبات دفع: {receipt.status}</p><p className="text-xs text-slate-500">{receipt.provider} — {receipt.transactionReference || "بدون رقم"}</p>{receipt.proofUrl ? <a className="text-xs font-bold text-blue-600" href={receipt.proofUrl} target="_blank">عرض الإيصال</a> : null}{viewer !== "customer" ? <div className="mt-2"><PaymentReceiptActions receiptId={receipt.id} status={receipt.status} /></div> : null}</div>)}</div> : null}
          {isCustomer && canOpenDispute(order.statusCode) && !disputes.length ? <div className="mt-5"><DisputeForm orderId={order.id} /></div> : null}
          {isCustomer && canOpenDispute(order.statusCode) && !returns.length ? <div className="mt-5"><ReturnRequestForm orderId={order.id} items={items.map((item) => ({ id: item.id, productName: item.productName, quantity: item.quantity }))} /></div> : null}
          {returns.length ? <div className="mt-5 rounded-2xl bg-blue-50 p-4"><p className="font-black text-blue-900">طلب إرجاع: {returns[0].reason} — {returns[0].status}</p><p className="mt-1 text-sm text-blue-700">{returns[0].description}</p>{viewer !== "customer" ? <div className="mt-3"><ReturnRequestActions returnRequestId={returns[0].id} status={returns[0].status} refundAmount={returns[0].refundAmount} /></div> : null}</div> : null}
          {disputes.length ? <div className="mt-5 rounded-2xl bg-amber-50 p-4"><p className="font-black text-amber-900">نزاع مفتوح: {disputes[0].reason}</p><p className="mt-1 text-sm text-amber-700">{disputes[0].description}</p>{disputeMessages.length ? <p className="mt-2 text-xs text-amber-700">عدد الرسائل: {disputeMessages.length}</p> : null}</div> : null}
        </div>
      </section>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button asChild><Link href={`/orders/${order.id}/invoice`}>طباعة / عرض الفاتورة</Link></Button>
        {viewer !== "customer" ? <Button asChild variant="outline"><Link href={`/merchant/orders/${order.id}`}>تفاصيل التاجر</Link></Button> : null}
      </div>
    </div>
  );
}

function Info({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) { return <div className="rounded-3xl border bg-white p-5 shadow-card"><div className="mb-2 flex items-center justify-between text-slate-500"><span className="text-sm font-bold">{title}</span>{icon}</div><p className="text-xl font-black text-slate-950">{value}</p></div>; }
function InfoLine({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-white p-4"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 font-black text-slate-950">{value}</p></div>; }
