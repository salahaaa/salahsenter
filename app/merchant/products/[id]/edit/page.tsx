export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import nextDynamic from "next/dynamic";
import { asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { ProductQuestionsPanel } from "@/components/merchant/product-questions-panel";
import { CatalogQualityCard } from "@/components/merchant/catalog-quality-card";
import { ProductLifecycleControls } from "@/components/merchant/product-lifecycle-controls";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { categories, db, productVariantAttributeValues, productVariants, productAttributes, productAttributeValues, products, sizes, colors, stores, units } from "@/lib/db";

const ProductEditForm = nextDynamic(() => import("@/components/merchant/product-edit-form").then((module) => module.ProductEditForm), { loading: () => <div className="rounded-3xl border bg-white p-8 text-center text-sm font-bold text-slate-500">جارٍ تحميل محرر المنتج...</div> });

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth();
  const [row] = await db.select({ product: products, store: stores }).from(products).innerJoin(stores, eq(products.storeId, stores.id)).where(eq(products.id, id)).limit(1);
  if (!row) notFound();
  if (!hasStoreAccess(session, row.store.id)) return <Forbidden />;

  const [categoryItems, variantItems, attributeItems, valueItems, unitItems, sizeItems, colorItems] = await Promise.all([
    db.select({ id: categories.id, name: categories.name, code: categories.code, level: categories.level }).from(categories).where(eq(categories.storeId, row.store.id)).orderBy(asc(categories.code), asc(categories.sortOrder), asc(categories.name)),
    db.select().from(productVariants).where(eq(productVariants.productId, row.product.id)).orderBy(asc(productVariants.createdAt)),
    db.select().from(productAttributes).where(eq(productAttributes.storeId, row.store.id)).orderBy(asc(productAttributes.sortOrder), asc(productAttributes.name)),
    db.select().from(productAttributeValues).orderBy(asc(productAttributeValues.sortOrder), asc(productAttributeValues.value)),
    db.select().from(units).where(eq(units.storeId, row.store.id)).orderBy(asc(units.sortOrder), asc(units.name)),
    db.select().from(sizes).where(eq(sizes.storeId, row.store.id)).orderBy(asc(sizes.sortOrder), asc(sizes.name)),
    db.select().from(colors).where(eq(colors.storeId, row.store.id)).orderBy(asc(colors.sortOrder), asc(colors.name))
  ]);

  // Attach the linked attribute-value ids to each variant for re-binding in the editor.
  const variantIds = variantItems.map((v) => v.id);
  const linksByVariant = new Map<string, string[]>();
  if (variantIds.length) {
    const rows = await db.select({ variantId: productVariantAttributeValues.variantId, valueId: productVariantAttributeValues.valueId }).from(productVariantAttributeValues).where(inArray(productVariantAttributeValues.variantId, variantIds));
    for (const r of rows) {
      const arr = linksByVariant.get(r.variantId) || [];
      arr.push(r.valueId);
      linksByVariant.set(r.variantId, arr);
    }
  }
  const variantsWithLinks = variantItems.map((variant) => ({ ...variant, attributeValueIds: linksByVariant.get(variant.id) || [] }));

  return (
    <main className="min-h-screen merchant-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-black text-slate-950">تعديل المنتج بالكامل</h1>
            <p className="mt-2 text-sm leading-7 text-slate-500">عدّل بيانات المنتج، الصور، الوصف، الأسعار، المتغيرات والمخزون من شاشة واحدة.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href={`/store/${row.store.slug}/products/${row.product.slug}?preview=1`}>معاينة المنتج</Link></Button>
            <Button asChild variant="outline"><Link href="/merchant/products">العودة للمنتجات</Link></Button>
          </div>
        </div>
        <div className="mt-8 grid gap-6 xl:grid-cols-2"><CatalogQualityCard productId={row.product.id}/><ProductLifecycleControls productId={row.product.id} status={row.product.status} publishAt={row.product.publishAt} unpublishAt={row.product.unpublishAt}/></div>
        <div className="mt-8"><ProductEditForm product={row.product} variants={variantsWithLinks} categories={categoryItems} attributes={attributeItems} attributeValues={valueItems} units={unitItems} sizes={sizeItems} colors={colorItems} storeSlug={row.store.slug} /></div>
        <div className="mt-8"><ProductQuestionsPanel productId={row.product.id} /></div>
      </section>
    </main>
  );
}

function Forbidden() {
  return <main className="min-h-screen merchant-aurora"><SiteHeader /><section className="container py-12"><EmptyState title="لا تملك صلاحية تعديل هذا المنتج" /></section></main>;
}
