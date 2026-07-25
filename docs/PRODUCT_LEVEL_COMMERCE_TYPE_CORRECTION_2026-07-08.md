# تصحيح تصميم Store Commerce Type إلى Product Commerce Type — 2026-07-08

## سبب التعديل
بعد مراجعة ملاحظة المستخدم، اتضح أن جعل نوع التجارة على مستوى المتجر بالكامل `SHOWCASE_ONLY` قد يظلم التجار الذين لديهم أصناف مختلطة:

- أصناف قابلة للبيع الإلكتروني.
- أصناف للعرض فقط والتواصل.

لذلك تم اعتماد التصميم الأفضل:

```txt
القرار يكون على مستوى الصنف/المنتج وليس على مستوى المتجر فقط
```

أي أن المتجر الواحد يمكن أن يحتوي:

```txt
منتجات للبيع الإلكتروني
منتجات للعرض فقط
منتجات مباعة تظهر بشارة تم البيع
منتجات مخفية
```

---

## ما تم تغييره

### 1) إضافة Product Commerce Type
تمت إضافة حقل جديد على المنتجات:

```txt
product_commerce_type
```

بالقيم:

```txt
ONLINE_SALES
SHOWCASE_ONLY
```

Migration:

```txt
drizzle/0043_product_commerce_type.sql
```

---

### 2) إلغاء فرض نوع المتجر من طلب فتح المتجر
تمت إزالة خطوة اختيار:

```txt
بيع إلكتروني كامل / عرض المنتجات فقط
```

من نموذج طلب فتح المتجر؛ لأن القرار أصبح على مستوى المنتج.

الملفات المعدلة:

```txt
components/forms/store-application-form.tsx
lib/validators.ts
app/api/admin/merchant-applications/[id]/approve/route.ts
```

> ملاحظة: حقول store_commerce_type القديمة بقيت في DB كـ legacy/backward compatibility لكنها لم تعد تتحكم في إغلاق المتجر بالكامل.

---

### 3) إضافة اختيار داخل إضافة المنتج
في نموذج إضافة المنتج:

```txt
/merchant/products
```

أضيف اختيار:

```txt
طريقة عرض/بيع الصنف
```

الخيارات:

```txt
للبيع الإلكتروني
للعرض والتواصل فقط
```

الملف:

```txt
components/merchant/product-engine-form.tsx
```

---

### 4) إضافة الاختيار داخل تعديل المنتج
في صفحة تعديل المنتج:

```txt
/merchant/products/[id]/edit
```

أضيف نفس الاختيار حتى يستطيع التاجر تغيير الصنف لاحقاً.

الملف:

```txt
components/merchant/product-edit-form.tsx
```

---

### 5) حفظ القيمة في API المنتجات
تم تحديث:

```txt
app/api/merchant/products/route.ts
app/api/merchant/products/[id]/route.ts
lib/validators.ts
```

بحيث يتم حفظ:

```txt
productCommerceType
```

عند إنشاء وتعديل المنتج.

---

### 6) واجهة المتجر
تم تعديل:

```txt
components/store/storefront-experience.tsx
```

السلوك الآن:

#### إذا productCommerceType = ONLINE_SALES

- يظهر أضف للسلة.
- يظهر شراء.
- يعمل checkout.

#### إذا productCommerceType = SHOWCASE_ONLY

- لا تظهر أزرار الشراء/السلة على هذا المنتج فقط.
- تظهر رسالة: عرض فقط — تواصل مع المتجر.
- باقي منتجات المتجر تظل قابلة للبيع إذا كانت ONLINE_SALES.

---

### 7) صفحة تفاصيل المنتج
تم تعديل:

```txt
components/product/product-detail.tsx
app/store/[slug]/products/[productSlug]/page.tsx
```

إذا كان المنتج عرض فقط:

- تظهر لوحة تواصل مع المتجر.
- لا تظهر أزرار أضف للسلة/اشتر الآن.
- تظهر أزرار زيارة المتجر/اتصال/واتساب.

---

### 8) حماية APIs
حتى لو حاول شخص إرسال طلب يدوي:

#### Cart API

```txt
app/api/cart/route.ts
```

يرفض إضافة صنف:

```txt
productCommerceType = SHOWCASE_ONLY
```

#### Orders API

```txt
app/api/orders/route.ts
```

يرفض إنشاء طلب إذا كان أحد الأصناف للعرض فقط.

---

## العلاقة مع Showcase Sale Status
هذا التعديل لا يلغي نظام:

```txt
showcaseStatus = AVAILABLE / SOLD / HIDDEN
```

بل يكمله:

```txt
productCommerceType يحدد هل الصنف للبيع أو للعرض
showcaseStatus يحدد حالة العرض: متاح، مبيع، مخفي
```

مثال:

```txt
productCommerceType = SHOWCASE_ONLY
showcaseStatus = SOLD
```

يعني المنتج للعرض فقط وتم بيعه، فيظهر بشارة تم البيع.

---

## الملفات الأساسية المعدلة/المضافة

```txt
drizzle/0043_product_commerce_type.sql
lib/db/schema.ts
lib/validators.ts
components/forms/store-application-form.tsx
app/api/admin/merchant-applications/[id]/approve/route.ts
components/merchant/product-engine-form.tsx
components/merchant/product-edit-form.tsx
app/api/merchant/products/route.ts
app/api/merchant/products/[id]/route.ts
app/merchant/products/page.tsx
lib/db/queries.ts
components/store/storefront-experience.tsx
components/product/product-detail.tsx
app/store/[slug]/products/[productSlug]/page.tsx
app/api/cart/route.ts
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

وهو قيد الذاكرة المتكرر في Arena.

---

## المطلوب بعد النشر
تطبيق migration الجديدة:

```bash
psql "$DATABASE_URL" -f drizzle/0043_product_commerce_type.sql
```

ثم Deploy.

---

## النتيجة
أصبح المتجر الواحد مرناً:

```txt
صنف للبيع الإلكتروني
صنف للعرض فقط
صنف مبيع يظهر للثقة
صنف مخفي
```

بدون إغلاق المتجر كله في وضع عرض فقط، وبدون زيادة صفحات جديدة.
