# Enterprise Readiness Audit + Load & Scalability Validation — 2026-07-03

## 0) نطاق المهمة والقيود
تم التعامل مع المشروع كمنصة Marketplace Enterprise متعددة التجار تستهدف **70,000 مستخدم**. تم تنفيذ:

- مراجعة معمارية للكود.
- فحص قاعدة بيانات staging/shared.
- فحص Redis/cache/rate limit.
- فحص checkout/inventory/idempotency.
- تجهيز k6 scripts احترافية.
- تنفيذ probe ضغط خفيف على رابط Vercel المنشور لقياس مؤشرات أولية.
- تحسينات قابلة للقياس بدون كسر business logic أو تغيير schema.

### قيود مهمة
- لم يتم تنفيذ k6 الحقيقي داخل sandbox لأن binary `k6` غير مثبت:
  ```txt
  k6: command not found
  ```
- اختبارات checkout/cart/admin/merchant المحمية تحتاج cookies وبيانات staging مخصصة:
  ```txt
  AUTH_COOKIE, ADMIN_COOKIE, MERCHANT_COOKIE, STORE_ID, PRODUCT_ID, VARIANT_ID,
  PAYMENT_METHOD_ID, SHIPPING_METHOD_ID
  ```
- لذلك تم تنفيذ **Controlled HTTP Probe** على endpoints العامة فقط، وتم تجهيز k6 scripts لتشغيلها فوراً على runner/staging مناسب.

---

## 1) ما تم تحسينه أثناء التدقيق

### 1.1 منع cache stampede
تم تحسين:

```txt
lib/redis/cache.ts
```

بإضافة:
- in-process single-flight map.
- Redis distributed cache lock عند توفر Redis.
- انتظار قصير لمنع thundering herd عند cache miss.

هذا يقلل احتمال أن تضرب عشرات الطلبات قاعدة البيانات في نفس اللحظة عند انتهاء TTL.

### 1.2 تقليل bloat في audit logs مستقبلاً
تم تحسين:

```txt
lib/audit.ts
```

بإضافة sanitizer يحذف/يختصر:
- صور base64.
- media-like fields الكبيرة.
- strings طويلة.
- arrays كبيرة.

سبب ذلك أن جدول `audit_logs` وصل إلى 123MB مع 548 صف فقط، وهذا مؤشر أن بعض السجلات كانت تحمل payloads ضخمة مثل صور base64.

### 1.3 k6 Enterprise scripts
تمت إضافة:

```txt
scripts/load/k6-enterprise-readiness.js
scripts/load/k6-checkout-inventory-concurrency.js
scripts/load/staging-http-probe.mjs
scripts/load/README.md
```

وتغطي:
- Homepage traffic.
- Product browsing.
- Search.
- Public API concurrency.
- Authenticated admin/merchant dashboards عند توفر cookies.
- Cart operations.
- Checkout flow.
- Concurrent order creation.
- Inventory conflict visibility.

### 1.4 تشغيل ANALYZE على قاعدة staging
تم تشغيل `ANALYZE` لتحسين إحصاءات planner بعد أن كانت `n_live_tup` غير محدثة. ظهرت تحذيرات صلاحيات على جداول النظام فقط، لكن التحليل اكتمل للجداول المتاحة.

### 1.5 معالجة jobs المعلقة
قبل المعالجة كان هناك 12 job queued. تم تشغيل worker:

```bash
npm run jobs:process
```

النتيجة:

```txt
claimed: 12
completed: 12
failed: 0
```

بعدها أصبحت كل الوظائف الحالية completed.

---

## 2) Infrastructure & Scalability Audit

### 2.1 Redis Integration
الحالة:
- طبقة Redis موجودة: cache + rate limit + tags + pipeline.
- في بيئة التجربة الحالية Redis غير مفعل و`REDIS_REQUIRED=false`.
- هذا مناسب للفريق فقط، غير مناسب لإطلاق كبير.

