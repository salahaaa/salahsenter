# Store Operation Status + Manual Visibility Rules + Store Category All Button — 2026-07-09

## الهدف
إضافة تحكم تشغيلي للتاجر بفتح/إغلاق المحل وأوقات الدوام، وتوسيع قواعد ظهور الرئيسية بإدخال يدوي عبر رابط/معرف، وإضافة زر "كل المنتجات" في شريط مجموعات المتجر المتحرك.

---

## 1) Store Operation Status

### تم إضافة حقول على جدول stores

```txt
operation_status
operation_note
business_hours
operation_status_updated_at
```

### الحالات المدعومة

```txt
OPEN       مفتوح الآن
CLOSED     مغلق حالياً
VACATION   في إجازة
PAUSED     متوقف مؤقتاً
```

### Migration

```txt
drizzle/0044_store_operation_status.sql
```

### API جديد

```txt
PATCH /api/merchant/store-operation
```

### واجهة التاجر
تمت إضافة قسم داخل:

```txt
/merchant/operations-settings
```

يسمح للتاجر بـ:

- فتح المحل.
- إغلاق المحل.
- وضعه في إجازة.
- إيقافه مؤقتاً.
- كتابة ملاحظة تظهر للزوار.
- تحديد أوقات الدوام كـ JSON مرن.

### التأثير على العملاء

- تظهر حالة المحل داخل واجهة المتجر.
- إذا المحل ليس `OPEN` يمنع إنشاء الطلبات.
- Checkout options تخفي الدفع والشحن عند الإغلاق/الإجازة/الإيقاف.

---

## 2) قواعد ظهور يدوية للرئيسية

تم توسيع:

```txt
/admin/home-visibility
```

ليدعم إدخال يدوي بواسطة:

- رابط متجر.
- ID متجر.
- رقم متجر.
- رابط منتج.
- ID منتج.
- كود منتج.

### الحقول الجديدة في قواعد الظهور

للمتاجر:

```txt
manualRefs
excludedRefs
excludedIds
```

للمنتجات:

```txt
manualRefs
excludedRefs
excludedIds
```

### الاستخدام

يمكن للأدمن أن يضع مثلاً:

```txt
/store/elite-fashion-import
SLH-000001
product-code-123
/store/example/products/product-slug
```

ويقوم النظام بتحويل الرابط/الكود إلى ID داخلي إن أمكن.

### الإخفاء من الرئيسية

يمكن للأدمن إخفاء متجر أو صنف من الرئيسية عبر نفس النظام بدون حذف المتجر أو الصنف.

---

## 3) زر "كل المنتجات" في شريط مجموعات المتجر

تم تعديل:

```txt
components/store/storefront-experience.tsx
```

وأضيف زر في بداية شريط مجموعات المتجر المتحرك:

```txt
كل المنتجات
```

عند الضغط عليه:

- يلغي فلتر المجموعة.
- يعرض كل أصناف المتجر مباشرة.
- لا يضطر العميل لانتظار ظهور المجموعة المطلوبة في الشريط.

---

## الملفات المعدلة/المضافة

```txt
drizzle/0044_store_operation_status.sql
app/api/merchant/store-operation/route.ts
components/merchant/operations-settings-panel.tsx
app/merchant/operations-settings/page.tsx
lib/db/schema.ts
lib/db/queries.ts
components/store/storefront-experience.tsx
app/api/orders/route.ts
app/api/checkout/options/route.ts
lib/home-visibility.ts
components/admin/home-visibility-form.tsx
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

وهو قيد الذاكرة المعروف في بيئة Arena.

---

## المطلوب بعد النشر

تطبيق migration:

```bash
psql "$DATABASE_URL" -f drizzle/0044_store_operation_status.sql
```

ثم Deploy.
