export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { CheckCircle2, CircleAlert, CreditCard, PackageCheck, Store } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { requireAuth } from "@/lib/auth";
import { db, orderPayments, orders, paymentMethods, stores } from "@/lib/db";
import { orderStatusLabels } from "@/lib/order-details";

function orderIds(value: string | undefined) {
  return String(value || "").split(",").map((id) => id.trim()).filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 20);
}

export default async function CheckoutResultPage({ searchParams }: { searchParams: Promise<{ orders?: string; failed?: string }> }) {
  const session = await requireAuth();
  const params = await searchParams;
  const ids = orderIds(params.orders);
  const rows = ids.length
    ? await db
      .select({ order: orders, store: stores, payment: orderPayments, method: paymentMethods })
      .from(orders)
      .innerJoin(stores, eq(orders.storeId, stores.id))
      .leftJoin(orderPayments, eq(orderPayments.orderId, orders.id))
      .leftJoin(paymentMethods, eq(orderPayments.paymentMethodId, paymentMethods.id))
      .where(and(inArray(orders.id, ids), eq(orders.customerId, session.userId)))
    : [];
  const failed = params.failed ? String(params.failed).slice(0, 300) : null;
  const pendingPaymentCount = rows.filter((row) => row.order.paymentStatus !== "paid").length;

  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      <section className="container max-w-4xl py-10">
        <div className="rounded-[2rem] border bg-white p-8 shadow-card">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className={`mb-4 inline-flex rounded-2xl p-3 ${failed ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{failed ? <CircleAlert className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}</div>
              <h1 className="text-3xl font-black text-slate-950">{failed ? "تم إنشاء جزء من طلباتك" : "تم إنشاء طلباتك بنجاح"}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{failed ? `تم حفظ الطلبات الظاهرة أدناه، لكن تعذر إكمال طلب متجر آخر: ${failed}` : "تم فصل الشراء حسب المتجر لضمان شحن ومتابعة ودفع مستقل لكل طلب."}</p>
            </div>
            <Button asChild variant="outline"><Link href="/orders">كل طلباتي</Link></Button>
          </div>

          {pendingPaymentCount ? <div className="mt-6 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-7 text-blue-900"><CreditCard className="mt-0.5 h-5 w-5 shrink-0" /><p>لديك {pendingPaymentCount} طلب غير مدفوع. اختر «إتمام الدفع» أمام كل متجر؛ لا تجمع المنصة مدفوعات المتاجر في عملية واحدة.</p></div> : null}

          {rows.length ? <div className="mt-8 space-y-3">{rows.map(({ order, store, payment, method }) => {
            const isPaid = order.paymentStatus === "paid";
            return <article key={order.id} className="flex flex-col justify-between gap-4 rounded-2xl border bg-slate-50 p-5 md:flex-row md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2"><h2 className="font-black text-slate-950">{order.orderNumber}</h2><Badge variant={isPaid ? "success" : "warning"}>{isPaid ? "تم الدفع" : "بانتظار الدفع"}</Badge><Badge variant="outline">{orderStatusLabels[order.statusCode] || order.statusCode}</Badge></div>
                <p className="mt-2 text-sm text-slate-600"><Store className="ml-1 inline h-4 w-4" />{store.name} · الإجمالي {formatCurrency(order.grandTotal, order.currency)}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">وسيلة الدفع: {method?.name || "غير محددة"}{payment?.status === "pending" ? " — أكمل الدفع أو اتبع تعليمات المتجر." : ""}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!isPaid ? <Button asChild size="sm"><Link href={`/checkout/payment/${order.id}`}><CreditCard className="h-4 w-4" /> إتمام الدفع</Link></Button> : null}
                <Button asChild size="sm" variant="outline"><Link href={`/orders/${order.id}`}><PackageCheck className="h-4 w-4" /> تفاصيل الطلب</Link></Button>
                <Button asChild size="sm" variant="outline"><Link href={`/track-order?order=${encodeURIComponent(order.orderNumber)}`}>تتبع</Link></Button>
              </div>
            </article>;
          })}</div> : <p className="mt-8 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">لم يتم العثور على طلبات مرتبطة بهذا الحساب. راجع صفحة طلباتي أو أعد المحاولة.</p>}
          <div className="mt-8 flex flex-wrap gap-3"><Button asChild><Link href="/orders">متابعة طلباتي</Link></Button><Button asChild variant="outline"><Link href="/">العودة للتسوق</Link></Button></div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
