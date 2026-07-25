# تجهيز المشروع للإطلاق الحقيقي — 2026-07-03

## الهدف
تحويل المشروع من وضع تجربة مشتركة إلى وضع جاهز للإطلاق الحقيقي، بحيث يكون أكثر صرامة في:

- Redis production.
- DB pooler.
- Object Storage.
- Search resilience.
- Monitoring.
- Checkout duplicate protection.
- Load validation.

> لم يتم حذف أي feature، ولم يتم تنفيذ أي migration خطير. كل ما تم هو hardening برمجي وإعدادات تشغيلية.

---

## 1) وضع إطلاق إنتاجي صارم
تمت إضافة:

```txt
lib/production/launch-mode.ts
```

ويتم تفعيل الوضع الصارم عبر:

```env
PRODUCTION_LAUNCH_MODE=true
APP_ENV=production
NEXT_PUBLIC_APP_ENV=production
```

عند التفعيل، يبدأ النظام بالتصرف كمنصة إطلاق حقيقية وليس كتجربة.

---

## 2) DB Pooler Readiness
تم تحديث:

```txt
lib/db/index.ts
```

وأضيف دعم متغيرات:

```env
DB_POOL_MAX=3
POSTGRES_POOL_MAX=3
DB_IDLE_TIMEOUT_SECONDS=20
DB_CONNECT_TIMEOUT_SECONDS=10
DB_APPLICATION_NAME=salahsentar22-production
```

### الهدف
في بيئة Serverless مثل Vercel، كل instance قد يفتح connection pool خاص به. لو بقي `max=10` ومع عدة instances قد نصل سريعاً إلى connection exhaustion.

### الإعداد المقترح للإطلاق
- استخدم URL الـ pooler من مزود قاعدة البيانات في `DATABASE_URL`.
- اضبط:
  ```env
  DB_POOL_MAX=3
  ```
- أبقِ `prepare=false` لأنه متوافق مع PgBouncer/poolers.

---

## 3) Object Storage Fail-Closed
تم تحديث:

```txt
lib/media/index.ts
```

في وضع الإطلاق الصارم، يمنع النظام استخدام:

```txt
MEDIA_PROVIDER=local
MEDIA_PROVIDER=inline
```

ويفرض استخدام واحد من:

```txt
cloudinary
s3
r2
```

### السبب
المنصة تحتوي حالياً على صور base64 قديمة، وتم قياسها سابقاً بحوالي:

```txt
48 صفاً
24MB تقريباً
```

وهذا لا يصلح لإطلاق حقيقي.

### بعد ضبط Object Storage
شغّل:

```bash
npm run media:inline-audit
npm run media:inline-migrate
```

---

## 4) Checkout Idempotency إلزامي في Production Launch
تم تحديث:

```txt
app/api/orders/route.ts
```

في وضع الإطلاق الصارم، إذا لم يرسل العميل:

```http
Idempotency-Key: <unique-key>
```

يرجع API:

```txt
428 Precondition Required
```

### الهدف
منع:

- double click.
- duplicate checkout submissions.
- duplicate orders عند retry.

### التوافق
واجهات checkout الحالية ترسل `Idempotency-Key` بالفعل، لذلك لا يكسر منطق الشراء الحالي.

---

## 5) Search Optimization + Degraded Fallback
تم تعديل:

```txt
lib/enterprise/search-engine.ts
app/api/search/smart/route.ts
app/api/search/advanced/route.ts
lib/search/fallback.ts
```

### التحسينات
1. تقليل ضغط search analytics على DB عبر sampling:
   ```env
   SEARCH_ANALYTICS_SAMPLE_RATE=0.05
   ```
2. فشل تسجيل analytics لا يكسر البحث.
3. عند فشل محرك البحث أو DB مؤقتاً، يرجع API نتيجة degraded fallback بدلاً من 500.

### الهدف
في اختبار الضغط السابق ظهرت 500 في البحث تحت ضغط خفيف. الآن البحث يجب أن يفشل بشكل آمن للمستخدم، مع تسجيل الخطأ للمراقبة.

---

## 6) Cache Stampede Protection
تم سابقاً/ضمن التحضير تحسين:

```txt
lib/redis/cache.ts
```

بإضافة:

- in-process single-flight.
- Redis distributed cache lock.
- wait/retry قصير عند cache miss.

### الهدف
منع عشرات الطلبات من ضرب قاعدة البيانات عند انتهاء TTL في نفس اللحظة.

