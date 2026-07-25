import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { SimpleBarChart } from "@/components/reports/simple-bar-chart";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAuth } from "@/lib/auth";
import { db, orders, products, productVariants } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { getFunnelSummary } from "@/lib/analytics/funnel";

export default async function MerchantReportsPage() {
  const session = await requireAuth();
  const store = await getMerchantPrimaryStore(session.userId);
  const data = store
    ? await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(products).where(eq(products.storeId, store.id)),
        db.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.storeId, store.id)),
        db.select({ total: sql<string>`coalesce(sum(${orders.grandTotal}), 0)::text` }).from(orders).where(eq(orders.storeId, store.id)),
        db.select({ low: sql<number>`count(*)::int` }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).where(sql`${products.storeId} = ${store.id} and ${productVariants.stockQuantity} <= ${productVariants.lowStockThreshold}`),
        db.select({ label: sql<string>`to_char(date_trunc('month', ${orders.createdAt}), 'YYYY-MM')`, value: sql<number>`count(*)::int` }).from(orders).where(eq(orders.storeId, store.id)).groupBy(sql`date_trunc('month', ${orders.createdAt})`).orderBy(sql`date_trunc('month', ${orders.createdAt})`).limit(12),
        db.select({ label: sql<string>`to_char(date_trunc('month', ${orders.createdAt}), 'YYYY-MM')`, value: sql<number>`coalesce(sum(${orders.grandTotal}), 0)::int` }).from(orders).where(eq(orders.storeId, store.id)).groupBy(sql`date_trunc('month', ${orders.createdAt})`).orderBy(sql`date_trunc('month', ${orders.createdAt})`).limit(12)
      ])
    : null;
  const funnel = store ? await getFunnelSummary({ storeId: store.id, days: 30 }) : null;

  return (
    <main className="min-h-screen merchant-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div><h1 className="text-3xl font-black text-slate-950">التقارير</h1><p className="mt-2 text-sm text-slate-500">ملخص سريع ورسوم بيانية للمبيعات والطلبات والمخزون.</p></div>
          <Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button>
        </div>
        {!store || !data ? <EmptyState title="لا يوجد متجر" /> : <>
          <div className="grid gap-4 md:grid-cols-4"><Stat title="المنتجات" value={formatNumber(data[0][0]?.count || 0)} /><Stat title="الطلبات" value={formatNumber(data[1][0]?.count || 0)} /><Stat title="إجمالي المبيعات" value={formatCurrency(data[2][0]?.total || 0)} /><Stat title="قرب النفاد" value={formatNumber(data[3][0]?.low || 0)} /></div>
          {funnel ? <section className="mt-8 rounded-3xl border bg-white p-6 shadow-card"><h2 className="text-xl font-black">رحلة شراء عملاء متجرك — 30 يومًا</h2><div className="mt-4 grid gap-3 md:grid-cols-6"><Stat title="مشاهدات" value={formatNumber(funnel.counts.productViews)} /><Stat title="نقر توصيات" value={formatNumber(funnel.counts.recommendationClicks)} /><Stat title="سلة" value={formatNumber(funnel.counts.addToCart)} /><Stat title="بدء الدفع" value={formatNumber(funnel.counts.checkoutStarted)} /><Stat title="طلبات" value={formatNumber(funnel.counts.ordersCreated)} /><Stat title="تم التسليم" value={formatNumber(funnel.counts.ordersDelivered)} /></div><p className="mt-4 text-sm font-bold text-slate-500">نقر التوصيات: {formatNumber(funnel.rates.recommendationClickRate)}% · تحويل مشاهدة ← سلة: {formatNumber(funnel.rates.viewToCart)}% · دفع ← طلب: {formatNumber(funnel.rates.checkoutToOrder)}%</p></section> : null}
          <div className="mt-8 grid gap-8 xl:grid-cols-2"><div><h2 className="mb-4 text-xl font-black">الطلبات الشهرية</h2><SimpleBarChart data={data[4].map((x) => ({ label: x.label, value: Number(x.value) }))} /></div><div><h2 className="mb-4 text-xl font-black">المبيعات الشهرية</h2><SimpleBarChart data={data[5].map((x) => ({ label: x.label, value: Number(x.value) }))} /></div></div>
        </>}
      </section>
    </main>
  );
}
function Stat({ title, value }: { title: string; value: string }) { return <Card><CardHeader><CardTitle className="text-sm text-slate-500">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-slate-950">{value}</div></CardContent></Card>; }
