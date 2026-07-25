# خطة تحويل المشروع إلى بنية إنتاج قابلة للتوسع الحقيقي

التاريخ: 2026-07-01  
النطاق: Backend / Public Pages / Cache / Inventory / Redis / Search / Queue / Rate Limits / Security / Load Testing

## 0. الهدف الهندسي

تحويل المشروع من حالة "يعمل جيداً" إلى حالة "جاهز لتوسع إنتاجي حقيقي" بحيث تكون الصفحات العامة والعمليات الحساسة مصممة لتحمل:

- مئات الأجنحة.
- عشرات آلاف المتاجر.
- عشرات/مئات آلاف المنتجات.
- 70,000 زيارة يومياً مع ذروة أعلى بكثير من المتوسط.
- مئات آلاف العمليات اليومية.

القاعدة العامة في هذه المرحلة:

> لا نضيف مزايا تجارية كبيرة قبل تقوية الأساس: cache, DB, inventory correctness, Redis, security, queues, load tests.

---

## 1. ترتيب الأولويات التنفيذي

### P0 — إعادة هندسة الصفحات العامة والكاش

هذه هي الأولوية الأولى لأنها تقلل ضغط قاعدة البيانات مباشرة.

المطلوب:

1. فصل public render عن preview/admin.
2. إزالة `force-dynamic` و `revalidate = 0` من الصفحات العامة قدر الإمكان.
3. تحويل الصفحات العامة إلى ISR/cache-first.
4. إضافة Redis cache layer.
5. استخدام `unstable_cache` مع tags ومفاتيح واضحة.
6. منع ضرب قاعدة البيانات في كل زيارة عامة.
7. نقل الأحداث غير الضرورية مثل `viewCount` إلى queue/background أو endpoint منفصل مخفف.

الصفحات العامة المستهدفة أولاً:

- `app/page.tsx` — موجود بها ISR حالياً، سنقوي مصدر البيانات بالكاش.
- `app/store/[slug]/page.tsx` — حالياً dynamic/revalidate=0 ويجب فصل public عن preview.
- `app/store/[slug]/products/[productSlug]/page.tsx` — حالياً dynamic/revalidate=0 وفيها تحديث `viewCount` داخل request.
- `app/wings/[slug]/page.tsx` — حالياً dynamic/revalidate=0.
- `app/offers/page.tsx` — حالياً dynamic/revalidate=0.
- `app/wings/page.tsx` — لديها revalidate=120، سننقل queries إلى cache layer.

مبدأ التنفيذ:

- Public page = cache-first.
- Preview page أو `?preview=1` = dynamic + require auth + no cache.
- Admin/Merchant pages تبقى dynamic لأنها مرتبطة بجلسة وصلاحيات.

---

### P1 — Redis Infrastructure إلزامي

قبل توسيع rate limits والكاش والـ idempotency، يجب بناء Redis abstraction واحدة.

المطلوب:

1. إنشاء Redis client موحد.
2. منع memory fallback في production.
3. استخدام Redis في:
   - rate limiting.
   - caching.
   - idempotency.
   - distributed locks.
   - hot store/product cache.
   - queues لاحقاً.
4. دعم Upstash REST للـ Vercel، ودعم Redis URL/BullMQ للبيئات الدائمة.

قاعدة production:

> إذا `NODE_ENV=production` ولا توجد Redis env صحيحة، يفشل التطبيق في المسارات الحساسة ولا يستخدم memory fallback.

---

### P2 — Atomic Inventory System

هذه أولوية حاسمة قبل التوسع في الطلبات.

المطلوب:

1. `atomic stock reservation` عند إنشاء الطلب.
2. `conditional update` داخل transaction:
   - لا يتم الحجز إلا إذا `stock_quantity >= requested_qty`.
3. منع overselling تحت التزامن.
4. idempotency key لإنشاء الطلب.
5. منع الخصم المزدوج عند تغيير حالة الطلب.
6. فصل reservation عن deduction بوضوح.
7. سجل حركات مخزون محكم وقابل للمراجعة.

مبدأ SQL:

```sql
UPDATE product_variants
SET stock_quantity = stock_quantity - $qty,
    updated_at = now()
WHERE id = $variantId
  AND stock_quantity >= $qty
RETURNING id, stock_quantity;
```

