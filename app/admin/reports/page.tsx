import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { SimpleBarChart } from "@/components/reports/simple-bar-chart";
import { ScheduledReportsPanel } from "@/components/finance/scheduled-reports-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db, orders, products, scheduledReportDeliveries, scheduledReports, stores, users } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { getFunnelSummary } from "@/lib/analytics/funnel";

export default async function AdminReportsPage() {
  const session = await requireAuth();
  await assertAdmin(session, "reports.view");
  const [metrics, monthlyOrders, monthlySales, topStores, topProducts] = hasDatabase()
    ? await Promise.all([
        Promise.all([
          db.select({ count: sql<number>`count(*)::int` }).from(users),
          db.select({ count: sql<number>`count(*)::int` }).from(stores),
          db.select({ count: sql<number>`count(*)::int` }).from(products),
          db.select({ total: sql<string>`coalesce(sum(${orders.grandTotal}), 0)::text` }).from(orders)
        ]),
        db.select({ label: sql<string>`to_char(date_trunc('month', ${orders.createdAt}), 'YYYY-MM')`, value: sql<number>`count(*)::int` }).from(orders).groupBy(sql`date_trunc('month', ${orders.createdAt})`).orderBy(sql`date_trunc('month', ${orders.createdAt})`).limit(12),
        db.select({ label: sql<string>`to_char(date_trunc('month', ${orders.createdAt}), 'YYYY-MM')`, value: sql<number>`coalesce(sum(${orders.grandTotal}), 0)::int` }).from(orders).groupBy(sql`date_trunc('month', ${orders.createdAt})`).orderBy(sql`date_trunc('month', ${orders.createdAt})`).limit(12),
        db.select({ name: stores.name, sales: stores.salesTotal, orders: stores.orderCount, rating: stores.ratingAverage }).from(stores).orderBy(desc(stores.salesTotal), desc(stores.orderCount)).limit(8),
        db.select({ name: products.name, sold: products.soldCount, rating: products.ratingAverage, storeName: stores.name }).from(products).leftJoin(stores, eq(products.storeId, stores.id)).orderBy(desc(products.soldCount), desc(products.ratingAverage)).limit(8)
      ])
    : [[[{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [{ total: "0" }]], [], [], [], []];
  const funnel = hasDatabase() ? await getFunnelSummary({ days: 30 }) : { counts: { productViews: 0, addToCart: 0, checkoutStarted: 0, ordersCreated: 0, ordersDelivered: 0, recommendationClicks: 0 }, rates: { viewToCart: 0, cartToCheckout: 0, checkoutToOrder: 0, orderToDelivered: 0, recommendationClickRate: 0 } };
  const [scheduledReportsRows, scheduledDeliveries] = hasDatabase() ? await Promise.all([db.select().from(scheduledReports).orderBy(desc(scheduledReports.createdAt)).limit(100), db.select().from(scheduledReportDeliveries).orderBy(desc(scheduledReportDeliveries.createdAt)).limit(200)]) : [[], []];

  return <main className="min-h-screen admin-aurora"><SiteHeader /><section className="container py-8"><div className="mb-8 flex items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">التقارير العامة</h1><p className="mt-2 text-sm text-slate-500">رسوم بيانية ومؤشرات أداء للمنصة كاملة.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/api/admin/reports/export">تصدير CSV</Link></Button><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div></div><div className="grid gap-4 md:grid-cols-4"><Stat title="المستخدمون" value={formatNumber(metrics[0][0]?.count || 0)} /><Stat title="المتاجر" value={formatNumber(metrics[1][0]?.count || 0)} /><Stat title="المنتجات" value={formatNumber(metrics[2][0]?.count || 0)} /><Stat title="إجمالي المبيعات" value={formatCurrency(metrics[3][0]?.total || 0)} /></div><section className="mt-8 rounded-3xl border bg-white p-6 shadow-card"><h2 className="text-xl font-black">رحلة الطلب خلال 30 يومًا</h2><div className="mt-4 grid gap-3 md:grid-cols-6"><Stat title="مشاهدات المنتج" value={formatNumber(funnel.counts.productViews)} /><Stat title="نقر توصيات" value={formatNumber(funnel.counts.recommendationClicks)} /><Stat title="إضافة للسلة" value={formatNumber(funnel.counts.addToCart)} /><Stat title="بدء الدفع" value={formatNumber(funnel.counts.checkoutStarted)} /><Stat title="طلبات منشأة" value={formatNumber(funnel.counts.ordersCreated)} /><Stat title="طلبات مسلمة" value={formatNumber(funnel.counts.ordersDelivered)} /></div><p className="mt-4 text-sm font-bold text-slate-500">نقر التوصيات: {formatNumber(funnel.rates.recommendationClickRate)}% · تحويل مشاهدة ← سلة: {formatNumber(funnel.rates.viewToCart)}% · سلة ← دفع: {formatNumber(funnel.rates.cartToCheckout)}% · دفع ← طلب: {formatNumber(funnel.rates.checkoutToOrder)}%</p></section><div className="mt-8 grid gap-8 xl:grid-cols-2"><div><h2 className="mb-4 text-xl font-black">الطلبات الشهرية</h2><SimpleBarChart data={monthlyOrders.map((x) => ({ label: x.label, value: Number(x.value) }))} /></div><div><h2 className="mb-4 text-xl font-black">المبيعات الشهرية</h2><SimpleBarChart data={monthlySales.map((x) => ({ label: x.label, value: Number(x.value) }))} /></div></div><div className="mt-8 grid gap-8 xl:grid-cols-2"><List title="أفضل المتاجر" items={topStores.map((x) => `${x.name} — ${formatCurrency(x.sales)} — ${formatNumber(x.orders)} طلب`)} /><List title="أفضل المنتجات" items={topProducts.map((x) => `${x.name} — ${x.storeName || "متجر"} — ${formatNumber(x.sold)} مبيع`)} /></div><ScheduledReportsPanel reports={scheduledReportsRows} deliveries={scheduledDeliveries} /></section></main>;
}
function Stat({ title, value }: { title: string; value: string }) { return <Card><CardHeader><CardTitle className="text-sm text-slate-500">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-slate-950">{value}</div></CardContent></Card>; }
function List({ title, items }: { title: string; items: string[] }) { return <div className="rounded-3xl border bg-white p-6 shadow-card"><h2 className="mb-4 text-xl font-black">{title}</h2><ul className="space-y-3">{items.length ? items.map((item) => <li key={item} className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{item}</li>) : <li className="text-sm text-slate-500">لا توجد بيانات</li>}</ul></div>; }
