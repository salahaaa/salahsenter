# تقرير تنفيذ المرحلة الثانية — Atomic Inventory + Idempotency

التاريخ: 2026-07-01

## الهدف

تقوية دورة إنشاء الطلب وتحديث حالته لمنع مشاكل التزامن، خصوصاً:

- منع overselling.
- جعل حجز المخزون atomic داخل SQL transaction.
- إدخال idempotency keys للطلبات.
- منع تكرار الطلب عند إعادة إرسال نفس الطلب من العميل.
- منع الخصم/الإرجاع المزدوج للمخزون.

---

## ما تم تنفيذه

### 1. إضافة جدول Idempotency Keys

تم تحديث Drizzle schema وإضافة migration:

```txt
lib/db/schema.ts
drizzle/0020_atomic_inventory_idempotency.sql
```

الجدول الجديد:

```txt
idempotency_keys
```

أهم الحقول:

- `scope`
- `key`
- `user_id`
- `request_hash`
- `status`
- `response_body`
- `status_code`
- `locked_until`
- `expires_at`

مع unique index:

```txt
idempotency_keys_scope_key_unique
```

الاستخدام الحالي:

```txt
scope = orders:create
```

وهو قابل للتوسع لاحقاً للمدفوعات مثل:

```txt
payments:create
payments:capture
payments:refund
```

---

### 2. إضافة مرجع لحركات المخزون

تمت إضافة أعمدة إلى جدول:

```txt
inventory_movements
```

الأعمدة الجديدة:

```txt
reference_type
reference_id
```

الهدف: ربط حركة المخزون بالطلب مباشرة بدلاً من الاعتماد على نص `reason`.

تمت إضافة indexes وpartial unique indexes لمنع التكرار:

```txt
inventory_movements_reference_idx
inventory_movements_order_variant_reserve_unique
inventory_movements_order_variant_release_unique
inventory_movements_order_variant_return_unique
inventory_movements_order_variant_deduct_unique
```

---

### 3. بناء Idempotency Layer

تمت إضافة:

```txt
lib/orders/idempotency.ts
```

وتحتوي على:

- `getRequestIdempotencyKey`
- `hashRequestPayload`
- `beginIdempotentRequest`
- `completeIdempotentRequest`
- `IdempotencyConflictError`

السلوك:

1. إذا وصل نفس `Idempotency-Key` بنفس payload، يتم إرجاع نفس الاستجابة السابقة.
2. إذا وصل نفس المفتاح ببيانات مختلفة، يتم رفض الطلب.
3. إذا كان طلب مطابق قيد المعالجة، يتم رفضه برسالة واضحة.
4. يتم تخزين response body عند نجاح إنشاء الطلب.

---

### 4. بناء Atomic Inventory Layer

تمت إضافة:

```txt
lib/inventory/atomic-inventory.ts
```

وتحتوي على:

- `reserveOrderStock`
- `deductOrderStockForLegacyUnreservedOrder`
- `releaseOrderStock`
- `InsufficientStockError`

أهم نقطة:

حجز المخزون يتم بجملة SQL شرطية داخل transaction:

```sql
UPDATE product_variants
SET stock_quantity = stock_quantity - quantity,
    updated_at = now()
WHERE id = variant_id
  AND stock_quantity >= quantity
RETURNING id, stock_quantity;
```

إذا لم ترجع row، فهذا يعني أن المخزون غير كافٍ أو أن طلباً متزامناً سبق وحجز الكمية.

---

### 5. تعديل إنشاء الطلب

تم تعديل:

```txt
app/api/orders/route.ts
```

التغييرات:

- قراءة `Idempotency-Key` من الهيدر.
- دمج البنود المكررة لنفس `variantId` قبل المعالجة.
- التحقق من أن `productId` يطابق `variant.productId`.
- التأكد من أن المنتج والمتغير active.
- إنشاء الطلب والفاتورة والبنود داخل transaction.
- تنفيذ `reserveOrderStock` داخل نفس transaction.
- تسجيل نتيجة الطلب في `idempotency_keys` قبل commit.
- إرجاع response سابق عند تكرار نفس المفتاح.