إذا لم تعد أي row، العملية تفشل بسبب نقص المخزون أو التنافس.

---

### P3 — Rate Limits شاملة عبر Redis

المطلوب تطبيق rate limits على:

- search.
- create order.
- auth/login.
- auth/forgot-password.
- auth/reset-password.
- media upload.
- product mutations.
- admin mutations.
- merchant mutations الحساسة.
- checkout/status updates.

كلها يجب أن تستخدم Redis backend في الإنتاج.

---

### P4 — إعادة هندسة البحث باستخدام pg_trgm

المرحلة الحالية لا تنتقل فوراً إلى Meilisearch، بل نجهز PostgreSQL ليستحمل.

المطلوب:

1. تفعيل extension:
   - `pg_trgm`
   - ويفضل لاحقاً `unaccent` إن احتجنا.
2. GIN trigram indexes على:
   - `stores.name`
   - `stores.slug`
   - `stores.store_number`
   - `products.name`
   - `products.slug`
   - `products.product_code`
   - `products.barcode`
   - `products.english_name`
   - `wings.name`
   - `categories.name`
3. بناء search service abstraction:
   - `postgresTrgmSearchProvider` حالياً.
   - واجهة قابلة للاستبدال لاحقاً بـ Meilisearch.
4. Cache لنتائج البحث الشائعة قصيرة المدة.

---

### P5 — Queue / Background Jobs Architecture

الهدف: فصل الأعمال الثقيلة عن دورة request/response.

المطلوب:

- notifications.
- emails.
- SMS.
- image processing.
- analytics/events.
- view counts.
- background sync.
- cache warmup.

البنية المقترحة:

- BullMQ عند توفر Redis TCP في worker environment.
- Upstash QStash أو جدول DB-backed jobs كبديل serverless إذا كانت البيئة Vercel فقط.
- واجهة موحدة `enqueueJob()` حتى لا يرتبط الكود بمزود محدد.

---

### P6 — Security Hardening

المطلوب:

1. MFA إجباري للأدمن.
2. منع base64 images بالكامل باستثناء signatures.
3. فرض Object Storage في production:
   - Cloudinary أو S3/R2.
4. مراجعة IDOR route-by-route.
5. اعتماد authorization layer موحدة في كل route حساس.
6. تشديد reset password/rate limits.
7. مراجعة CSP لاحقاً لتقليل `unsafe-inline`.

---

### P7 — Load Testing & Observability

المطلوب:

- k6 أو Artillery.
- سيناريوهات:
  - home.
  - store page.
  - product page.
  - search.
  - login.
  - checkout/create order.
  - merchant dashboard.

التقارير:

- p95 latency.
- p99 latency.
- error rate.
- RPS.
- DB bottlenecks.
- slow queries.
- lock/contention behavior.
- cache hit ratio.

---

## 2. الملفات والمسارات المتوقع تغييرها

### 2.1 ملفات جديدة مقترحة

```txt
lib/redis/client.ts
lib/redis/cache.ts
lib/redis/rate-limit.ts
lib/redis/idempotency.ts
lib/redis/locks.ts

lib/cache/public-cache.ts
lib/cache/cache-tags.ts
lib/cache/public-store-cache.ts
lib/cache/public-product-cache.ts
lib/cache/public-home-cache.ts
lib/cache/search-cache.ts

lib/inventory/atomic-inventory.ts
lib/orders/idempotency.ts
lib/orders/order-workflow.ts

lib/search/search-provider.ts
lib/search/postgres-trgm-provider.ts
lib/search/types.ts

lib/queue/index.ts
lib/queue/types.ts
lib/queue/providers/bullmq.ts
lib/queue/providers/db.ts
lib/queue/jobs/notifications.ts
lib/queue/jobs/analytics.ts
lib/queue/jobs/media.ts

lib/security/base64-guard.ts
lib/security/admin-mfa-policy.ts

scripts/load/k6-home.js
scripts/load/k6-store.js
scripts/load/k6-product.js
scripts/load/k6-search.js
scripts/load/k6-checkout.js
scripts/load/k6-merchant-dashboard.js
scripts/load/run-k6.sh

scripts/db/slow-query-check.sql
scripts/db/index-health.sql

docs/PRODUCTION_SCALE_RUNBOOK.md
docs/REDIS_INFRASTRUCTURE.md
docs/ATOMIC_INVENTORY.md
docs/LOAD_TESTING.md
```