المخاطر:
- rate limiting بالذاكرة لا يعمل بشكل موزع على serverless.
- cache غير موزع يعني cache misses متكررة.
- احتمالية DB pressure عالية عند traffic spikes.

التحسين المنفذ:
- أضفنا stampede protection في `cacheRememberJson`.

الحكم:
- Code readiness جيد.
- Infrastructure readiness غير كافٍ حتى يتم تفعيل Redis managed.

---

### 2.2 Database Performance
فحص قاعدة staging:

```txt
PostgreSQL: 18.4
DB size: 227MB
Connections during audit: 20/100
Connections observed during probe: up to 32/100
```

أكبر الجداول حجماً:

| الجدول | الحجم | ملاحظة |
|---|---:|---|
| audit_logs | 123MB | bloat بسبب payloads كبيرة؛ تم منع التكرار مستقبلاً |
| media_assets | 34MB | metadata/inline media أثرها واضح |
| product_variants | 15MB | صور/بيانات متغيرات |
| products | 11MB | صور/بيانات منتجات |
| banners | 9.8MB | base64 قديم |
| wings | 5.9MB | صور base64 قديمة |

فحوصات consistency:

| الفحص | النتيجة |
|---|---:|
| negative stock | 0 |
| duplicate idempotency | 0 |
| duplicate inventory movement | 0 |
| order items <= 0 | 0 |
| cart stale pricing | 0 |
| order/payment amount mismatch | 0 |
| closed unpaid except refunded | 0 |
| failed jobs | 0 |
| queued jobs بعد المعالجة | 0 |

مؤشرات إيجابية:
- الفهارس الحرجة موجودة، مثل:
  - `orders_customer_created_at_idx`
  - `orders_store_status_idx`
  - `shopping_cart_items_cart_variant_unique`
  - `idempotency_keys_scope_key_unique`
  - `inventory_movements_order_variant_reserve_unique`
  - `background_jobs_queue_dedupe_unique`
  - search trigram indexes

نقطة اختناق مستقبلية:
- `postgres.js` يستخدم `max: 10` لكل serverless instance. عند scale out في Vercel قد يتم استهلاك 100 اتصال سريعاً.
- يجب استخدام connection pooler أو تقليل max أو قاعدة serverless مناسبة.

---

### 2.3 Queue Readiness
الحالة:
- جدول `background_jobs` موجود.
- dedupe key موجود.
- retry/backoff موجود.
- processor موجود.
- Vercel cron تم ضبطه سابقاً.

النتيجة الحالية:
```txt
failed jobs: 0
queued jobs: 0 بعد المعالجة
```

المخاطر:
- Vercel Cron وحده مناسب كبداية، لكن عند scale عالي يفضل worker دائم أو queue managed.
- لا يوجد dead-letter dashboard متقدم بعد.

---

### 2.4 API Scalability
المؤشرات:
- APIs المهمة تستخدم pagination/limits في عدة أماكن.
- بعض admin APIs لا تزال تنفذ queries كبيرة لكنها محدودة غالباً بـ 50/100/200.
- Public search كان تحت probe أكثر نقطة حساسة.

مخاطر:
- search بدون Redis فعلي يعتمد على DB وserverless cold starts.
- protected dashboards SSR قد تكون مكلفة عند تعدد الموظفين.
- بعض endpoints تستخدم عمليات تسلسلية بعد mutations مثل audit + revalidate + notifications.

---

### 2.5 Checkout Stability
نقاط القوة:
- order creation داخل transaction.
- stock reserve atomic:
  ```sql
  update product_variants set stock_quantity = stock_quantity - qty where stock_quantity >= qty
  ```
- idempotency موجود عند إرسال header.
- invoice + order items + payment + shipment + notifications داخل transaction.
- لا يوجد stock negative في الفحص.
- لا يوجد duplicate inventory movements.

