import { config } from "dotenv";

config({ path: ".env.local" });

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production" || process.env.VERCEL_ENV === "production") throw new Error("Smoke product cycle محظور في الإنتاج.");
  if (process.env.SMOKE_ALLOW_DATABASE_WRITE !== "true") throw new Error("عيّن SMOKE_ALLOW_DATABASE_WRITE=true لتأكيد تشغيل smoke يكتب في قاعدة غير إنتاجية.");
  const storeSlug = process.env.SMOKE_STORE_SLUG?.trim();
  if (!storeSlug) throw new Error("SMOKE_STORE_SLUG مطلوب؛ لا توجد قيمة متجر تجريبية افتراضية.");
  const { and, eq } = await import("drizzle-orm");
  const { db, stores, categories, products, productVariants } = await import("@/lib/db");
  const { getPublicStore } = await import("@/lib/db/queries");
  const { createProductFromDraft, enrichProductDraft, getStoreCategories, parseProductTextToDraft } = await import("@/lib/enterprise/product-intake");

  const [store] = await db.select().from(stores).where(eq(stores.slug, storeSlug)).limit(1);
  assert(store, `لم يتم العثور على المتجر المحدد: ${storeSlug}`);

  const suffix = Date.now().toString(36);
  const categorySlug = `smoke-category-${suffix}`;
  const productName = `Smoke Smart Product ${suffix}`;
  let categoryId: string | null = null;
  let productId: string | null = null;

  try {
    const [category] = await db
      .insert(categories)
      .values({
        storeId: store.id,
        name: `Smoke Category ${suffix}`,
        slug: categorySlug,
        codeMode: "auto",
        level: 0,
        imageUrl: "data:image/png;base64,iVBORw0KGgo=",
        isActive: true,
        sortOrder: 9999
      })
      .returning();
    categoryId = category.id;

    const [updatedCategory] = await db
      .update(categories)
      .set({ name: `Smoke Category Updated ${suffix}`, imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=", updatedAt: new Date() })
      .where(eq(categories.id, category.id))
      .returning();
    assert(updatedCategory.name.includes("Updated"), "فشل تعديل الصنف");
    assert(Boolean(updatedCategory.imageUrl), "فشل حفظ صورة الصنف");

    const storeCategories = await getStoreCategories(store.id);
    const draft = parseProductTextToDraft(`شاشة سامسونج 60 بوصة سمارت 4K ${productName} بسعر 123`, storeCategories);
    draft.name = productName;
    draft.categoryId = category.id;
    draft.barcode = `SMOKE-${suffix}`;
    draft.basePrice = 123;
    draft.stockQuantity = 7;
    draft.mainImageUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
    draft.status = "active";

    const enrichedBeforeCreate = await enrichProductDraft(store.id, draft);
    assert(Array.isArray(enrichedBeforeCreate.duplicateCandidates), "فشل نظام كشف التكرار قبل الحفظ");

    const created = await createProductFromDraft(store, enrichedBeforeCreate, store.merchantId, "create");
    productId = created.product.id;

    const [variant] = await db.select().from(productVariants).where(eq(productVariants.productId, productId)).limit(1);
    assert(variant, "لم يتم إنشاء متغير افتراضي للمنتج");
    assert(variant.stockQuantity === 7, "المخزون الابتدائي للمنتج غير صحيح");

    const publicStore = await getPublicStore(store.slug);
    assert(publicStore?.products.some((product) => product.id === productId), "المنتج النشط لم يظهر في صفحة المتجر العامة");

    const duplicateCheck = await enrichProductDraft(store.id, { ...draft, name: `${productName} نسخة مكررة` });
    assert((duplicateCheck.duplicateCandidates || []).some((candidate) => candidate.id === productId), "نظام كشف التكرار لم يكتشف المنتج المشابه/نفس الباركود");

    await db.update(products).set({ status: "inactive", updatedAt: new Date() }).where(eq(products.id, productId));
    const storeAfterDisable = await getPublicStore(store.slug);
    assert(!storeAfterDisable?.products.some((product) => product.id === productId), "المنتج غير النشط ما زال يظهر للعملاء");

    await db.update(products).set({ status: "active", updatedAt: new Date() }).where(eq(products.id, productId));
    const storeAfterEnable = await getPublicStore(store.slug);
    assert(storeAfterEnable?.products.some((product) => product.id === productId), "المنتج لم يعد للظهور بعد تفعيله");

    console.log(JSON.stringify({
      ok: true,
      checks: [
        "category_create_update_image_ok",
        "smart_text_parse_ok",
        "product_create_variant_stock_ok",
        "product_visible_in_store_ok",
        "duplicate_detection_ok",
        "product_status_visibility_cycle_ok"
      ],
      store: store.slug,
      categoryId,
      productId
    }, null, 2));
  } finally {
    if (productId) await db.delete(products).where(eq(products.id, productId));
    if (categoryId) await db.delete(categories).where(and(eq(categories.id, categoryId), eq(categories.storeId, store.id)));
  }
}

main().catch((error) => {
  console.error("PRODUCT_CYCLE_SMOKE_FAILED", error);
  process.exit(1);
});