### 2.2 ملفات سيتم تعديلها

#### Public pages/cache

```txt
app/page.tsx
app/store/[slug]/page.tsx
app/store/[slug]/products/[productSlug]/page.tsx
app/wings/page.tsx
app/wings/[slug]/page.tsx
app/offers/page.tsx

lib/db/queries.ts
lib/home-visibility.ts
lib/home-content.ts
lib/welcome-popup.ts
lib/advertising-settings.ts
lib/currency.ts
```

#### API cache invalidation

أي route يغير بيانات عامة يجب أن يطلق cache invalidation tags:

```txt
app/api/admin/wings/**
app/api/admin/stores/**
app/api/admin/banners/**
app/api/admin/announcements/**
app/api/admin/news/**
app/api/admin/home-content أو home-sections/**
app/api/admin/home-visibility/**
app/api/merchant/products/**
app/api/merchant/store-media/**
app/api/merchant/store-settings/**
app/api/merchant/announcements/**
app/api/merchant/news/**
app/api/merchant/offers/**
```

#### Redis/rate limit

```txt
lib/rate-limit.ts
middleware.ts
app/api/auth/login/route.ts
app/api/auth/forgot-password/route.ts
app/api/auth/reset-password/route.ts
app/api/search/home/route.ts
app/api/search/smart/route.ts
app/api/search/advanced/route.ts
app/api/orders/route.ts
app/api/media/upload/route.ts
```

#### Atomic inventory/orders

```txt
app/api/orders/route.ts
app/api/orders/[id]/status/route.ts
lib/order-details.ts
services/order.service.ts
lib/enterprise/wallet.ts
lib/notifications.ts
```

#### Search

```txt
lib/smart-search.ts
app/api/search/home/route.ts
app/api/search/smart/route.ts
app/api/search/advanced/route.ts
services/product.service.ts
services/store.service.ts
```

#### Security/base64/MFA

```txt
lib/validators.ts
lib/media/index.ts
services/media.service.ts
app/api/media/upload/route.ts
app/api/admin/**/route.ts
app/api/merchant/**/route.ts
app/api/auth/mfa/**
app/api/auth/login/route.ts
middleware.ts أو lib/auth.ts
```

#### DB schema/migrations

```txt
lib/db/schema.ts
drizzle/0020_scale_foundation_indexes.sql أو migration جديد باسم متسلسل
```

جداول/فهارس متوقعة:

- `idempotency_keys`
- `inventory_reservations` أو تحسين `inventory_movements` بقيود واضحة.
- `background_jobs` إذا استخدمنا DB-backed queue fallback.
- indexes مركبة للـ public pages.
- GIN trigram indexes.

---

## 3. خطة التنفيذ التفصيلية

### المرحلة 1 — Public Cache + Redis Foundation

#### 1.1 إنشاء Redis abstraction

- `lib/redis/client.ts`
- يدعم:
  - Upstash REST.
  - Redis URL لاحقاً.
- في production: لا fallback memory.

#### 1.2 إنشاء cache utilities

- `cacheGet/cacheSet/cacheRemember/cacheInvalidate`.
- مفاتيح واضحة:
  - `home:v1`
  - `store:public:{slug}:v1`
  - `product:public:{storeSlug}:{productSlug}:v1`
  - `wing:public:{slug}:v1`
  - `offers:public:v1`

#### 1.3 استخدام unstable_cache

- تغليف query functions وليس الصفحة نفسها فقط.
- tags:
  - `home`
  - `stores`
  - `store:{id}`
  - `store-slug:{slug}`
  - `products`
  - `product:{id}`
  - `wings`
  - `offers`

#### 1.4 فصل Preview

- public route يستخدم cache.
- إذا `preview=1`:
  - require auth.
  - bypass cache.
  - force fresh DB read.

#### 1.5 إزالة view count المباشر

في المنتج العام حالياً يتم:

```ts
await db.update(products).set({ viewCount: sql`${products.viewCount} + 1` })...
```

سننقله إلى:

