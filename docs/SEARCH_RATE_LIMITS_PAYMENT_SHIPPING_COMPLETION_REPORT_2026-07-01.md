# تقرير Search Scalability + Rate Limits + Payment/Shipment Completion

التاريخ: 2026-07-01

## 1. Search Scalability

تم تنفيذ أساس قابل للتوسع للبحث:

### PostgreSQL pg_trgm + GIN indexes

تمت إضافة migration:

```txt
drizzle/0024_search_pg_trgm_indexes.sql
```

يشمل:

- `CREATE EXTENSION IF NOT EXISTS pg_trgm`
- GIN trigram indexes على:
  - products: name, slug, product_code, barcode, english_name, brand
  - stores: name, slug, store_number, contact_phone
  - wings: name, slug
  - categories: name, slug
  - product_variants: sku, barcode, title

### Redis Search Cache

تمت إضافة:

```txt
lib/search/cache.ts
```

وتحديث:

```txt
app/api/search/smart/route.ts
app/api/search/advanced/route.ts
app/api/search/home/route.ts
```

النتيجة:

- cache قصير المدى لنتائج البحث.
- تقليل ضغط ILIKE/trigram queries عند البحث المتكرر.
- تصميم قابل لاحقاً للانتقال إلى Meilisearch/OpenSearch عبر نفس طبقة `lib/search`.

### Rate limits للبحث

تم تطبيق rate limits على:

```txt
/api/search/smart
/api/search/advanced
/api/search/home
```

مع Redis-backed rate limiter في production.

---

## 2. Load / Concurrency Tests

تمت إضافة سكربتات k6:

```txt
scripts/load/k6-search.js
scripts/load/k6-checkout.js
scripts/load/README.md
```

تغطي:

- ضغط البحث.
- p95 latency للبحث.
- checkout concurrency.
- فحص سلوك المخزون تحت الضغط.
- فحص عدم ظهور أخطاء 500.

---

## 3. Checkout Cycle Upgrade

تم تعزيز دورة checkout:

- صفحة `/checkout` تفصل السلة حسب المتجر.
- كل متجر له payment/shipping مستقل.
- لا يتم إنشاء طلب بدون وسيلة دفع وشحن مفعلة ومختارة.
- احترام أقل مبلغ طلب.
- دعم `autoAcceptOrders`.
- Rate limit على إنشاء الطلبات.

الملفات المهمة:

```txt
app/checkout/page.tsx
components/checkout/multi-store-checkout.tsx
app/api/checkout/options/route.ts
app/api/orders/route.ts
```

---

## 4. Payment Gateway Foundation

تمت إضافة بوابة دفع فعلية قابلة للتفعيل عبر Stripe:

```txt
lib/payments/gateway.ts
app/api/payments/checkout/route.ts
app/api/payments/stripe/webhook/route.ts
app/checkout/payment/[orderId]/page.tsx
components/payments/payment-start-panel.tsx
```

المزودات المدعومة الآن:

- manual payment: تعليمات دفع يدوية.
- stripe: إنشاء Checkout Session عبر Stripe API بدون حزمة إضافية.

متغيرات البيئة المطلوبة لتفعيل Stripe:

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

ملاحظة: Stripe لا يدعم كل العملات. إذا كان الطلب بعملة غير مدعومة مثل YER، سيُرفض الدفع الإلكتروني ويجب استخدام وسيلة دفع يدوية أو عملة مدعومة.

---

## 5. Shipment Tracking

تمت إضافة تحديث بيانات الشحن:

```txt
app/api/orders/[id]/shipment/route.ts
components/merchant/shipment-update-form.tsx
```

التاجر يستطيع الآن حفظ:

- شركة الشحن.
- رقم التتبع.
- حالة الشحنة.

كما تم ربط النموذج في صفحة تفاصيل طلب التاجر.

---

## 6. Order Closing Controls

تم تقوية تحديث حالة الطلب:

```txt
app/api/orders/[id]/status/route.ts
components/merchant/order-status-actions.tsx
```

الإضافات:

- تأكيد الدفع.
- فشل الدفع.
- استرداد.
- منع إغلاق الطلب قبل أن تكون حالة الدفع `paid`.
- تحديث `order_payments` عند تغيير حالة الدفع.

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

## 8. Migrations المطلوبة قبل الإنتاج

يجب تطبيق migrations التالية قبل نشر هذه النسخة:

```txt
0022_admin_promotional_offers.sql
0023_offer_promotion_package_text.sql
0024_search_pg_trgm_indexes.sql
```

لم يتم تشغيل `db:seed`.

---

## 9. الخطوة التالية المقترحة

1. تطبيق migrations عبر المسار الآمن كما فعلنا سابقاً.
2. ضبط Redis و Stripe env vars.
3. تشغيل k6 على بيئة staging.
4. مراقبة:
   - p95 search latency
   - p95 checkout latency
   - no negative stock
   - no duplicated idempotent orders
5. بعد ذلك ربط مزود دفع محلي إضافي إن رغبت.