نقطة ضعف عالية الأهمية:
- `Idempotency-Key` اختياري وليس إجبارياً. إذا ضغط العميل زر الشراء مرتين بدون header يمكن إنشاء طلبين طالما يوجد مخزون.

التوصية:
- تحديث العميل دائماً لإرسال idempotency key.
- لاحقاً جعل API يرفض checkout بدون idempotency key في production عبر feature flag.

---

### 2.6 Session Handling
نقاط القوة:
- JWT + DB session row.
- requireAuth يفحص user status وsession revocation وfresh roles.
- lastSeenAt لا يحدث في كل طلب بل كل 5 دقائق تقريباً.

مخاطر:
- middleware يتحقق مبدئياً من JWT roles، لكن الصفحات/APIs تفحص DB لاحقاً. هذا مقبول، لكنه يعني أن الحماية النهائية تعتمد على route-level checks.
- عند ضغط عالي، requireAuth يضيف DB reads للصفحات المحمية؛ يمكن تحسينه لاحقاً بـ short-lived session cache في Redis.

---

### 2.7 Inventory Consistency
نقاط القوة:
- reserve/release/deduct idempotent عبر unique indexes.
- cancellation يعيد reserve/deduct حسب نوع الحركة.
- الفحص الحالي:
  ```txt
  negative stock: 0
  duplicate stock movements: 0
  ```

مخاطر مستقبلية:
- high contention على variant واحد سيؤدي إلى 409 وهذا صحيح، لكن يحتاج UX واضح.
- لا توجد backorder/reservation expiry بعد.

---

### 2.8 Dashboard Performance
نقاط القوة:
- معظم قوائم admin/merchant فيها pagination وحدود.
- صفحة الإعلانات تم تحسينها بإيقاف تحميل base64 داخل SSR.

مخاطر:
- كثرة SSR dynamic في لوحات الإدارة والتاجر.
- عند 70k مستخدم وكثرة التجار، dashboards الثقيلة ستحتاج:
  - summary tables/materialized views.
  - Redis cache للإحصائيات.
  - فصل analytics عن transactional DB.

---

## 3) Redis Architecture Validation

| المحور | الحالة | الحكم |
|---|---|---|
| caching strategy | موجودة public cache + search cache | جيد برمجياً |
| session caching | غير موجودة؛ الاعتماد على DB/JWT | مقبول الآن، يحتاج Redis عند scale |
| rate limiting | Redis أو memory fallback | يجب Redis في production |
| cart storage | DB وليس Redis | صحيح للاتساق، قد يضغط DB لاحقاً |
| analytics caching | محدود/placeholder | يحتاج Redis counters أو queue aggregation |
| invalidation | tags + path revalidate | جيد، يحتاج مراقبة duplicate invalidation |
| TTL management | موجود وقصير للبحث/العامة | جيد |
| cache stampede | تم تحسينه الآن | تحسن مهم |
| unbounded growth | مفاتيح search محددة بطول وTTL | مقبول |
| stale cache خطير | TTL قصيرة + invalidation | مقبول، بشرط Redis فعلي |

الحكم النهائي لRedis:
- كود Redis جيد كقاعدة.
- تشغيل المنصة لـ70k بدون Redis فعلي غير مقبول.

---

## 4) Checkout & Inventory Consistency Audit

### Add to cart
- server-side cart موجود.
- unique `(cart_id, variant_id)` يمنع تكرار نفس المتغير داخل السلة.
- price snapshot يحفظ وقت الإضافة، لكن checkout يعيد التسعير من variant الحالي، وهذا يمنع stale pricing في الطلب.

### Checkout / order creation
- transaction جيدة.
- idempotency موجود عند header.
- stock atomic.
- coupon redemption داخل transaction.
- payment row pending.

### Cancellation/refund
- cancellation يعيد المخزون.
- refund foundation موجود.
- ledger refund موجود.