- Queue job: `analytics.product_view`.
- أو endpoint batched مع rate limit.

---

### المرحلة 2 — Atomic Inventory + Idempotency

#### 2.1 إضافة idempotency

جدول مقترح:

```txt
idempotency_keys
- id
- scope
- key
- user_id
- request_hash
- response_body
- status
- locked_until
- expires_at
- created_at
- updated_at
```

#### 2.2 إنشاء order idempotency helper

- يعتمد على header:
  - `Idempotency-Key`
- أو body key احتياطياً.
- يمنع تكرار الطلب عند retry من العميل.

#### 2.3 atomic reservation

- تحديث مخزون variants بشرط `stock_quantity >= qty`.
- إدخال `inventory_movements` بنوع `reserve` أو `deduct` حسب التصميم النهائي.
- فشل كامل transaction إذا منتج واحد لا يكفي.

#### 2.4 منع الخصم المزدوج

- تحقق بقيد unique أو idempotency movement reference.
- إضافة reference واضحة إلى حركة المخزون:
  - `orderId`
  - أو `referenceType/referenceId` إن أضفنا أعمدة.

---

### المرحلة 3 — Search Hardening

#### 3.1 migration للـ pg_trgm

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

#### 3.2 GIN indexes

أمثلة:

```sql
CREATE INDEX IF NOT EXISTS products_name_trgm_idx
ON products USING gin (name gin_trgm_ops);
```

#### 3.3 search provider interface

```ts
type SearchProvider = {
  searchProducts(input): Promise<SearchResult[]>;
  searchStores(input): Promise<SearchResult[]>;
  searchWings(input): Promise<SearchResult[]>;
};
```

#### 3.4 Redis cache للبحث

- TTL قصير: 30-120 ثانية.
- مفتاح normalized query.
- rate limit على search.

---

### المرحلة 4 — Queue Architecture

#### 4.1 Job abstraction

- `enqueueJob(type, payload, options)`.
- providers:
  - BullMQ.
  - DB-backed أو no-op dev provider.

#### 4.2 نقل العمليات الثقيلة

- notifications بعد إنشاء الطلب.
- notifyAdmins.
- wallet loyalty إن كانت ثقيلة.
- analytics view counts.
- emails/SMS.

---

### المرحلة 5 — Rate Limits شاملة

#### 5.1 rate scopes

```txt
auth:login
auth:forgot-password
auth:reset-password
search:smart
search:home
orders:create
orders:update-status
media:upload
merchant:products:mutation
admin:mutation
```

#### 5.2 تطبيق helper موحد

- `requireRateLimit(scope, { limit, windowMs, keyParts })`.
- يرجع headers:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

---

### المرحلة 6 — Security Hardening

#### 6.1 MFA إجباري للأدمن

- عند login admin بدون MFA:
  - يسمح فقط بإعداد MFA.
  - يمنع دخول لوحة الأدمن حتى التفعيل.

#### 6.2 منع base64

- تعديل `isUrlOrPath` في `lib/validators.ts` لمنع `data:image`.
- إبقاء `contractSignatureSchema` فقط يسمح بالتوقيع.
- تطبيق sanitizer في routes.

#### 6.3 Object storage production guard

- إذا production و`MEDIA_PROVIDER=local` أو `inline`:
  - رفض uploads.
  - إظهار خطأ واضح.

#### 6.4 IDOR audit

- قائمة routes حساسة.
- كل route يجب أن يستخدم:
  - `requireAdmin`
  - `requireStoreAccess`
  - `requireProductOwnership`
  - `requireOrderAccess`

---

### المرحلة 7 — Load Testing

#### 7.1 k6 scripts

- public browsing.
- store hot traffic.
- product traffic.
- search bursts.
- login bursts.
- checkout concurrency.
- merchant dashboard.

#### 7.2 Acceptance thresholds أولية

```txt
Public home/store/product p95: <= 500ms بعد cache warmup
Search p95: <= 800ms
Create order p95: <= 1200ms
Error rate: < 1%
No overselling under concurrent checkout
Redis required in production
DB slow queries documented and reduced
```

---

## 4. تقدير المخاطر

### خطر 1 — stale data بسبب الكاش

المشكلة: قد يرى الزائر بيانات متجر/منتج قديمة بعد تعديل التاجر.

