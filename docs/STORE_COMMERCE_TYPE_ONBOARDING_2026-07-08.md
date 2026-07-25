# تقرير Store Commerce Type During Merchant Onboarding — 2026-07-08

## الهدف
إتاحة نوعين من المتاجر داخل المنصة أثناء طلب فتح المتجر:

```txt
ONLINE_SALES
SHOWCASE_ONLY
```

حتى لا تكون كل المتاجر ملزمة بدورة البيع الإلكتروني الكاملة، خصوصاً أنشطة مثل الذهب والمجوهرات والمعارض والمنتجات مرتفعة القيمة.

---

## ما تم تنفيذه

### 1) قاعدة البيانات
تمت إضافة migration:

```txt
drizzle/0041_store_commerce_type.sql
```

وتضيف الحقل:

```txt
store_commerce_type
```

إلى:

```txt
merchant_applications
stores
```

بالقيم:

```txt
ONLINE_SALES
SHOWCASE_ONLY
```

مع constraints وفهرس:

```txt
stores_commerce_type_idx
```

---

### 2) طلب فتح المتجر
تم تعديل:

```txt
components/forms/store-application-form.tsx
lib/validators.ts
```

وأضيفت خطوة واضحة:

```txt
كيف تريد تشغيل متجرك داخل المنصة؟
```

الخيارات:

```txt
بيع إلكتروني كامل
عرض المنتجات فقط
```

مع شرح مبسط لكل خيار.

---

### 3) اعتماد المتجر من الأدمن
تم تعديل:

```txt
app/api/admin/merchant-applications/[id]/approve/route.ts
```

بحيث ينتقل اختيار التاجر من الطلب إلى المتجر المنشأ:

```txt
store.storeCommerceType = application.storeCommerceType
```

---

### 4) واجهة المتجر Storefront
تم تعديل:

```txt
lib/db/queries.ts
components/store/storefront-experience.tsx
```

إذا كان:

```txt
SHOWCASE_ONLY
```

يتم:

- إظهار بطاقة توضيحية: متجر عرض فقط.
- إظهار تواصل واتساب.
- إظهار زر اتصال إن وجد رقم.
- إظهار استعراض المنتجات.
- إخفاء/تعطيل السلة والشراء داخل المتجر.
- إخفاء Cart Drawer.
- تغيير زر الملاحة السفلي من السلة إلى عرض.

---

### 5) صفحة تفاصيل المنتج
تم تعديل:

```txt
components/product/product-detail.tsx
app/store/[slug]/products/[productSlug]/page.tsx
```

إذا كان المنتج تابعاً لمتجر `SHOWCASE_ONLY`:

- لا يظهر زر أضف للسلة.
- لا يظهر زر اشتر الآن.
- تظهر لوحة:

```txt
هذا المنتج للعرض فقط
```

مع:

- تواصل مع المتجر.
- اتصال.
- زيارة المتجر.

---

### 6) حماية APIs من الشراء لمتاجر العرض فقط
تم تعديل:

```txt
app/api/cart/route.ts
app/api/checkout/options/route.ts
app/api/orders/route.ts
```

الحماية الآن:

- لا يمكن إضافة منتجات متجر SHOWCASE_ONLY إلى السلة عبر API.
- checkout options لا تعرض الدفع والشحن لمتجر عرض فقط.
- order creation يرفض إنشاء طلب لمتجر عرض فقط.

هذا مهم لأن إخفاء الأزرار في الواجهة غير كافٍ أمنياً.

---

## سلوك كل نوع متجر

### ONLINE_SALES

متجر إلكتروني كامل:

- السلة.
- Checkout.
- الطلبات.
- الدفع.
- التوصيل.
- المخزون.
- الفواتير.

### SHOWCASE_ONLY

متجر عرض فقط:

- صور المنتجات.
- الأسعار/الأسعار التقريبية.
- مواصفات المنتج.
- بيانات المتجر.
- الهاتف.
- واتساب.
- زيارة المتجر.

بدون:

- سلة.
- شراء الآن.
- Checkout.
- دفع.
- شحن.
- طلبات إلكترونية.

---

## الملفات المعدلة/المضافة

### جديدة

```txt
drizzle/0041_store_commerce_type.sql
docs/STORE_COMMERCE_TYPE_ONBOARDING_2026-07-08.md
```

### معدلة

```txt
lib/db/schema.ts
lib/validators.ts
components/forms/store-application-form.tsx
app/api/admin/merchant-applications/[id]/approve/route.ts
lib/db/queries.ts
components/store/storefront-experience.tsx
components/product/product-detail.tsx
app/store/[slug]/products/[productSlug]/page.tsx
app/api/cart/route.ts
app/api/checkout/options/route.ts
app/api/orders/route.ts
```

---

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

محاولة build داخل Arena:

```txt
SIGKILL
```

وهو نفس قيد الذاكرة المعروف في بيئة Arena.

---

## المطلوب بعد النشر

تطبيق migration الجديدة:

```bash
psql "$DATABASE_URL" -f drizzle/0041_store_commerce_type.sql
```

ثم Deploy.

---

## النتيجة
أصبحت المنصة قادرة على استيعاب:

- متاجر بيع إلكتروني كامل.
- متاجر عرض فقط.
- الذهب والمجوهرات.
- المعارض التجارية.
- المنتجات مرتفعة القيمة.

بدون تعقيد دورة التجارة الإلكترونية الحالية، وبنفس بنية المتاجر والمنتجات الحالية.