### المخاطر المكتشفة
| الخطر | الخطورة | الملاحظة |
|---|---|---|
| duplicate checkout بدون idempotency header | عالية | يجب إجبار client على idempotency key |
| ضغط variant واحد | متوسطة | سيظهر 409 عند نفاد المخزون؛ هذا صحيح |
| payment provider mismatch | متوسطة | يحتاج بوابة فعلية وتوقيع webhooks |
| refund automation | متوسطة | يعتمد على provider حقيقي |

---

## 5) Load Testing Results

### 5.1 k6 readiness
تم تجهيز k6 scripts:

```txt
scripts/load/k6-enterprise-readiness.js
scripts/load/k6-checkout-inventory-concurrency.js
scripts/load/k6-search.js
scripts/load/k6-checkout.js
```

لكن لم يتم تنفيذ k6 binary داخل sandbox لأنه غير مثبت:

```txt
k6: command not found
```

كما أن checkout/admin/merchant load يحتاج cookies وIDs مخصصة.

### 5.2 Controlled Staging HTTP Probe — تشغيل فعلي على Vercel
تم تشغيل probe خفيف على:

```txt
https://salahsentar22.vercel.app
```

الإعداد:

```txt
مدة: 30 ثانية
Concurrency: 8
Endpoints عامة فقط
```

#### Run #1
| endpoint | count | error rate | p50 | p95 | p99 |
|---|---:|---:|---:|---:|---:|
| homepage | 13 | 0% | 64ms | 1389ms | 1389ms |
| offers | 17 | 0% | 558ms | 10048ms | 10048ms |
| wings | 13 | 0% | 3726ms | 10198ms | 10198ms |
| track_order | 7 | 0% | 531ms | 9007ms | 9007ms |
| smart_search | 10 | 50% | 5092ms | 9880ms | 9880ms |
| advanced_search | 8 | 50% | 8028ms | 14142ms | 14142ms |
| health | 9 | 0% | 148ms | 1938ms | 1938ms |

#### Run #2
| endpoint | count | error rate | p50 | p95 | p99 |
|---|---:|---:|---:|---:|---:|
| homepage | 14 | 0% | 69ms | 186ms | 186ms |
| offers | 20 | 55% client timeout | 15000ms | 15002ms | 15003ms |
| wings | 10 | 10% timeout | 1092ms | 15000ms | 15000ms |
| track_order | 7 | 42.86% timeout | 4541ms | 15001ms | 15001ms |
| smart_search | 2 | 50% | 1189ms | 2861ms | 2861ms |
| advanced_search | 5 | 60% | 2842ms | 15000ms | 15000ms |
| health | 11 | 0% | 150ms | 221ms | 221ms |

### تفسير النتائج
هذه النتائج لا تمثل k6 رسمي، لكنها تكشف مؤشرات مهمة:

1. الصفحة الرئيسية عندما تكون cache warm جيدة.
2. `/offers`, `/wings`, `/track-order` تعاني من SSR/DB/cold-start أو payload/cache misses.
3. search endpoints أعطت 500 تحت ضغط خفيف، وهذا Critical قبل الإطلاق الكبير.
4. health endpoint مستقر، ما يعني أن المشكلة ليست انقطاعاً كاملاً بل endpoints ثقيلة/DB/cache.
5. غياب Redis/Object Storage في بيئة التجربة يفسر جزءاً كبيراً من التذبذب.

---

## 6) Observability & Monitoring

### الموجود
- logger بسيط للـ background jobs.
- queue observability API.
- readiness endpoint.
- Sentry foundation تمت إضافته سابقاً.

### المطلوب للإنتاج
| المجال | التوصية |
|---|---|
| Error tracking | Sentry DSN server/client |
| Metrics | Vercel Analytics + provider metrics |
| Tracing | OpenTelemetry لاحقاً |
| DB monitoring | slow query logging + pg_stat_statements إن توفر |
| Redis monitoring | Upstash metrics: hit rate, memory, evictions |
| Queue monitoring | dashboard للfailed/retry/lag |
| Alerts | Slack/Email/WhatsApp عند 5xx أو failed jobs أو DB connections |