---

## 7) Audit Log Payload Protection
تم تحديث:

```txt
lib/audit.ts
```

وأضيف اختبار:

```txt
tests/audit-sanitizer.test.ts
```

### الهدف
منع تضخم `audit_logs` بسبب:

- base64.
- صور ضخمة.
- payloads كبيرة.

جدول `audit_logs` في قاعدة التجربة وصل إلى 123MB، وهذا كان مؤشر خطر.

---

## 8) Production Env Template
تم تحديث:

```txt
.env.production.example
.env.example
```

وأضيفت إعدادات:

```env
PRODUCTION_LAUNCH_MODE=true
DB_POOL_MAX=3
SEARCH_ANALYTICS_SAMPLE_RATE=0.05
MEDIA_PROVIDER=cloudinary|s3|r2
REDIS_REQUIRED=true
SENTRY_DSN=...
NEXT_PUBLIC_SENTRY_DSN=...
```

---

## 9) Launch Commands
تمت إضافة أوامر:

```bash
npm run launch:check
npm run load:probe
```

### launch:check
ينفذ:

```bash
npm run typecheck
npm run lint
npm test
npm audit --omit=dev --audit-level=high
npm run build
```

### load:probe
يشغّل probe خفيف على staging:

```bash
BASE_URL=https://staging.example.com npm run load:probe
```

---

## 10) فحوصات تم تنفيذها
تم تنفيذ:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm audit --omit=dev --audit-level=high
NEXT_TELEMETRY_DISABLED=1 npm run build
```

النتائج:

| الفحص | النتيجة |
|---|---|
| npm ci | ناجح |
| TypeScript | ناجح |
| ESLint | ناجح |
| Tests | 10 passed |
| npm audit high | 0 vulnerabilities |
| Build | ناجح |

---

## 11) ما يجب ضبطه في Vercel للإطلاق الحقيقي

### Redis
```env
REDIS_REQUIRED=true
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

### DB Pooler
```env
DATABASE_URL=<pooled connection url>
DB_POOL_MAX=3
DB_IDLE_TIMEOUT_SECONDS=20
DB_CONNECT_TIMEOUT_SECONDS=10
```

### Object Storage
Cloudinary مثالاً:

```env
MEDIA_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=marketplace
NEXT_IMAGE_REMOTE_HOSTS=res.cloudinary.com
```

أو R2/S3:

```env
MEDIA_PROVIDER=r2
S3_ENDPOINT=...
S3_REGION=auto
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=...
NEXT_IMAGE_REMOTE_HOSTS=<cdn-host>
```

### Monitoring
```env
SENTRY_DSN=...
NEXT_PUBLIC_SENTRY_DSN=...
SENTRY_TRACES_SAMPLE_RATE=0.05
```

### Launch Strict Mode
```env
PRODUCTION_LAUNCH_MODE=true
APP_ENV=production
NEXT_PUBLIC_APP_ENV=production
```

---

## 12) تشغيل بعد ضبط الخدمات
بعد إدخال المفاتيح الحقيقية على Vercel/Staging:

```bash
npm run production:readiness
npm run media:inline-audit
npm run media:inline-migrate
BASE_URL=https://your-staging-domain npm run load:probe
```

ثم شغّل k6 من جهاز/runner يحتوي k6:

```bash
k6 run -e BASE_URL=https://your-staging-domain scripts/load/k6-enterprise-readiness.js
```

ولـ checkout:

```bash
k6 run \
  -e BASE_URL=https://your-staging-domain \
  -e AUTH_COOKIE='mall_session=...' \
  -e STORE_ID='...' \
  -e PRODUCT_ID='...' \
  -e VARIANT_ID='...' \
  -e PAYMENT_METHOD_ID='...' \
  -e SHIPPING_METHOD_ID='...' \
  scripts/load/k6-checkout-inventory-concurrency.js
```

---

## الخلاصة
المشروع الآن مجهز برمجياً للانتقال من تجربة إلى إطلاق حقيقي:

- DB pooler configurable.
- Object Storage enforced in launch mode.
- Checkout idempotency mandatory in launch mode.
- Search fails gracefully instead of 500.
- Search analytics sampled.
- Cache stampede mitigation.
- Audit payload sanitizer.
- Launch check command.
- Load probe command.
- Production env template.

المتبقي هو إدخال مفاتيح الخدمات وتشغيل ترحيل الصور واختبارات الضغط الحقيقية.
