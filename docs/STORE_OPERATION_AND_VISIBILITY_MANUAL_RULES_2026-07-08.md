# تقرير: حالة تشغيل المحل + قواعد ظهور يدوية + زر كل المنتجات — 2026-07-08

## ما تم تنفيذه

### 1) حالة تشغيل المحل من قبل التاجر
تمت إضافة حقول على المتجر:

```txt
operation_status
operation_note
business_hours
operation_status_updated_at
```

الحالات:

```txt
OPEN       مفتوح الآن
CLOSED     مغلق حالياً
VACATION   في إجازة
PAUSED     متوقف مؤقتاً
```

Migration:

```txt
drizzle/0044_store_operation_status.sql
```

### واجهة التاجر
تمت إضافة قسم داخل:

```txt
/merchant/operations-settings
```

بعنوان:

```txt
حالة تشغيل المحل والدوام
```

يستطيع التاجر منه:

- فتح المحل.
- إغلاق المحل.
- وضعه في إجازة.
- إيقافه مؤقتاً.
- كتابة ملاحظة للعميل.
- تحديد أوقات الدوام بصيغة JSON مرنة.

### API جديد

```txt
PATCH /api/merchant/store-operation
```

### التأثير على الواجهة والطلبات

- تظهر حالة المحل داخل واجهة المتجر.
- إذا المحل ليس OPEN يتم منع إنشاء طلب إلكتروني.
- Checkout options تخفي الدفع والشحن عند إغلاق المحل.

---

## 2) إضافات يدوية في قواعد الظهور الرئيسية
تم توسيع قواعد الظهور في:

```txt
/admin/home-visibility
```

ليتمكن الأدمن من إدخال:

- ID متجر.
- رابط متجر.
- رقم متجر.
- ID منتج.
- رابط منتج.
- كود منتج.

### إضافات المتاجر

```txt
manualRefs
excludedRefs
excludedIds
```

### إضافات المنتجات

```txt
manualRefs
excludedRefs
excludedIds
```

تمت إضافة حقول في الواجهة:

- روابط/أرقام متاجر يدوية.
- إخفاء متاجر من الرئيسية.
- روابط/أكواد منتجات يدوية.
- إخفاء منتجات من الرئيسية.

### السلوك

- يمكن للأدمن وضع رابط مثل `/store/store-slug` ليظهر يدوياً.
- يمكنه وضع رابط منتج أو كوده ليظهر يدوياً.
- يمكنه إخفاء متجر أو منتج من الرئيسية حتى لو كان ترتيبه عالياً.

---

## 3) زر الكل في شريط التاجر المتحرك
في واجهة المتجر، داخل شريط المجموعات المتحرك:

```txt
components/store/storefront-experience.tsx
```

تمت إضافة زر:

```txt
كل المنتجات
```

يفتح كل أصناف المتجر مباشرة بإلغاء فلتر المجموعة.

هذا يمنع انتظار ظهور مجموعة معينة داخل الشريط.

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
