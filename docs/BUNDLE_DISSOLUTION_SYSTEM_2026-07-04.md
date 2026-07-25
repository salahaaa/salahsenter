# تقرير نظام تفكيك العروض المجمعة وإعادة المخزون — 2026-07-04

## الهدف
تطوير نظام لإدارة العروض المجمعة بحيث يستطيع التاجر أو الأدمن تحويل كمية من الأصناف إلى مخزون عرض مستقل، ثم عند انتهاء الموسم تفكيك المتبقي وإعادة الأصناف إلى مخزونها الأصلي بأمان.

مثال:

```txt
العرض الواحد = 1 أرز + 1 سكر + 1 زيت
تم إنشاء 500 عرض
بيع 400
تبقى 100
عند التفكيك يرجع:
100 أرز
100 سكر
100 زيت
```

---

## ما تم تنفيذه

### 1) إضافة كمية لكل صنف في العرض
كان النظام يدعم صنف داخل العرض، وتم تطويره ليدعم:

```txt
الصنف + الكمية داخل العرض
```

مثلاً:

```txt
زيت × 3
رز × 2
صحون تقديم × 3
```

---

### 2) إضافة مخزون مستقل للعرض المجمع
تمت إضافة حقول إلى:

```txt
store_offer_collections
```

الحقول:

```txt
bundle_initial_quantity
bundle_remaining_quantity
bundle_dissolved_quantity
bundle_inventory_mode
bundle_inventory_status
```

عند إنشاء عرض مجمع وتحديد عدد الباقات، يقوم النظام بحجز مكونات العرض من المخزون الأساسي.

مثال:

```txt
عدد الباقات: 500
الزيت داخل الباقة: 3
المطلوب من مخزون الزيت: 1500
```

يتم خصمها من مخزون المنتج الأصلي داخل transaction.

---

### 3) جدول عمليات التفكيك
تم إنشاء جدول:

```txt
store_offer_bundle_operations
```

يسجل:

- رقم العرض.
- المتجر.
- المستخدم المنفذ.
- نوع العملية.
- الكمية المفككة.
- الكمية المتبقية قبل وبعد.
- Snapshot للأصناف والكميات قبل/بعد المخزون.
- idempotencyKey لمنع تكرار العملية.
- وقت التنفيذ.

---

### 4) Migration جديد
تمت إضافة وتطبيق:

```txt
drizzle/0033_offer_bundle_inventory_dissolution.sql
```

وتم التأكد من وجود:

```txt
store_offer_bundle_operations
bundle_initial_quantity
bundle_remaining_quantity
bundle_dissolved_quantity
bundle_inventory_mode
bundle_inventory_status
```

---

## آلية التفكيك

### عند تنفيذ التفكيك
النظام يقوم داخل transaction واحدة بـ:

1. قفل صف العرض `FOR UPDATE` لمنع Race Conditions.
2. التحقق من الكمية المتبقية.
3. منع تفكيك كمية أكبر من المتوفر.
4. حساب كمية كل صنف ترجع للمخزون:
   ```txt
   restored = quantityPerBundle × dissolvedBundles
   ```
5. تحديث كل Variant صحيح في `product_variants`.
6. تسجيل `inventory_movements` لكل صنف.
7. تحديث كمية العرض المتبقية.
8. إذا وصلت الكمية المتبقية إلى صفر:
   ```txt
   status = disabled
   bundle_inventory_status = dissolved
   ```
9. تسجيل العملية في `store_offer_bundle_operations`.
10. تسجيل Audit Log.

---

## API Endpoints

### التاجر
```txt
POST /api/merchant/offers/[id]/dissolve
```

صلاحياته:
- التاجر يستطيع تفكيك عروض متجره فقط.
- يحتاج صلاحية عروض/مخزون/إعلانات متجر مناسبة.

Payload:

```json
{
  "mode": "partial",
  "quantity": 100,
  "idempotencyKey": "unique-key",
  "note": "انتهاء موسم رمضان"
}
```

أو تفكيك كامل:

