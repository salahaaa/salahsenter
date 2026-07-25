# تقرير الحزمة 3 — Product OS: التكلفة، الموردون، التحويلات، الدُفعات ومراجعات المنتجات

**التاريخ:** 2026-07-13  
**Migration:** `0059_product_os_cost_transfers_batches_review_moderation.sql`

## الجداول والحقول الناقصة التي تمت إضافتها

### تكلفة وموردون

```text
suppliers
product_suppliers
inventory_cost_receipts
product_variants.average_cost
product_variants.last_cost
```

- المورد تابع لمتجر واحد.
- المورد يمكن ربطه بالمنتج/المتغير وسعر شرائه.
- استلام المخزون يحسب متوسط التكلفة المرجّح:

```text
(previousQty × previousAvgCost + receivedQty × unitCost)
÷
(previousQty + receivedQty)
```

- يحدّث المخزون، آخر تكلفة، متوسط التكلفة، حركة المخزون، وسجل تغيير المتغير في Transaction واحدة.

### التحويل بين الفروع

```text
inventory_transfers
inventory_transfer_lines
```

- المصدر والمستلم يجب أن يكونان متجرين/فرعين لنفس التاجر.
- دورة التحويل:

```text
draft → sent → received
          ↘ cancelled (قبل الإرسال فقط)
```

- الإرسال يخصم المصدر مع Inventory Movement موثق.
- الاستلام يضيف الفرع المستلم مع Inventory Movement موثق.
- التحويل المرسل لا يلغى تلقائياً؛ يجب استلامه ثم إنشاء تحويل عكسي، لمنع فقدان الأثر المحاسبي/المخزني.

### الدُفعات والصلاحية

```text
inventory_batches
store_capabilities
```

- الدُفعات وتاريخ الصلاحية لا تظهر تلقائياً لكل قطاع.
- تتطلب تفعيل أدمن صريحاً من:

```text
/api/admin/stores/{storeId}/capabilities
```

- القدرات الحالية:

```text
inventory_batches
inventory_expiry
```

وهذا يمنع فرض تعقيد الدواء/الغذاء على متجر ملابس أو إلكترونيات.

### مراجعات المنتجات

```text
reviews.moderation_status
reviews.moderated_by
reviews.moderated_at
reviews.moderation_note
review_media
review_reports
review_replies
```

- التقييم بعد شراء وتسليم يدخل `pending` ولا ينشر قبل اعتماد الإدارة.
- العميل يستطيع رفع صورة للتقييم وإرسال بلاغ.
- المتجر يستطيع نشر/تعديل رد واحد ظاهر على التقييم.
- الأدمن يعتمد أو يرفض أو يخفي التقييم، ويمكنه حل البلاغات المرتبطة.

## APIs والواجهات

### APIs جديدة

```text
/api/merchant/suppliers
/api/merchant/inventory/cost-receipts
/api/merchant/inventory/transfers
/api/merchant/inventory/transfers/{id}
/api/merchant/inventory/batches
/api/admin/stores/{id}/capabilities
/api/admin/reviews/{id}
/api/reviews/{id}/reports
/api/merchant/reviews/{id}/reply
```

### واجهة التاجر

تمت إضافة لوحة إلى صفحة المخزون:

```text
components/merchant/advanced-inventory-panel.tsx
```

وتشمل:

- إضافة واستعراض الموردين.
- استلام مخزون مع تكلفة وفاتورة/مرجع.
- تحديث تلقائي لمتوسط التكلفة.
- إدخال رقم الدفعة/الصلاحية عند تفعيل قدرة القطاع.
- عرض الدُفعات المسجلة.

كما تم تحديث واجهة تفاصيل المنتج لتعرض صور تقييمات العملاء ورد المتجر، وتسمح برفع صورة تقييم وإرسال بلاغ.

## اختبارات

```text
tests/advanced-inventory-costing.test.ts
```

يغطي متوسط التكلفة المرجح وحالات المخزون الفارغ وقدرات القطاع.

## حدود يجب اختبارها على Staging

- لم يجر تشغيل Transaction حقيقي ضد PostgreSQL أو إرسال تحويل فعلي بين فرعين في هذه البيئة.
- تفعيل الدُفعات يتم عبر API الأدمن؛ واجهة إدارة capabilities الكاملة في لوحة الأدمن ما زالت خطوة UI لاحقة.
- ربط Variant المصدر بمتغير الفرع المستلم مقصود وصريح؛ لا يوجد تخمين بالـ SKU لتجنب تحويل المخزون إلى متغير خاطئ.
- إدارة قائمة الموردين وعمليات الاستلام موجودة، بينما Purchase Order كامل متعدد المراحل ليس منفذاً بعد.

## التحقق

```text
npm run lint                                      PASS
NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck   PASS
npm test                                          PASS — 35 ملفات / 101 اختبار
npm run migrations:verify                         PASS — 60 SQL / 60 journal entries
npx drizzle-kit check                             PASS
npm run security:verify                           PASS
git diff --check                                  PASS
```
