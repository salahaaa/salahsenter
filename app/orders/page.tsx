export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpCard } from "@/components/ui/help-card";
import { requireAuth } from "@/lib/auth";
import { db, orders, stores } from "@/lib/db";
import { orderStatusLabels } from "@/lib/order-details";
import { formatCurrency } from "@/lib/utils";

export default async function CustomerOrdersPage() {
  const session = await requireAuth();
  const items = await db.select({ order: orders, storeName: stores.name }).from(orders).innerJoin(stores, eq(orders.storeId, stores.id)).where(eq(orders.customerId, session.userId)).orderBy(desc(orders.createdAt)).limit(100);
  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">طلباتي</h1><p className="mt-2 text-sm text-slate-500">تابع الطلبات والفواتير وحالات الشحن والنزاعات.</p></div><Button asChild variant="outline"><Link href="/">الرئيسية</Link></Button></div>
        <HelpCard className="mb-6"><p><b>تفاصيل:</b> تعرض مسار الطلب والفاتورة التفصيلية.</p><p><b>الفاتورة:</b> مرقمة وتحفظ مواصفات المنتج وقت الطلب لتجنب الخلاف.</p></HelpCard>
        {!items.length ? <EmptyState title="لا توجد طلبات" /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(({ order, storeName }) => <article key={order.id} className="rounded-3xl border bg-white p-5 shadow-card"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-950">{order.orderNumber}</h3><p className="mt-1 text-sm text-slate-500">{storeName}</p></div><Badge variant="outline">{orderStatusLabels[order.statusCode] || order.statusCode}</Badge></div><p className="mt-4 text-2xl font-black text-primary">{formatCurrency(order.grandTotal, order.currency)}</p><p className="mt-1 text-xs text-slate-400">{new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "short" }).format(order.createdAt)}</p><div className="mt-5 flex gap-2"><Button asChild size="sm"><Link href={`/orders/${order.id}`}>تفاصيل</Link></Button><Button asChild size="sm" variant="outline"><Link href={`/orders/${order.id}/invoice`}>الفاتورة</Link></Button></div></article>)}</div>}
      </section>
      <Footer />
    </main>
  );
}