---

## 7) Architecture Readiness for 50k/70k users

### هل المنصة جاهزة لـ70,000 مستخدم؟
- **70,000 مستخدم مسجل/زائر شهري**: ممكن بعد تفعيل Redis/CDN/Object Storage وتخفيف SSR.
- **70,000 مستخدم متزامن**: غير جاهزة حالياً، وتحتاج بنية أكبر: DB pooler، Redis قوي، CDN، workers، possibly read replicas/search service.

### ما الذي سينهار أولاً تحت الضغط؟
1. **DB connections** بسبب Vercel serverless + postgres client max 10 لكل instance.
2. **Search APIs** بسبب 500/timeouts تحت probe خفيف عند غياب Redis/حماية cache قوية في النشر الحالي.
3. **Dynamic SSR pages** مثل offers/wings/track-order عند cache miss/cold start.
4. **Media payload/storage** بسبب base64 القديمة وbloat في audit/media tables.
5. **Background jobs lag** إذا لم تعمل cron/worker بشكل دائم.
6. **Checkout duplicate submissions** إذا لم يرسل العميل idempotency key دائماً.

---

## 8) Critical Risks

| الخطر | الخطورة | التأثير | احتمالية الحدوث | التقييم |
|---|---|---|---|---|
| Redis غير مفعل في staging/current deployment | Critical | DB pressure, rate limit غير موزع, cache miss storms | عالية | يجب تفعيله قبل أي إطلاق كبير |
| Search endpoints أعطت 500 تحت ضغط خفيف | Critical | تجربة بحث سيئة وفشل APIs عند traffic | متوسطة/عالية | يحتاج Redis + logs/Sentry + profiling |
| DB connection exhaustion | Critical | فشل شامل/timeout عند Vercel scale out | عالية | استخدم pooler وقلل client max |
| صور base64 قديمة + audit bloat | High | بطء SSR وحجم DB وتكاليف ذاكرة | عالية | object storage migration مطلوب |
| Idempotency اختياري في checkout | High | duplicate orders عند double-click/retry | متوسطة | اجعل client يرسل key دائماً ثم اجعله إلزامياً |
| Cron/worker غير مراقب خارجياً | High | notifications/settlements تتأخر | متوسطة | Vercel cron + alerts + worker دائم لاحقاً |
| عدم وجود provider حقيقي للدفع/الإشعارات | High | production flow غير مكتمل | عالية | ربط مزودات حقيقية |
| Observability غير مفعلة بمفاتيح فعلية | High | يصعب تفسير 500/timeouts | عالية | Sentry + logs + uptime |

---

## 9) Scalability Bottlenecks

### SSR
- عدة صفحات عامة/محمية dynamic.
- probe أظهر timeouts في offers/wings/track-order.
- الحل: Redis + warm cache + object storage + تقليل data hydration + cache keys أو static regeneration.

### DB
- 227MB في staging بسبب base64/audit bloat رغم عدد صفوف صغير.
- connections وصلت 32/100 في probe خفيف سابقاً.
- الحل: connection pooling + pgbouncer/serverless pooler + reduce postgres max per lambda + ANALYZE/VACUUM routine.

### Redis
- غير مفعل حالياً.
- code جاهز لكن infra غير جاهزة.
- الحل: Upstash/managed Redis و`REDIS_REQUIRED=true`.

### APIs
- search حساس.
- بعض mutation APIs تقوم بعمليات post-write متسلسلة.
- الحل: queue المزيد من post-write side effects.

### Dashboards
- جيدة للاستخدام الحالي، لكنها تحتاج summary tables عند آلاف التجار.

### Checkout
- atomic stock جيد.
- idempotency اختياري هو أكبر نقطة خطر.

---

## 10) Infrastructure Recommendations

