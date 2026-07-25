# تقرير استكمال المدفوعات المحلية والسلة والإرجاعات

التاريخ: 2026-07-01

## ما تم تنفيذه

### 1. بوابات دفع محلية مناسبة لليمن والخليج

تم توسيع خيارات الدفع لتدعم:

- `manual` دفع يدوي / تحويل.
- `cod` الدفع عند الاستلام.
- `bank_transfer` تحويل بنكي / IBAN.
- `wallet` محافظ إلكترونية.
- `remittance` حوالات مالية / صرافة.
- `stripe` دفع إلكتروني بالبطاقات.

الملفات:

```txt
lib/payments/methods.ts
lib/payments/gateway.ts
components/merchant/operations-settings-panel.tsx
```

أصبح التاجر يستطيع من صفحة:

```txt
/merchant/operations-settings
```

إدخال بيانات الحساب أو المحفظة أو شركة الصرافة وتعليمات الدفع للعميل.

---

### 2. إثباتات الدفع Payment Receipts

تمت إضافة جدول:

```txt
payment_receipts
```

ضمن migration:

```txt
drizzle/0026_payment_receipts.sql
```

وتم تطبيقه على قاعدة البيانات بنجاح.

APIs:

```txt
/api/payments/proof
/api/merchant/payment-receipts/[id]
```

العميل يستطيع:

- رفع إثبات دفع.
- إدخال رقم العملية / الحوالة.
- إدخال اسم ورقم المرسل.
- رفع صورة إيصال.

التاجر يستطيع:

- قبول إثبات الدفع.
- رفض إثبات الدفع.

وعند القبول:

```txt
orders.paymentStatus = paid
order_payments.status = paid
```

وعند الرفض:

```txt
orders.paymentStatus = failed
order_payments.status = failed
```

---

### 3. عرض إثباتات الدفع داخل تفاصيل الطلب

تم تحديث:

```txt
lib/order-details.ts
components/orders/order-detail-view.tsx
```

ليتم عرض:

- إثباتات الدفع.
- حالة كل إثبات.
- رابط الإيصال.
- أزرار قبول/رفض للتاجر.
- نموذج رفع إثبات للعميل إذا لم يكن الطلب مدفوعاً.

---

### 4. Server-side Cart و `/cart`

تم سابقاً بناء السلة السيرفرية، وتم الآن ربطها بشكل أفضل داخل الواجهة.

الصفحة:

```txt
/cart
```

APIs:

```txt
/api/cart
/api/cart/items/[id]
```

السلة:

- محفوظة على الخادم.
- تتزامن مع LocalStorage.
- تعيد تسعير المنتجات من قاعدة البيانات.
- تدعم حذف وتعديل الكمية.

---

### 5. Return / Refund Workflow

تم سابقاً بناء:

```txt
return_requests
return_request_items
```

والآن أصبحت تفاصيل الطلب تعرض طلبات الإرجاع والاسترداد مع أدوات التاجر والعميل.

---

## Migrations المطبقة

تم تطبيق:

```txt
0026_payment_receipts.sql
```

وتم التأكد من وجود:

```txt
payment_receipts
```

مع الفهارس:

```txt
payment_receipts_order_idx
payment_receipts_payment_idx
payment_receipts_store_idx
payment_receipts_user_idx
payment_receipts_reference_idx
```

---

## نتائج الفحص

تم تشغيل:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

النتائج:

```txt
lint: PASS
typecheck: PASS
tests: PASS
build: PASS
```

---

## ملاحظات

- لم يتم تشغيل `db:seed`.
- تم حذف `node_modules` و `.next` بعد الفحص للحفاظ على حجم المشروع.
- الحجم الحالي للمشروع حوالي 11MB بدون `.git`.

---

## ما تبقى لمرحلة الدفع المحلية النهائية

1. اختيار مزود دفع محلي فعلي وتوثيق API الخاص به.
2. إضافة provider plugin له داخل `lib/payments`.
3. إضافة webhook/callback له.
4. إضافة refund API حقيقي وليس يدوي فقط.
5. إضافة dashboard مالي للتسويات والمدفوعات والإرجاعات.
