# تقرير Production Stabilization + Server-side Cart + COD/Refund + Observability

التاريخ: 2026-07-01

## الهدف

إغلاق أخطر فجوات الإنتاج قبل إضافة مزايا جديدة عبر:

1. Production Stabilization Checklist.
2. Server-side Cart.
3. Payment/COD workflow.
4. Return/refund workflow.
5. Observability dashboard.

---

## 1. Production Stabilization Checklist

تمت إضافة:

```txt
lib/production/readiness.ts
app/admin/observability/page.tsx
app/api/admin/observability/production-readiness/route.ts
```

الداشبورد الجديد:

```txt
/admin/observability
```

يعرض:

- readiness score.
- حالة DATABASE_URL.
- JWT_SECRET.
- Redis.
- NEXT_PUBLIC_APP_URL.
- CRON_SECRET.
- Object Storage policy.
- Payment gateway readiness.
- negative stock.
- duplicate idempotency.
- duplicate inventory movements.
- failed/queued jobs.
- open returns.
- open security alerts.

---

## 2. Server-side Cart

تمت إضافة جداول:

```txt
shopping_carts
shopping_cart_items
```

ضمن migration:

```txt
drizzle/0025_cart_returns_production.sql
```

وتمت إضافة API:

```txt
app/api/cart/route.ts
app/api/cart/items/[id]/route.ts
```

الوظائف:

- تحميل سلة المستخدم من السيرفر.
- مزامنة LocalStorage cart إلى server-side cart عند دخول checkout.
- تعديل الكمية.
- حذف عنصر.
- تفريغ السلة بعد نجاح الشراء.
- إعادة تسعير المنتجات من قاعدة البيانات وعدم الاعتماد على سعر localStorage.

تم تحديث:

```txt
components/checkout/multi-store-checkout.tsx
```

بحيث يستخدم server-side cart كمرجع فعلي بعد المزامنة.

---

## 3. Payment / COD Workflow

تم تحسين الدفع:

- دعم `manual`.
- دعم `cod` الدفع عند الاستلام.
- دعم `stripe` كبوابة دفع فعلية.

تم تعديل:

```txt
lib/payments/gateway.ts
components/merchant/operations-settings-panel.tsx
```

في إعدادات التاجر، أصبح اختيار نوع الدفع أوضح:

```txt
manual
cod
stripe
```

الدفع عند الاستلام لا يحتاج redirect، ويعرض تعليمات واضحة للعميل.

---

## 4. Return / Refund Workflow

تمت إضافة جداول:

```txt
return_requests
return_request_items
```

ضمن migration:

```txt
drizzle/0025_cart_returns_production.sql
```

تمت إضافة APIs:

```txt
app/api/orders/[id]/returns/route.ts
app/api/merchant/returns/[id]/route.ts
```

العميل يستطيع بعد التسليم/الإغلاق:

- فتح طلب إرجاع.
- اختيار المنتجات والكميات.
- تحديد السبب والوصف.

التاجر يستطيع:

- قبول الإرجاع.
- رفضه.
- تسجيل الاستلام.
- تنفيذ استرداد يدوي.

عند refund:

- يتم تحديث `order_payments.status = refunded`.
- يتم تحديث `orders.paymentStatus = refunded`.
- يتم إرسال إشعار للعميل.

تمت إضافة مكونات:

```txt
components/orders/return-request-form.tsx
components/merchant/return-request-actions.tsx
```

وتحديث:

```txt
lib/order-details.ts
components/orders/order-detail-view.tsx
```

---

## 5. Observability Dashboard

تمت إضافة صفحة مراقبة إنتاجية:

```txt
/admin/observability
```

وتعرض مؤشرات مهمة:

- readiness.
- negative stock.
- queued jobs.
- failed jobs.
- checklist تفصيلي.

كما تمت إضافة API:

```txt
/api/admin/observability/production-readiness
```

---

## 6. Migrations الجديدة

تمت إضافة:

```txt
drizzle/0025_cart_returns_production.sql
```

وتحتوي على:

- shopping_carts
- shopping_cart_items
- return_requests
- return_request_items
- indexes و foreign keys اللازمة.

> لم يتم تطبيق هذه migration على قاعدة الإنتاج بعد في هذه الخطوة. يجب تطبيقها بمسار آمن قبل نشر الكود الجديد.

---

## 7. نتائج الفحص

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

## 8. ملاحظات تشغيل مهمة

1. يجب تطبيق migration:

```txt
0025_cart_returns_production.sql
```

قبل تشغيل النسخة الجديدة على production.

2. لم يتم تشغيل `db:seed`.
3. تم حذف `node_modules` و `.next` بعد الفحص حتى يبقى حجم المشروع صغيراً.
4. حجم المشروع بعد التنظيف حوالي 11MB بدون `.git`.

---

## 9. المرحلة التالية المقترحة

بعد تطبيق migration 0025 على الإنتاج:

1. ربط بوابة دفع محلية بجانب Stripe/COD.
2. تحسين صفحة Cart كاملة قبل Checkout.
3. إضافة refund provider integration عند استخدام بوابة دفع فعلية.
4. إضافة dashboard تفصيلي للعوائد والإرجاعات.
5. تشغيل k6 على staging بعد توفير البيانات.
