import Link from "next/link";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { InventoryForm } from "@/components/merchant/inventory-form";
import { BulkInventoryTools } from "@/components/merchant/bulk-inventory-tools";
import { StockCountPanel } from "@/components/merchant/stock-count-panel";
import { AdvancedInventoryPanel } from "@/components/merchant/advanced-inventory-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAuth } from "@/lib/auth";
import { categories, db, inventoryMovements, products, productVariants } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";

type SearchParams = Record<string, string | string[] | undefined>;
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
function toPage(value: string | string[] | undefined) { const page = Number(first(value) || 1); return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1; }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function href(filters: { q: string; categoryId: string; stock: string }, page: number) { const p = new URLSearchParams(); if (filters.q) p.set("q", filters.q); if (filters.categoryId) p.set("categoryId", filters.categoryId); if (filters.stock) p.set("stock", filters.stock); if (page > 1) p.set("page", String(page)); const q = p.toString(); return q ? `/merchant/inventory?${q}` : "/merchant/inventory"; }

export default async function MerchantInventoryPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const q = first(params.q).trim();
  const categoryId = isUuid(first(params.categoryId)) ? first(params.categoryId) : "";
  const stock = ["low", "out", "available"].includes(first(params.stock)) ? first(params.stock) : "";
  const page = toPage(params.page);
  const pageSize = 50;
  const session = await requireAuth();
  const store = await getMerchantPrimaryStore(session.userId);
  const conditions: SQL[] = [];
  if (store) conditions.push(eq(products.storeId, store.id));
  if (q) { const term = `%${q}%`; conditions.push(or(ilike(products.name, term), ilike(productVariants.sku, term), ilike(productVariants.title, term), ilike(productVariants.barcode, term))!); }
  if (categoryId) conditions.push(eq(products.categoryId, categoryId));
  if (stock === "low") conditions.push(sql`${productVariants.stockQuantity} <= ${productVariants.lowStockThreshold}`);
  if (stock === "out") conditions.push(eq(productVariants.stockQuantity, 0));
  if (stock === "available") conditions.push(sql`${productVariants.stockQuantity} > 0`);

  const [variantRows, movementItems, categoryItems] = store
    ? await Promise.all([
        db.select({ variantId: productVariants.id, sku: productVariants.sku, title: productVariants.title, price: productVariants.price, stockQuantity: productVariants.stockQuantity, lowStockThreshold: productVariants.lowStockThreshold, productName: products.name, categoryId: products.categoryId }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).where(and(...conditions)).orderBy(desc(productVariants.updatedAt)).limit(pageSize + 1).offset((page - 1) * pageSize),
        db.select().from(inventoryMovements).where(eq(inventoryMovements.storeId, store.id)).orderBy(desc(inventoryMovements.createdAt)).limit(50),
        db.select({ id: categories.id, name: categories.name, level: categories.level, code: categories.code }).from(categories).where(eq(categories.storeId, store.id)).orderBy(asc(categories.code), asc(categories.name))
      ])
    : [[], [], []];
  const variantItems = variantRows.slice(0, pageSize);
  const hasNext = variantRows.length > pageSize;
  const lowItems = variantItems.filter((item) => item.stockQuantity <= item.lowStockThreshold);
  const filters = { q, categoryId, stock };

  return <main className="min-h-screen merchant-aurora"><SiteHeader /><section className="container py-8"><div className="mb-8 flex items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">المخزون</h1><p className="mt-2 text-sm text-slate-500">جدول مخزون سريع مع بحث وفلترة وصفحات، وسجل آخر الحركات.</p></div><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div>{!store ? <EmptyState title="لا يوجد متجر" /> : <><InventoryForm storeId={store.id} variants={variantItems} /><div className="mt-6"><BulkInventoryTools categories={categoryItems} /></div><StockCountPanel/><AdvancedInventoryPanel storeId={store.id} variants={variantItems}/><section className="mt-8 rounded-3xl border bg-white p-6 shadow-card"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">المتغيرات والمخزون</h2><p className="mt-1 text-xs font-bold text-slate-500">استخدم الفلاتر للوصول للصنف المطلوب بدلاً من تحميل كل المخزون.</p></div><Badge variant={lowItems.length ? "warning" : "success"}>قريب النفاد في هذه الصفحة: {lowItems.length}</Badge></div><form action="/merchant/inventory" method="get" className="mb-5 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_240px_180px_auto_auto]"><input name="q" defaultValue={q} placeholder="بحث باسم المنتج، SKU أو الباركود" className="h-11 rounded-xl border bg-white px-4 text-sm"/><select name="categoryId" defaultValue={categoryId} className="h-11 rounded-xl border bg-white px-4 text-sm"><option value="">كل الأقسام</option>{categoryItems.map((category)=><option key={category.id} value={category.id}>{"—".repeat(category.level)} {category.code || ""} {category.name}</option>)}</select><select name="stock" defaultValue={stock} className="h-11 rounded-xl border bg-white px-4 text-sm"><option value="">كل المخزون</option><option value="low">قريب النفاد</option><option value="out">نافد</option><option value="available">متوفر</option></select><Button>بحث / فلترة</Button><Button asChild variant="outline"><Link href="/merchant/inventory">تصفير</Link></Button></form>{!variantItems.length ? <EmptyState title="لا توجد نتائج مخزون" /> : <div className="overflow-x-auto rounded-2xl border"><table className="w-full min-w-[950px] text-right text-sm"><thead className="bg-slate-100"><tr><th className="p-3">المنتج</th><th className="p-3">المتغير/SKU</th><th className="p-3">المخزون</th><th className="p-3">حد التنبيه</th><th className="p-3">الحالة</th><th className="p-3">السعر</th></tr></thead><tbody>{variantItems.map((item)=><tr key={item.variantId} className="border-t hover:bg-slate-50"><td className="p-3 font-black text-slate-950">{item.productName}</td><td className="p-3"><div>{item.title || "افتراضي"}</div><div className="text-xs text-slate-400">{item.sku}</div></td><td className="p-3 font-black">{item.stockQuantity}</td><td className="p-3">{item.lowStockThreshold}</td><td className="p-3"><Badge variant={item.stockQuantity <= 0 ? "danger" : item.stockQuantity <= item.lowStockThreshold ? "warning" : "success"}>{item.stockQuantity <= 0 ? "نافد" : item.stockQuantity <= item.lowStockThreshold ? "قريب النفاد" : "متوفر"}</Badge></td><td className="p-3 text-primary font-bold">{item.price}</td></tr>)}</tbody></table></div>}<div className="mt-5 flex items-center justify-between gap-3 text-sm font-bold text-slate-500"><span>الصفحة {page} — 50 نتيجة كحد أقصى.</span><div className="flex gap-2">{page > 1 ? <Button asChild size="sm" variant="outline"><Link href={href(filters, page - 1)}>السابق</Link></Button> : null}{hasNext ? <Button asChild size="sm" variant="outline"><Link href={href(filters, page + 1)}>التالي</Link></Button> : null}</div></div></section><section className="mt-8 rounded-3xl border bg-white p-6 shadow-card"><h2 className="mb-4 text-xl font-black">آخر حركات المخزون</h2>{!movementItems.length ? <EmptyState title="لا توجد حركات" /> : <div className="overflow-x-auto rounded-2xl border"><table className="w-full min-w-[800px] text-right text-sm"><thead className="bg-slate-100"><tr><th className="p-3">النوع</th><th className="p-3">الكمية</th><th className="p-3">قبل ← بعد</th><th className="p-3">السبب</th><th className="p-3">التاريخ</th></tr></thead><tbody>{movementItems.map((item)=><tr key={item.id} className="border-t"><td className="p-3"><Badge variant="outline">{item.type}</Badge></td><td className="p-3 font-bold">{item.quantity}</td><td className="p-3">{item.beforeQuantity} ← {item.afterQuantity}</td><td className="p-3">{item.reason || "-"}</td><td className="p-3 text-slate-500">{new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "short" }).format(item.createdAt)}</td></tr>)}</tbody></table></div>}</section></>}</section></main>;
}
