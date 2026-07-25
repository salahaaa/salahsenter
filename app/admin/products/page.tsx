import Link from "next/link";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpCard } from "@/components/ui/help-card";
import { ProductModerationActions } from "@/components/admin/product-moderation-actions";
import { db, products, stores } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { formatCurrency } from "@/lib/utils";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";

type SearchParams = Record<string, string | string[] | undefined>;
const productStatuses = ["draft", "review", "active", "paused", "inactive", "archived"] as const;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function toPage(value: string | string[] | undefined) {
  const page = Number(firstParam(value) || 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function pageHref(filters: { q: string; status: string; page: number }, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/products?${query}` : "/admin/products";
}

export default async function AdminProductsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await requireAuth();
  await assertAdminOperation(session, "platform_products.view");
  const params = searchParams ? await searchParams : {};
  const q = firstParam(params.q).trim();
  const rawStatus = firstParam(params.status);
  const status = productStatuses.includes(rawStatus as (typeof productStatuses)[number]) ? rawStatus : "";
  const page = toPage(params.page);
  const pageSize = 50;

  const conditions: SQL[] = [];
  if (q) {
    const term = `%${q}%`;
    conditions.push(or(ilike(products.name, term), ilike(products.productCode, term), ilike(products.barcode, term), ilike(products.slug, term), ilike(stores.name, term))!);
  }
  if (status) conditions.push(eq(products.status, status as (typeof productStatuses)[number]));

  const rows = hasDatabase()
    ? await db
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          productCode: products.productCode,
          status: products.status,
          type: products.type,
          basePrice: products.basePrice,
          storeName: stores.name,
          storeSlug: stores.slug,
          storeRating: stores.ratingAverage,
          storeCompleteness: stores.profileCompleteness
        })
        .from(products)
        .leftJoin(stores, eq(products.storeId, stores.id))
        .where(conditions.length ? and(...conditions) : sql`true`)
        .orderBy(desc(products.createdAt))
        .limit(pageSize + 1)
        .offset((page - 1) * pageSize)
    : [];

  const items = rows.slice(0, pageSize);
  const hasNext = rows.length > pageSize;
  const filters = { q, status, page };

  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">إدارة المنتجات</h1>
            <p className="mt-2 text-sm text-slate-500">قائمة رقابية سريعة بدون تحميل صور المنتجات، مع بحث وفلترة وصفحات.</p>
          </div>
          <Button asChild variant="outline"><Link href="/admin">العودة</Link></Button>
        </div>
        <HelpCard className="mb-6" title="شرح إدارة المنتجات للأدمن">
          <p>تم تحويل المنتجات إلى جدول خفيف حتى لا تبطئ الصفحة عند كثرة الأصناف. استخدم البحث للوصول إلى الصنف أو المتجر ثم عاين المنتج أو أوقف المخالف.</p>
        </HelpCard>

        <section className="rounded-3xl border bg-white p-6 shadow-card">
          <form action="/admin/products" method="get" className="mb-5 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_180px_auto_auto]">
            <input name="q" defaultValue={q} placeholder="بحث باسم المنتج، الكود، الباركود أو اسم المتجر" className="h-11 rounded-xl border bg-white px-4 text-sm" />
            <select name="status" defaultValue={status} className="h-11 rounded-xl border bg-white px-4 text-sm">
              <option value="">كل الحالات</option>
              <option value="draft">مسودة</option>
              <option value="review">قيد المراجعة</option>
              <option value="active">نشط</option>
              <option value="paused">موقوف مؤقتًا</option>
              <option value="inactive">غير نشط</option>
              <option value="archived">مؤرشف</option>
            </select>
            <Button>بحث / فلترة</Button>
            <Button asChild variant="outline"><Link href="/admin/products">تصفير</Link></Button>
          </form>

          {!items.length ? (
            <EmptyState title="لا توجد منتجات مطابقة" />
          ) : (
            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[1050px] text-right text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="p-3">المنتج</th>
                    <th className="p-3">المتجر</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">النوع</th>
                    <th className="p-3">السعر</th>
                    <th className="p-3">جودة المتجر</th>
                    <th className="p-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t align-top hover:bg-slate-50">
                      <td className="p-3"><div className="font-black text-slate-950">{item.name}</div><div className="mt-1 text-xs font-bold text-slate-400">{item.productCode || "بدون كود"}</div></td>
                      <td className="p-3"><div className="font-bold">{item.storeName || "متجر"}</div>{item.storeSlug ? <div className="mt-1 text-xs text-slate-400">/store/{item.storeSlug}</div> : null}</td>
                      <td className="p-3"><Badge variant={item.status === "active" ? "success" : item.status === "draft" ? "outline" : "warning"}>{item.status}</Badge></td>
                      <td className="p-3">{item.type === "variable" ? "متعدد" : "بسيط"}</td>
                      <td className="p-3 font-black text-primary">{item.basePrice ? formatCurrency(item.basePrice) : "-"}</td>
                      <td className="p-3 text-xs font-bold text-slate-500">تقييم: {item.storeRating || "0"}<br />اكتمال: {item.storeCompleteness || 0}%</td>
                      <td className="p-3"><div className="flex min-w-48 flex-col gap-2">{item.storeSlug ? <Button asChild size="sm" variant="outline"><Link href={`/store/${item.storeSlug}/products/${item.slug}?preview=1`}>معاينة المنتج</Link></Button> : null}{item.status === "active" ? <ProductModerationActions productId={item.id} productName={item.name} /> : null}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-slate-500">
            <span>الصفحة {page} — تظهر 50 نتيجة كحد أقصى لتسريع الصفحة.</span>
            <div className="flex gap-2">
              {page > 1 ? <Button asChild size="sm" variant="outline"><Link href={pageHref(filters, page - 1)}>السابق</Link></Button> : null}
              {hasNext ? <Button asChild size="sm" variant="outline"><Link href={pageHref(filters, page + 1)}>التالي</Link></Button> : null}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
