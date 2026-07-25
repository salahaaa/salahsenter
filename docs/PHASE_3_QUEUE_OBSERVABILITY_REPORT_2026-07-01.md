# تقرير تنفيذ المرحلة الثالثة — Background Jobs + Observability Foundation

التاريخ: 2026-07-01

## الهدف

تقليل coupling داخل request lifecycle وتحويل الأعمال غير الحرجة إلى background jobs، مع بناء أساس مراقبة وتشخيص يسمح بتوسيع المنصة لاحقاً.

الأعمال المستهدفة في هذه المرحلة:

- إشعارات التاجر والأدمن بعد إنشاء الطلب.
- إشعار العميل بعد تغيير حالة الطلب.
- منح نقاط/رصيد الولاء بعد إنشاء الطلب.
- تأسيس worker/cron processor.
- تأسيس مؤشرات queue وhealth checks.

---

## ما تم تنفيذه

### 1. إضافة جدول background jobs

تم تحديث schema وإضافة migration:

```txt
lib/db/schema.ts
drizzle/0021_background_jobs.sql
```

الجدول الجديد:

```txt
background_jobs
```

أهم الحقول:

- `queue`
- `type`
- `status`
- `payload`
- `priority`
- `attempts`
- `max_attempts`
- `available_at`
- `locked_at`
- `locked_until`
- `completed_at`
- `failed_at`
- `last_error`
- `dedupe_key`

مع indexes:

```txt
background_jobs_queue_status_idx
background_jobs_type_idx
background_jobs_locked_idx
background_jobs_queue_dedupe_unique
```

---

### 2. Queue enqueue layer

تمت إضافة:

```txt
lib/queue/enqueue.ts
```

وتوفر:

- `enqueueJob`
- `enqueueJobs`
- `dedupeKey` لمنع تكرار نفس job.
- `delayMs` لتأجيل التنفيذ.
- `priority` لترتيب jobs.
- `maxAttempts` للتحكم في retries.

---

### 3. Queue processor

تمت إضافة:

```txt
lib/queue/processor.ts
```

يدعم حالياً job types التالية:

```txt
notifications.order_created
notifications.order_status_updated
wallet.award_loyalty
analytics.product_view
```

مزايا المعالج:

- claim jobs من قاعدة البيانات.
- status transitions:
  - queued
  - processing
  - retry
  - failed
  - completed
- retries مع exponential backoff.
- تسجيل `last_error`.
- قياس مدة تنفيذ كل job عبر structured logs.

> ملاحظة: هذا DB-backed queue foundation مناسب كبداية إنتاجية ومتين في بيئات serverless. لاحقاً يمكن استبدال provider داخلياً بـ BullMQ عند توفير worker دائم وRedis TCP، بدون تغيير route/business code.

---

### 4. فصل الأعمال الثقيلة عن إنشاء الطلب

تم تعديل:

```txt
app/api/orders/route.ts
```

قبل التعديل كان request ينفذ مباشرة:

- `awardLoyaltyForOrder`
- إنشاء notification للتاجر.
- `notifyAdmins`

بعد التعديل:

- الطلب والمخزون والفاتورة تبقى داخل transaction.
- يتم إنشاء jobs داخل نفس transaction.
- response يعود أسرع ولا ينتظر الإشعارات أو الولاء.
- jobs مضمونة الحفظ مع الطلب نفسه.

Jobs التي يتم إنشاؤها عند نجاح الطلب:

```txt
wallet.award_loyalty
notifications.order_created
```

---

### 5. فصل إشعارات تغيير حالة الطلب

تم تعديل:

```txt
app/api/orders/[id]/status/route.ts
```

بدلاً من إدخال notification للعميل مباشرة داخل request، يتم الآن إنشاء job:

```txt
notifications.order_status_updated
```

داخل نفس transaction الخاصة بتغيير حالة الطلب.

---

### 6. Cron/Worker endpoint

تمت إضافة endpoint:

```txt
app/api/cron/jobs/process/route.ts
```

تشغيله:

```http
GET /api/cron/jobs/process?limit=25
Authorization: Bearer CRON_SECRET
```

أو:

```http
POST /api/cron/jobs/process?limit=25
Authorization: Bearer CRON_SECRET
```

هذا مناسب لـ Vercel Cron أو أي cron خارجي.