### Redis scaling
- Upstash Redis dedicated/production.
- Redis required true.
- مراقبة hit rate / memory / evictions.
- استخدام Redis counters للanalytics.

### CDN/media
- Cloudinary أو R2/S3.
- تشغيل:
  ```bash
  npm run media:inline-migrate
  ```
- منع base64 نهائياً.
- تنظيف audit_logs القديمة أو أرشفتها.

### Queue systems
- Vercel Cron كبداية.
- Worker دائم عند scale.
- Dead-letter queue.
- Queue lag alerts.

### DB optimization
- Connection pooler.
- Slow query logging.
- pg_stat_statements إن أمكن.
- VACUUM/ANALYZE دوري.
- أرشفة audit logs.
- composite indexes إضافية لاحقاً بعد قياس pg_stat_statements.

### Caching strategy
- Redis cache لجميع public hot pages.
- Warm-up job بعد deploy.
- منع cache stampede — تم تحسينه.
- عدم تخزين payload ضخم داخل cache.

---

## 11) Production Readiness Score

### Current deployed staging/trial readiness for enterprise traffic
| المجال | التقييم |
|---|---:|
| Stability | 68/100 |
| Scalability | 55/100 |
| Reliability | 70/100 |
| Performance | 52/100 |
| Observability | 58/100 |
| Operational maturity | 63/100 |

**Overall current enterprise launch readiness: 61/100**

### Codebase readiness after implemented hardening, بشرط ربط الخدمات الخارجية
| المجال | التقييم |
|---|---:|
| Stability | 82/100 |
| Scalability | 78/100 |
| Reliability | 83/100 |
| Performance | 75/100 |
| Observability | 78/100 |
| Operational maturity | 80/100 |

**Potential readiness after Redis + Object Storage + Monitoring + real providers: 79–84/100**

---

## 12) القرار النهائي
المنصة ككود أصبحت قوية وفيها أسس Enterprise جيدة: atomic inventory، idempotency foundation، background jobs، RBAC، server cart، finance، observability foundation، وcache layer.

لكن النشر الحالي لا يصلح لإطلاق كبير لـ50k/70k قبل تنفيذ هذه البنود:

1. تفعيل Redis production.
2. تفعيل Cloudinary/R2/S3 وترحيل 48 صورة base64 قديمة.
3. تفعيل Sentry/monitoring لملاحقة 500 search/timeouts.
4. تشغيل k6 الحقيقي على staging runner مع cookies وبيانات اختبار مخصصة.
5. إعداد DB pooler أو ضبط connection strategy.
6. جعل checkout client يرسل idempotency key دائماً.
7. تفعيل worker/cron ومراقبة queue lag.
8. ربط مزودات الدفع والإشعارات الحقيقية.

---

## 13) أوامر التشغيل التالية المقترحة

### بعد توفير Redis/Object Storage/Sentry env
```bash
npm run production:readiness
npm run media:inline-audit
npm run media:inline-migrate
npm run backup:json
```

### k6 public enterprise
```bash
k6 run -e BASE_URL=https://staging.example.com scripts/load/k6-enterprise-readiness.js
```

### k6 checkout/inventory
```bash
k6 run \
  -e BASE_URL=https://staging.example.com \
  -e AUTH_COOKIE='mall_session=...' \
  -e STORE_ID='...' \
  -e PRODUCT_ID='...' \
  -e VARIANT_ID='...' \
  -e PAYMENT_METHOD_ID='...' \
  -e SHIPPING_METHOD_ID='...' \
  scripts/load/k6-checkout-inventory-concurrency.js
```

### فحص consistency بعد k6
```sql
select count(*) from product_variants where stock_quantity < 0;
select reference_id, variant_id, type, count(*)
from inventory_movements
where reference_type='order'
group by reference_id, variant_id, type
having count(*) > 1;
select scope, key, count(*) from idempotency_keys group by scope, key having count(*) > 1;
```
