# Showcase Product Sale Status System — 2026-07-08

## الهدف
دعم متاجر العرض `SHOWCASE_ONLY` والمتاجر ذات القطع النادرة/الفاخرة بحيث يستطيع التاجر إعلان أن المنتج تم بيعه مع إبقائه ظاهراً للتسويق وبناء الثقة.

## ما تم تنفيذه

### 1) قاعدة البيانات
تمت إضافة migration:

```txt
drizzle/0042_showcase_product_sale_status.sql
```

وأضيفت حقول على جدول المنتجات:

```txt
showcase_status
showcase_sold_at
showcase_note
```

القيم المدعومة:

```txt
AVAILABLE
SOLD
HIDDEN
```

### 2) لوحة التاجر
في صفحة:

```txt
/merchant/products
```

تمت إضافة زر:

```txt
تم البيع
```

عند الضغط تظهر الخيارات:

1. إظهار المنتج مع شارة "تم البيع".
2. إخفاء المنتج من المتجر.
3. إعادة المنتج متاحاً إذا كان SOLD/HIDDEN.

الملفات:

```txt
components/merchant/showcase-status-actions.tsx
app/api/merchant/products/[id]/showcase-status/route.ts
app/merchant/products/page.tsx
```

### 3) واجهة المتجر
تم تعديل:

```txt
components/store/storefront-experience.tsx
```

إذا كان المنتج `SOLD`:

- تظهر شارة "تم البيع" على البطاقة.
- تختفي أزرار أضف/شراء.
- تظهر رسالة "تم بيع هذه القطعة مؤخراً".

إذا كان المنتج `HIDDEN`:

- لا يظهر في واجهة المتجر العامة.
- يبقى في لوحة التاجر والأدمن.

### 4) صفحة تفاصيل المنتج
تم تعديل:

```txt
components/product/product-detail.tsx
app/store/[slug]/products/[productSlug]/page.tsx
```

إذا كان المنتج `SOLD`:

- تظهر شارة كبيرة "تم البيع".
- تظهر رسالة تسويقية.
- يظهر تاريخ البيع إذا متوفر.
- يظهر عدد الأيام التي بقي فيها المنتج قبل البيع إذا توفر تاريخ الإنشاء والبيع.
- تختفي أزرار الشراء/السلة/واتساب الشراء.
- يبقى زر زيارة المتجر والمشاركة.

### 5) حماية APIs والكاش
- تم منع ظهور `HIDDEN` في public store/product queries.
- تحديث الحالة يسجل Audit Log.
- يتم تحديث public/private cache بعد تغيير الحالة.

## الملفات المعدلة/المضافة

```txt
drizzle/0042_showcase_product_sale_status.sql
lib/db/schema.ts
lib/db/queries.ts
lib/cache/public-product-cache.ts
components/store/storefront-experience.tsx
components/product/product-detail.tsx
app/store/[slug]/products/[productSlug]/page.tsx
components/merchant/showcase-status-actions.tsx
app/api/merchant/products/[id]/showcase-status/route.ts
app/merchant/products/page.tsx
docs/SHOWCASE_PRODUCT_SALE_STATUS_2026-07-08.md
```

## الفحوصات

تم تشغيل:

```bash
NODE_OPTIONS=--max_old_space_size=4096 npm run typecheck
npm run lint
npm test
```

النتيجة:

```txt
typecheck: PASS
lint: PASS
tests: PASS
9 test files passed
23 tests passed
```

محاولة build داخل Arena فشلت بـ:

```txt
SIGKILL
```

وهو قيد الذاكرة المعروف في بيئة Arena.

## المطلوب بعد النشر
تطبيق migration:

```bash
psql "$DATABASE_URL" -f drizzle/0042_showcase_product_sale_status.sql
```

ثم Deploy.

## النتيجة
أصبحت متاجر العرض تعرض المنتجات المباعة بطريقة تسويقية موثوقة بدلاً من حذفها أو إبقائها كأنها متاحة. هذا يفيد الذهب، السيارات، العقارات، الأثاث الفاخر، والقطع النادرة.