تمت إزالة نمط الحجز غير الذري القديم الذي كان يسجل حركة `reserve` بدون إنقاص المخزون.

---

### 6. تعديل تحديث حالة الطلب

تم تعديل:

```txt
app/api/orders/[id]/status/route.ts
```

السلوك الجديد:

#### عند الانتقال إلى `preparing`

- الطلبات الجديدة تكون محجوزة مسبقاً عند الإنشاء، لذلك لا يتم الخصم مرة ثانية.
- الطلبات القديمة التي لا تحتوي reference reservation يتم التعامل معها كـ legacy ويتم خصمها ذرّياً مرة واحدة.

#### عند الإلغاء `cancelled`

- إذا كان الطلب محجوزاً بنظام reservation الجديد، يتم `release` وإرجاع الكمية.
- إذا كان الطلب قديماً وتم خصمه فعلاً، يتم `return` وإرجاع الكمية.
- partial unique indexes تمنع تكرار release/return لنفس الطلب والمتغير.

---

### 7. إضافة Idempotency-Key من الواجهة

تم تعديل:

```txt
components/product/product-detail.tsx
components/store/storefront-experience.tsx
```

كل طلب شراء سريع أو checkout من سلة المتجر يرسل الآن:

```http
Idempotency-Key: <uuid>
```

هذا يمنع تكرار الطلب عند:

- ضغط المستخدم مرتين.
- إعادة المحاولة من المتصفح.
- بطء الشبكة.
- retry من العميل.

---

## الملفات المعدلة / المضافة

### ملفات جديدة

```txt
lib/orders/idempotency.ts
lib/inventory/atomic-inventory.ts
drizzle/0020_atomic_inventory_idempotency.sql
docs/PHASE_2_ATOMIC_INVENTORY_IDEMPOTENCY_REPORT_2026-07-01.md
```

### ملفات معدلة

```txt
lib/db/schema.ts
app/api/orders/route.ts
app/api/orders/[id]/status/route.ts
components/product/product-detail.tsx
components/store/storefront-experience.tsx
```

---

## نتائج التحقق

تم تشغيل:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

النتائج:

- Lint: ناجح.
- TypeScript: ناجح.
- Tests: ناجحة — 2 ملفات / 6 اختبارات.
- Build: ناجح.

---

## ملاحظات تشغيل مهمة

### يجب تطبيق migration قبل تجربة الطلبات الجديدة

في بيئة الإنتاج/التجربة يجب تشغيل:

```bash
npm run db:migrate
```

أو تطبيق الملف SQL يدوياً حسب آلية النشر:

```txt
drizzle/0020_atomic_inventory_idempotency.sql
```

بدون هذا migration ستفشل المسارات التي تعتمد على:

- `idempotency_keys`
- `inventory_movements.reference_type`
- `inventory_movements.reference_id`

### توافق مع الطلبات القديمة

تم الحفاظ على توافق جزئي مع الطلبات القديمة:

- الطلبات الجديدة تستخدم reservation reference.
- الطلبات القديمة التي لم تستخدم reference سيتم خصمها عند preparing بنمط legacy-safe.
- الإلغاء يتعامل مع reservation الجديد أو deduction القديم.

---

## ما لم يتم بعد

هذه المرحلة ركزت على atomic inventory وإنشاء الطلبات. المتبقي لاحقاً:

1. تطبيق idempotency على بوابات الدفع الفعلية عند إضافتها.
2. نقل notifications/wallet/analytics إلى queue حتى لا تبقى داخل request lifecycle.
3. إضافة اختبار تكامل حقيقي ضد PostgreSQL لتزامن checkout بعد تجهيز test database.
4. إضافة Redis counters للـ viewCount بدل DB writes.
5. تقارير مراقبة للمخزون والحركات الشاذة.

---

## الخلاصة

تم تحويل إنشاء الطلب من نمط قابل للـ overselling إلى نمط:

- Transactional.
- Atomic.
- Conditional.
- Idempotent.
- مقاوم لتكرار الضغط وإعادة الإرسال.

هذه خطوة أساسية قبل أي توسع كبير في عدد الطلبات أو الزوار.