```json
{
  "mode": "full",
  "idempotencyKey": "unique-key"
}
```

### الأدمن
```txt
POST /api/admin/store-offers/[id]/dissolve
```

الأدمن يستطيع تفكيك أي عرض.

---

## واجهة التاجر
تم تعديل:

```txt
components/merchant/store-offer-actions.tsx
app/merchant/offers/page.tsx
```

الآن تظهر في جدول عروض التاجر:

```txt
مخزون العرض: المتبقي / الإجمالي
```

وإذا كان هناك كمية متبقية يظهر زر:

```txt
تفكيك العرض وإعادة المخزون
```

ويتيح:

- تفكيك كامل المتبقي.
- تفكيك كمية جزئية.

---

## واجهة الأدمن
تم تعديل:

```txt
components/admin/admin-offer-actions.tsx
app/admin/offers/page.tsx
```

الأدمن يرى مخزون العرض ويمكنه تفكيكه أيضاً.

---

## تحديث إنشاء العرض
تم تعديل:

```txt
components/merchant/store-offer-form.tsx
app/api/merchant/offers/route.ts
```

أضيف حقل:

```txt
عدد الباقات المراد حجزها من المخزون
```

إذا أدخل التاجر مثلاً:

```txt
500
```

يقوم النظام بحجز مكونات 500 باقة من المخزون الأساسي.

---

## حماية Race Conditions
تمت إضافة:

- row lock باستخدام `FOR UPDATE`.
- transaction كاملة.
- idempotencyKey لمنع تكرار نفس العملية.
- منع تفكيك كمية أكبر من المتبقي.
- تحديث المخزون والمتبقي داخل نفس transaction.

---

## دعم Variants
كل صنف داخل العرض مرتبط بـ:

```txt
variantId
```

وعند التفكيك، يتم إرجاع الكمية إلى نفس Variant الصحيح، مثل:

```txt
أرز أبيض 40kg
سكر أبيض 5kg
زيت 2L
```

---

## تحديث صفحة العرض العامة
تم تحديث:

```txt
app/offers/[id]/page.tsx
components/offers/offer-checkout-panel.tsx
lib/cache/public-offers-cache.ts
lib/cache/public-offer-detail-cache.ts
```

حتى تحسب الأسعار والكميات حسب:

```txt
offerPrice × quantity
originalPrice × quantity
```

وتعرض كمية كل صنف داخل العرض.

---

## اختبارات
تمت إضافة:

```txt
tests/bundle-calculations.test.ts
```

تختبر:

- حساب الكميات المرتجعة عند التفكيك.
- حساب إجمالي العرض مع الكميات.

---

## الفحوصات المنفذة
تم تنفيذ:

```bash
npm run typecheck
npm run lint
npm test
```

النتيجة:

```txt
TypeScript: PASS
ESLint: PASS
Tests: 12 passed
```

### ملاحظة build
حاولت تشغيل:

```bash
npm run build
```

لكن بيئة العمل الحالية وصلت إلى حد ذاكرة Node أثناء مرحلة:

```txt
Linting and checking validity of types
```

الـ compile نفسه نجح، لكن العملية توقفت بسبب:

```txt
JavaScript heap out of memory
```

وقد حدث هذا سابقاً في هذه البيئة بعد تضخم المشروع، بينما كانت typecheck/lint/test ناجحة. على Vercel أو بيئة Build بذاكرة كافية يجب أن يمر البناء. يفضل ضبط:

```env
NODE_OPTIONS=--max_old_space_size=4096
```

أو الاعتماد على Vercel build memory.

---

## النتيجة العملية
الآن عند انتهاء موسم العرض:

- التاجر يدخل إلى عروضه.
- يرى المتبقي من مخزون العرض.
- يضغط:
  ```txt
  تفكيك العرض وإعادة المخزون
  ```
- يختار كامل المتبقي أو كمية جزئية.
- النظام يعيد كل صنف إلى مخزونه الأصلي حسب تركيب العرض.
- العملية آمنة، transactional، ومسجلة في inventory logs و audit logs.