المعالجة:

- TTL محدود.
- cache tags.
- invalidation عند mutations.
- preview bypass cache.

### خطر 2 — تعقيد Redis في بيئة Vercel

المشكلة: BullMQ يحتاج Redis TCP وworker دائم، بينما Upstash REST لا يناسب BullMQ التقليدي.

المعالجة:

- فصل queue interface عن provider.
- استخدام DB-backed/QStash عند serverless.
- BullMQ عند وجود worker دائم.

### خطر 3 — كسر صفحات عامة أثناء فصل preview

المعالجة:

- تنفيذ تدريجي.
- اختبارات build/typecheck.
- smoke tests للروابط العامة.

### خطر 4 — تغييرات المخزون قد تؤثر على الطلبات الحالية

المعالجة:

- إضافة migration محافظة.
- الحفاظ على `inventory_movements`.
- اختبارات تزامن للطلبات.
- عدم تغيير واجهة العميل إلا للضرورة.

### خطر 5 — pg_trgm indexes تزيد حجم قاعدة البيانات

المعالجة:

- اختيار الحقول الأهم فقط في البداية.
- مراقبة حجم indexes.
- استخدام EXPLAIN ANALYZE.

### خطر 6 — منع base64 قد يكسر مدخلات قديمة

المعالجة:

- منع الكتابات الجديدة فقط.
- قراءة القديم عبر inline proxy مؤقتاً.
- خطة migration لاحقة لنقل base64 القديم إلى object storage.

---

## 5. هل نحتاج refactor جزئي قبل الاستمرار بإضافة مزايا؟

نعم، نحتاج refactor جزئي ومحدد، وليس إعادة كتابة كاملة.

### المطلوب refactor حالياً

1. طبقة كاش عامة بدل DB calls مباشرة في public pages.
2. طبقة Redis موحدة بدل استخدامات متفرقة وmemory fallback.
3. طبقة Inventory/Order workflow بدل منطق المخزون داخل route مباشرة.
4. طبقة Search provider بدل `ILIKE` موزع في routes/services.
5. طبقة Queue موحدة بدل تنفيذ notifications/analytics داخل request.
6. توحيد authorization/rate-limit helpers في route handlers.

### ما لا نحتاجه الآن

- لا نعيد بناء الواجهات من الصفر.
- لا نغير Drizzle/PostgreSQL.
- لا ننقل فوراً إلى microservices.
- لا نضيف Meilisearch الآن، فقط نجعل التصميم قابلاً له.

---

## 6. بوابات القبول قبل اعتبار المرحلة ناجحة

لا تعتبر المرحلة ناجحة إلا إذا:

1. `npm run lint` ينجح.
2. `npm run typecheck` ينجح.
3. `npm test` ينجح.
4. `npm run build` ينجح.
5. Redis مطلوب في production ولا يوجد memory fallback حساس.
6. public store/product لا تضرب DB في كل زيارة بعد cache warmup.
7. إنشاء الطلب لا يسمح بالـ overselling في اختبار تزامن.
8. البحث يستخدم pg_trgm indexes.
9. rate limits مطبقة على المسارات الحساسة.
10. load test scripts موجودة وتنتج تقرير p95/error rate.

---

## 7. ترتيب التنفيذ العملي المقترح

### Sprint A — Foundation

1. Redis client/cache/rate/idempotency primitives.
2. Public cache layer.
3. Store/product public page cache-first.
4. Cache invalidation عند mutations الأساسية.

### Sprint B — Correctness

1. Idempotency table/helpers.
2. Atomic inventory reservation.
3. Refactor order creation/status update.
4. Tests للتزامن ومنع overselling.

### Sprint C — Search & Rate Limits

1. pg_trgm migration.
2. Search provider abstraction.
3. Search cache.
4. Rate limits شاملة.

### Sprint D — Queue & Security

1. Queue abstraction.
2. نقل notifications/view counts للـ background.
3. MFA admin policy.
4. base64/object storage hardening.
5. IDOR audit checklist وتعديل routes الحرجة.

### Sprint E — Load Testing

1. k6 scripts.
2. تقارير latency/concurrency.
3. slow query analysis.
4. ضبط indexes/cache/pool بناء على النتائج.
