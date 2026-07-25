import Link from "next/link";
import nextDynamic from "next/dynamic";
import { asc, eq } from "drizzle-orm";
import type { ProductTaxonomyTab } from "@/components/merchant/product-taxonomy-form";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAuth } from "@/lib/auth";
import { categories, colors, db, productAttributes, productAttributeValues, sizes, units } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";

const ProductTaxonomyForm = nextDynamic(() => import("@/components/merchant/product-taxonomy-form").then((module) => module.ProductTaxonomyForm), { loading: () => <div className="rounded-3xl border bg-white p-8 text-center text-sm font-bold text-slate-500">جارٍ تحميل محرر التصنيف...</div> });

const validTabs: ProductTaxonomyTab[] = ["categories", "units", "attributes", "values", "overview"];

function toInitialTab(value: unknown): ProductTaxonomyTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return typeof tab === "string" && validTabs.includes(tab as ProductTaxonomyTab) ? tab as ProductTaxonomyTab : "categories";
}

export default async function ProductTaxonomyPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const initialTab = toInitialTab(params.tab);
  const session = await requireAuth();
  const store = await getMerchantPrimaryStore(session.userId);
  const [categoryItems, attributeItems, valueItems, unitItems, sizeItems, colorItems] = store
    ? await Promise.all([
        db.select().from(categories).where(eq(categories.storeId, store.id)).orderBy(asc(categories.code), asc(categories.sortOrder), asc(categories.name)),
        db.select().from(productAttributes).where(eq(productAttributes.storeId, store.id)).orderBy(asc(productAttributes.sortOrder), asc(productAttributes.name)),
        db.select().from(productAttributeValues).orderBy(asc(productAttributeValues.sortOrder), asc(productAttributeValues.value)),
        db.select().from(units).where(eq(units.storeId, store.id)).orderBy(asc(units.sortOrder), asc(units.name)),
        db.select().from(sizes).where(eq(sizes.storeId, store.id)).orderBy(asc(sizes.sortOrder), asc(sizes.name)),
        db.select().from(colors).where(eq(colors.storeId, store.id)).orderBy(asc(colors.sortOrder), asc(colors.name))
      ])
    : [[], [], [], [], [], []];
  const attributeIds = new Set(attributeItems.map((item) => item.id));
  const filteredValues = valueItems.filter((item) => attributeIds.has(item.attributeId));

  return (
    <main className="min-h-screen merchant-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">إعدادات الأصناف والمتغيرات</h1>
            <p className="mt-2 text-sm text-slate-500">إدارة المجموعات والوحدات والمتغيرات وقيمها من مكان واحد حتى تظهر في بطاقة المنتج كقوائم اختيار مرتبة.</p>
          </div>
          <Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button>
        </div>
        {!store ? <EmptyState title="لا يوجد متجر" /> : <ProductTaxonomyForm storeId={store.id} categories={categoryItems} attributes={attributeItems} values={filteredValues} units={unitItems} sizes={sizeItems} colors={colorItems} initialTab={initialTab} storeContext={{ name: store.name, description: store.description }} />}
      </section>
    </main>
  );
}
