import Link from "next/link";
import nextDynamic from "next/dynamic";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { BulkProductPriceActions } from "@/components/merchant/bulk-product-price-actions";
import { ProductRowActions } from "@/components/merchant/product-row-actions";
import { ShowcaseStatusActions } from "@/components/merchant/showcase-status-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpCard } from "@/components/ui/help-card";
import { requireAuth } from "@/lib/auth";
import { categories, db, productAttributes, productAttributeValues, products, units } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { getStoreSetupStatus } from "@/lib/merchant-readiness";
import { MerchantSetupGate } from "@/components/merchant/merchant-setup-gate";
import { formatCurrency } from "@/lib/utils";

const ProductEngineForm = nextDynamic(() => import("@/components/merchant/product-engine-form").then((module) => module.ProductEngineForm), { loading: () => <div className="rounded-3xl border bg-white p-8 text-center text-sm font-bold text-slate-500">جارٍ تحميل محرر المنتجات...</div> });

type SearchParams = Record<string, string | string[] | undefined>;
const productStatuses = ["draft", "review", "active", "paused", "inactive", "archived"] as const;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function toPage(value: string | string[] | undefined) {
  const page = Number(firstParam(value) || 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function productPageHref(filters: { q: string; status: string; categoryId: string; page: number }, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/merchant/products?${query}` : "/merchant/products";
}

export default async function MerchantProductsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const q = firstParam(params.q).trim();
  const rawStatus = firstParam(params.status);
  const status = productStatuses.includes(rawStatus as (typeof productStatuses)[number]) ? rawStatus : "";
  const rawCategoryId = firstParam(params.categoryId);
  const categoryId = isUuid(rawCategoryId) ? rawCategoryId : "";
  const page = toPage(params.page);
  const pageSize = 50;

  const session = await requireAuth();
  const store = await getMerchantPrimaryStore(session.userId);
  const productConditions: SQL[] = [];
  if (store) productConditions.push(eq(products.storeId, store.id));
  if (q) {
    const term = `%${q}%`;
    productConditions.push(or(ilike(products.name, term), ilike(products.productCode, term), ilike(products.barcode, term), ilike(products.slug, term))!);
  }
  if (status) productConditions.push(eq(products.status, status as (typeof productStatuses)[number]));
  if (categoryId) productConditions.push(eq(products.categoryId, categoryId));

  const [productRows, categoryItems, unitItems, attributeItems, valueItems] = store
    ? await Promise.all([
        db
          .select({
            id: products.id,
            name: products.name,
            slug: products.slug,
            categoryId: products.categoryId,
            productCode: products.productCode,
            status: products.status,
            type: products.type,
            basePrice: products.basePrice,
            productCommerceType: products.productCommerceType,
            showcaseStatus: products.showcaseStatus,
            showcaseSoldAt: products.showcaseSoldAt,
            createdAt: products.createdAt
          })
          .from(products)
          .where(productConditions.length ? and(...productConditions) : sql`true`)
          .orderBy(desc(products.createdAt))
          .limit(pageSize + 1)
          .offset((page - 1) * pageSize),
        db.select().from(categories).where(and(eq(categories.storeId, store.id), eq(categories.isActive, true))).orderBy(asc(categories.code), asc(categories.sortOrder), asc(categories.name)),
        db.select().from(units).where(and(eq(units.storeId, store.id), eq(units.isActive, true))).orderBy(asc(units.sortOrder), asc(units.name)),
        db.select().from(productAttributes).where(and(eq(productAttributes.storeId, store.id), eq(productAttributes.isActive, true), eq(productAttributes.isVariantOption, true))).orderBy(asc(productAttributes.sortOrder), asc(productAttributes.name)),
        db.select().from(productAttributeValues).where(eq(productAttributeValues.isActive, true)).orderBy(asc(productAttributeValues.sortOrder), asc(productAttributeValues.value))
      ])
    : [[], [], [], [], []];

  const items = productRows.slice(0, pageSize);
  const hasNext = productRows.length > pageSize;
  const attributeIds = new Set(attributeItems.map((item) => item.id));
  const filteredValues = valueItems.filter((item) => attributeIds.has(item.attributeId));
  const setupStatus = store ? await getStoreSetupStatus(session.userId, store) : null;
  const categoryNameById = new Map(categoryItems.map((item) => [item.id, `${item.code || ""} ${item.name}`.trim()]));
  const filters = { q, status, categoryId, page };

  return (
    <main className="min-h-screen merchant-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">محرك المنتجات والمتغيرات</h1>
            <p className="mt-2 text-sm text-slate-500">إضافة المنتج في الأعلى، وإدارة الأصناف في قائمة سريعة مع بحث وفلترة بالأسفل.</p>
          </div>
          <div className="flex flex-wrap gap-2"><Button asChild><Link href="/merchant/smart-tools">الإضافات الذكية</Link></Button><Button asChild variant="outline"><Link href="/api/merchant/product-intake/template">قالب CSV</Link></Button><Button asChild variant="outline"><Link href={`/api/merchant/products/export?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`}>تصدير CSV</Link></Button><Button asChild variant="outline"><Link href="/merchant/product-taxonomy">إعدادات الأصناف والمتغيرات</Link></Button><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div>
        </div>
        <HelpCard className="mb-6" title="شرح أزرار المنتجات">
          <p><b>إضافة منتج:</b> استخدم النموذج أدناه لإنشاء منتج جديد ومتغيراته.</p>
          <p><b>قائمة الأصناف:</b> المنتجات القديمة لا تظهر كبطاقات طويلة؛ تظهر كجدول سريع مع بحث وفلترة وصفحات.</p>
          <p><b>تعديل:</b> يفتح شاشة تعديل كاملة للصور والأسعار والمتغيرات والمخزون.</p>
        </HelpCard>

        {!store ? <EmptyState title="لا يوجد متجر" /> : setupStatus && !setupStatus.ready ? <MerchantSetupGate status={setupStatus} /> : <ProductEngineForm storeId={store.id} storeSlug={store.slug} categories={categoryItems} units={unitItems} attributes={attributeItems} values={filteredValues} />}

        {store ? (
          <section className="mt-8 rounded-3xl border bg-white p-6 shadow-card">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-950">قائمة الأصناف / المنتجات</h2>
                <p className="mt-1 text-xs font-bold leading-6 text-slate-500">جدول سريع بدون صور حتى لو كان لدى التاجر آلاف الأصناف. استخدم البحث والفلترة للوصول للصنف المطلوب.</p>
              </div>
              <Button asChild variant="outline"><Link href="/merchant/reports">التقارير</Link></Button>
            </div>

            <form action="/merchant/products" method="get" className="mb-5 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_170px_240px_auto_auto]">
              <input name="q" defaultValue={q} placeholder="بحث باسم الصنف، الكود، الباركود أو الرابط" className="h-11 rounded-xl border bg-white px-4 text-sm" />
              <select name="status" defaultValue={status} className="h-11 rounded-xl border bg-white px-4 text-sm">
                <option value="">كل الحالات</option>
                <option value="draft">مسودة</option>
                <option value="review">قيد المراجعة</option>
                <option value="active">نشط</option>
                <option value="paused">موقوف مؤقتًا</option>
                <option value="inactive">غير نشط</option>
                <option value="archived">مؤرشف</option>
              </select>
              <select name="categoryId" defaultValue={categoryId} className="h-11 rounded-xl border bg-white px-4 text-sm">
                <option value="">كل الأقسام</option>
                {categoryItems.map((category) => <option key={category.id} value={category.id}>{"—".repeat(category.level)} {category.code || ""} {category.name}</option>)}
              </select>
              <Button>بحث / فلترة</Button>
              <Button asChild variant="outline"><Link href="/merchant/products">تصفير</Link></Button>
            </form>

            <BulkProductPriceActions filters={{ q, status, categoryId }} />

            {!items.length ? (
              <EmptyState title="لا توجد منتجات مطابقة" description="غيّر كلمات البحث أو الفلاتر، أو أضف منتجاً جديداً من النموذج أعلاه." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border">
                <table className="w-full min-w-[1000px] text-right text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="p-3">الصنف</th>
                      <th className="p-3">القسم</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3">النوع</th>
                      <th className="p-3">السعر الأساسي</th>
                      <th className="p-3">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((product) => (
                      <tr key={product.id} className="border-t hover:bg-slate-50">
                        <td className="p-3"><div className="font-black text-slate-950">{product.name}</div><div className="mt-1 text-xs font-bold text-slate-400">{product.productCode || "بدون كود"}</div></td>
                        <td className="p-3 text-slate-600">{product.categoryId ? categoryNameById.get(product.categoryId) || "-" : "-"}</td>
                        <td className="p-3"><div className="flex flex-col gap-2"><Badge variant={product.status === "active" ? "success" : product.status === "draft" ? "outline" : "warning"}>{product.status}</Badge>{product.showcaseStatus === "SOLD" ? <Badge variant="danger">تم البيع</Badge> : product.showcaseStatus === "HIDDEN" ? <Badge variant="outline">مخفي من المتجر</Badge> : null}</div></td>
                        <td className="p-3"><div className="flex flex-col gap-2"><span>{product.type === "variable" ? "متعدد المتغيرات" : "بسيط"}</span>{product.productCommerceType === "SHOWCASE_ONLY" ? <Badge variant="outline">عرض فقط</Badge> : <Badge variant="success">للبيع</Badge>}</div></td>
                        <td className="p-3 font-black text-primary">{product.basePrice ? formatCurrency(product.basePrice) : "-"}</td>
                        <td className="p-3"><div className="flex flex-wrap gap-2"><ProductRowActions productId={product.id} editHref={`/merchant/products/${product.id}/edit`} /><ShowcaseStatusActions productId={product.id} status={product.showcaseStatus} /><Button asChild size="sm" variant="outline"><Link href={`/store/${store.slug}/products/${product.slug}?preview=1`}>معاينة</Link></Button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-slate-500">
              <span>الصفحة {page} — تظهر 50 نتيجة كحد أقصى لتسريع الصفحة.</span>
              <div className="flex gap-2">
                {page > 1 ? <Button asChild size="sm" variant="outline"><Link href={productPageHref(filters, page - 1)}>السابق</Link></Button> : null}
                {hasNext ? <Button asChild size="sm" variant="outline"><Link href={productPageHref(filters, page + 1)}>التالي</Link></Button> : null}
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
