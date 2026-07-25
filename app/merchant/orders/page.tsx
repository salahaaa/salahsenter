import Link from "next/link";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { OrderStatusActions } from "@/components/merchant/order-status-actions";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpCard } from "@/components/ui/help-card";
import { requireAuth } from "@/lib/auth";
import { db, orders } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { orderStatusLabels } from "@/lib/order-details";
import { formatCurrency } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
function toPage(value: string | string[] | undefined) { const page = Number(first(value) || 1); return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1; }
function href(filters: { q: string; status: string }, page: number) { const p = new URLSearchParams(); if (filters.q) p.set("q", filters.q); if (filters.status) p.set("status", filters.status); if (page > 1) p.set("page", String(page)); const q = p.toString(); return q ? `/merchant/orders?${q}` : "/merchant/orders"; }

export default async function MerchantOrdersPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const q = first(params.q).trim();
  const status = first(params.status).trim();
  const page = toPage(params.page);
  const pageSize = 50;
  const session = await requireAuth();
  const store = await getMerchantPrimaryStore(session.userId);
  const conditions: SQL[] = [];
  if (store) conditions.push(eq(orders.storeId, store.id));
  if (q) conditions.push(ilike(orders.orderNumber, `%${q}%`));
  if (status) conditions.push(eq(orders.statusCode, status));
  const rows = store ? await db.select().from(orders).where(and(...conditions)).orderBy(desc(orders.createdAt)).limit(pageSize + 1).offset((page - 1) * pageSize) : [];
  const items = rows.slice(0, pageSize);
  const hasNext = rows.length > pageSize;
  const filters = { q, status };
  const statuses = Object.entries(orderStatusLabels);

  return <main className="min-h-screen merchant-aurora"><SiteHeader /><section className="container py-8"><div className="mb-8 flex items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">الطلبات</h1><p className="mt-2 text-sm text-slate-500">جدول سريع مع بحث وفلترة وصفحات لتجنب طول الصفحة عند كثرة الطلبات.</p></div><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div><HelpCard className="mb-6"><p><b>تفاصيل:</b> افتح الطلب لمراجعة الفاتورة ومواصفات المنتجات قبل التجهيز.</p><p><b>الفلترة:</b> استخدم رقم الطلب أو الحالة للوصول السريع.</p></HelpCard>{!store ? <EmptyState title="لا يوجد متجر" /> : <section className="rounded-3xl border bg-white p-6 shadow-card"><form action="/merchant/orders" method="get" className="mb-5 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_220px_auto_auto]"><input name="q" defaultValue={q} placeholder="بحث برقم الطلب" className="h-11 rounded-xl border bg-white px-4 text-sm"/><select name="status" defaultValue={status} className="h-11 rounded-xl border bg-white px-4 text-sm"><option value="">كل الحالات</option>{statuses.map(([code,label])=><option key={code} value={code}>{label}</option>)}</select><Button>بحث / فلترة</Button><Button asChild variant="outline"><Link href="/merchant/orders">تصفير</Link></Button></form>{!items.length ? <EmptyState title="لا توجد طلبات مطابقة" /> : <div className="overflow-x-auto rounded-2xl border"><table className="w-full min-w-[1050px] text-right text-sm"><thead className="bg-slate-100"><tr><th className="p-3">رقم الطلب</th><th className="p-3">الحالة</th><th className="p-3">الإجمالي</th><th className="p-3">تاريخ الطلب</th><th className="p-3">تفاصيل</th><th className="p-3">تغيير الحالة</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t hover:bg-slate-50"><td className="p-3 font-black">{item.orderNumber}</td><td className="p-3"><Badge variant="outline">{orderStatusLabels[item.statusCode] || item.statusCode}</Badge></td><td className="p-3 font-black text-primary">{formatCurrency(item.grandTotal, item.currency)}</td><td className="p-3 text-slate-500">{new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "short" }).format(item.createdAt)}</td><td className="p-3"><div className="flex flex-wrap gap-2"><Button asChild size="sm"><Link href={`/merchant/orders/${item.id}`}>تفاصيل</Link></Button><Button asChild size="sm" variant="outline"><Link href={`/orders/${item.id}/invoice`}>الفاتورة</Link></Button></div></td><td className="p-3"><OrderStatusActions orderId={item.id} statusCode={item.statusCode} paymentStatus={item.paymentStatus} compact /></td></tr>)}</tbody></table></div>}<div className="mt-5 flex items-center justify-between gap-3 text-sm font-bold text-slate-500"><span>الصفحة {page} — 50 نتيجة كحد أقصى.</span><div className="flex gap-2">{page > 1 ? <Button asChild size="sm" variant="outline"><Link href={href(filters, page - 1)}>السابق</Link></Button> : null}{hasNext ? <Button asChild size="sm" variant="outline"><Link href={href(filters, page + 1)}>التالي</Link></Button> : null}</div></div></section>}</section></main>;
}