---

### 7. Worker script دائم

تمت إضافة:

```txt
scripts/process-jobs.ts
```

وتم تحديث `package.json`:

```json
"jobs:process": "tsx scripts/process-jobs.ts",
"jobs:worker": "tsx scripts/process-jobs.ts --loop"
```

الاستخدام:

```bash
npm run jobs:process
npm run jobs:worker
```

`jobs:worker` مناسب عند وجود worker host دائم مثل Render Worker أو VPS.

---

### 8. Observability foundation

تمت إضافة structured logger:

```txt
lib/observability/logger.ts
```

يوفر:

- `logEvent`
- `measureAsync`

كل job يتم تسجيله بصيغة JSON تشمل:

- event name
- job id
- type
- queue
- attempt
- durationMs
- ok/error

---

### 9. Queue observability API

تمت إضافة:

```txt
app/api/admin/observability/queue/route.ts
```

يعرض للأدمن:

- عدد jobs حسب status.
- آخر jobs فاشلة.
- آخر jobs عموماً.

يتطلب صلاحية:

```txt
reports.view
```

---

### 10. Health endpoint محسن

تم تعديل:

```txt
app/api/health/route.ts
```

الآن يعرض:

- حالة الخدمة.
- وقت الخادم.
- هل Redis configured/required.

ويدعم فحص أعمق:

```txt
/api/health?deep=1
```

ليجرب ping لقاعدة البيانات.

---

## الملفات الجديدة

```txt
lib/queue/enqueue.ts
lib/queue/processor.ts
lib/queue/index.ts
lib/observability/logger.ts
app/api/cron/jobs/process/route.ts
app/api/admin/observability/queue/route.ts
scripts/process-jobs.ts
drizzle/0021_background_jobs.sql
docs/PHASE_3_QUEUE_OBSERVABILITY_REPORT_2026-07-01.md
```

## الملفات المعدلة المهمة

```txt
lib/db/schema.ts
app/api/orders/route.ts
app/api/orders/[id]/status/route.ts
app/api/health/route.ts
package.json
.env.example
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

## متطلبات التشغيل

### 1. تطبيق migration

يجب تطبيق migrations الجديدة:

```bash
npm run db:migrate
```

أو تطبيق الملفات يدوياً:

```txt
drizzle/0020_atomic_inventory_idempotency.sql
drizzle/0021_background_jobs.sql
```

### 2. تشغيل jobs processor

أحد الخيارين:

#### Vercel Cron / Cron خارجي

استدعاء:

```txt
/api/cron/jobs/process?limit=25
```

مع:

```txt
Authorization: Bearer CRON_SECRET
```

#### Worker دائم

```bash
npm run jobs:worker
```

---

## أثر المرحلة على المعمارية

قبل هذه المرحلة:

- request إنشاء الطلب كان مرتبطاً بإشعارات وولاء وأعمال جانبية.
- أي بطء أو فشل في هذه الأعمال قد يؤثر على تجربة checkout.

بعد هذه المرحلة:

- request مسؤول عن الأعمال الحرجة فقط:
  - auth
  - validation
  - order transaction
  - atomic inventory
  - idempotency
  - enqueue jobs
- الأعمال الثانوية أصبحت asynchronous.
- هناك queue state وretry ومراقبة أولية.

---

## ما تبقى لتحسين الـ Queue لاحقاً

1. استخدام BullMQ provider عند توفر Redis TCP وworker دائم.
2. إضافة job dashboard UI داخل لوحة الأدمن.
3. إضافة DLQ policy أكثر تفصيلاً.
4. إضافة metrics counters خارجية مثل Sentry/Prometheus لاحقاً.
5. نقل باقي العمليات الثقيلة:
   - emails
   - SMS
   - media processing
   - analytics flush
   - cache warmup

---

## الخطوة التالية المقترحة

بعد هذه المرحلة، المنطق الأنسب هو:

1. Search scalability:
   - pg_trgm
   - GIN indexes
   - search provider abstraction
   - Redis search cache

2. Rate limits شاملة:
   - search
   - orders
   - admin mutations
   - product mutations
   - auth reset flows

3. Load/concurrency tests:
   - checkout concurrency
   - no overselling
   - p95 latency
   - queue processing latency

