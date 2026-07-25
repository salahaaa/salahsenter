# تقرير تطوير Auto Scaling Intelligence — 2026-07-06

## الهدف
تطوير نظام ذكي يراقب الحمل على المنصة ويقرر توسيع أو تقليل الموارد حسب الضغط، مع دعم Emergency Scaling وPredictive Scaling وScaling Logs ولوحة تحكم إدارية.

## ما تم تنفيذه

### 1) Scaling Control Plane داخل لوحة الأدمن
تم إنشاء صفحة جديدة:

```txt
/admin/scaling
```

وتعرض:

- قرار التوسع الحالي: Scale Out / Scale In / Hold / Emergency.
- CPU Usage.
- Memory Usage.
- Queue Length.
- Concurrent Requests تقديري.
- Response Time P95.
- Desired API Instances.
- Desired Queue Workers.
- Worker Batch Limit.
- Redis Mode.
- Load Balancing Mode.
- Predictive Scaling للـ 15 دقيقة القادمة.
- Scaling Actions.
- Scaling Logs.

كما تمت إضافة بطاقة في لوحة الأدمن الرئيسية:

```txt
Auto Scaling Intelligence
```

### 2) Auto Scaling Intelligence Engine
تم إنشاء المحرك الأساسي:

```txt
lib/scaling/auto-scaling-intelligence.ts
```

يقوم بـ:

- قراءة مؤشرات Central Monitoring.
- حساب CPU نسبةً إلى عدد الأنوية.
- قراءة Memory heap usage.
- قراءة Queue length / failed / stuck jobs.
- تقدير Concurrent Requests من request counters وresponse time.
- قراءة Response Time P95.
- قراءة DB Connections Usage.
- قراءة Redis / Upload status.
- اتخاذ قرار Scale Out / Scale In / Hold / Emergency.
- توليد actions قابلة للتطبيق أو الإرسال إلى مزود خارجي.

### 3) Emergency Scaling Mode
يفعل النظام Emergency Scaling عند وصول المؤشرات إلى حدود خطرة مثل:

- CPU >= 90%.
- Memory >= 90%.
- Queue Length >= 300.
- Response Time >= 3000ms.
- DB Connections >= 85%.
- وجود خدمات Down.

عند الطوارئ يرفع desired state إلى الحد الأعلى:

- API Instances = Max.
- Queue Workers = Max.
- Worker Batch Limit = Max.
- Redis Mode = emergency.
- Load Balancing Mode = emergency.

### 4) Predictive Scaling باستخدام AI Rules
تمت إضافة طبقة Predictive Scaling rule-based AI تتوقع حمل الـ 15 دقيقة القادمة بناءً على:

- CPU.
- Memory.
- Queue Length.
- Concurrent Requests.
- Response Time.
- DB Pressure.
- Down/Slow services.

وتصنف الحمل القادم:

```txt
low | normal | high | critical
```

مع probability وتفسير واضح.

### 5) Scaling Logs
تمت إضافة جدول جديد:

```txt
platform_scaling_events
```

ضمن migration:

```txt
drizzle/0035_auto_scaling_intelligence.sql
```

يسجل:

- mode: recommendation/manual/auto/dry_run.
- direction.
- severity.
- before state.
- desired state.
- signals.
- actions.
- provider response.
- actor.
- correlation id.

### 6) APIs للإدارة
تمت إضافة:

```txt
GET  /api/admin/scaling
POST /api/admin/scaling
POST /api/admin/scaling/apply
GET  /api/admin/scaling/stream
```

- GET: قراءة Snapshot.
- POST: تقييم وحفظ توصية.
- apply: تطبيق القرار أو محاكاته.
- stream: تحديث لحظي SSE / WebSocket-ready.

### 7) Cron للتوسع التلقائي
تمت إضافة:

```txt
GET /api/cron/scaling/evaluate
```

وإضافته إلى `vercel.json` كل 5 دقائق:

```json
{
  "path": "/api/cron/scaling/evaluate",
  "schedule": "*/5 * * * *"
}
```

إذا كان:

```env
AUTO_SCALING_AUTOPILOT=true
```

يقوم بتطبيق القرار تلقائياً.

إذا كان false يحفظ توصية فقط بدون تطبيق.

### 8) دعم Background Workers / Queue Scaling
تم تحديث:

```txt
scripts/process-jobs.ts
```

ليقرأ runtime hints من Auto Scaling:

- workerBatchLimit.
- queueWorkers.
- loopIntervalMs.
- loadBalancingMode.

وبالتالي يمكن للـ worker استخدام batch limit ديناميكي بدل الاعتماد فقط على env الثابتة.

### 9) Redis Scaling / Load Balancing
تم دعم Redis وLoad Balancing على مستوى control plane:

- Redis Mode: normal / scale_up / emergency.
- Load Balancing Mode: normal / balanced / shed_non_critical / emergency.

ولأن Vercel/Upstash لا يسمحان دائماً بتغيير الموارد مباشرة من داخل التطبيق، تمت إضافة Webhook اختياري للتكامل مع أي controller خارجي:

```env
SCALING_CONTROLLER_WEBHOOK_URL=
SCALING_CONTROLLER_WEBHOOK_TOKEN=
```

عند ضبطه، يرسل النظام قرار التوسع إلى webhook خارجي يمكنه:

- تعديل إعدادات provider.
- تشغيل workers إضافيين.
- تعديل Redis plan أو تنبيه فريق DevOps.
- تحديث load balancer / WAF / edge routing.

### 10) متغيرات البيئة الجديدة
تم تحديث `.env.example` و`.env.production.example` بإعدادات:

```env
AUTO_SCALING_AUTOPILOT=false
AUTO_SCALING_MIN_API_INSTANCES=1
AUTO_SCALING_MAX_API_INSTANCES=8
AUTO_SCALING_MIN_QUEUE_WORKERS=1
AUTO_SCALING_MAX_QUEUE_WORKERS=6
AUTO_SCALING_MIN_WORKER_BATCH=10
AUTO_SCALING_MAX_WORKER_BATCH=100
AUTO_SCALING_CPU_SCALE_OUT=70
AUTO_SCALING_CPU_EMERGENCY=90
AUTO_SCALING_MEMORY_SCALE_OUT=78
AUTO_SCALING_MEMORY_EMERGENCY=90
AUTO_SCALING_QUEUE_SCALE_OUT=50
AUTO_SCALING_QUEUE_EMERGENCY=300
AUTO_SCALING_RESPONSE_SCALE_OUT_MS=1200
AUTO_SCALING_RESPONSE_EMERGENCY_MS=3000
SCALING_CONTROLLER_WEBHOOK_URL=
SCALING_CONTROLLER_WEBHOOK_TOKEN=
```

## الملفات الأساسية المضافة/المعدلة

```txt
app/admin/scaling/page.tsx
components/admin/auto-scaling-dashboard.tsx
lib/scaling/auto-scaling-intelligence.ts
app/api/admin/scaling/route.ts
app/api/admin/scaling/apply/route.ts
app/api/admin/scaling/stream/route.ts
app/api/cron/scaling/evaluate/route.ts
drizzle/0035_auto_scaling_intelligence.sql
tests/auto-scaling-intelligence.test.ts
scripts/process-jobs.ts
vercel.json
.env.example
.env.production.example
app/admin/page.tsx
lib/db/schema.ts
```

## الفحوصات
تم تشغيل:

```bash
NODE_OPTIONS=--max_old_space_size=4096 npm run typecheck
npm run lint
npm test
```

والنتيجة:

```txt
typecheck: PASS
lint: PASS
tests: PASS
7 test files passed
19 tests passed
```

تمت محاولة build:

```bash
NODE_OPTIONS=--max_old_space_size=4096 NEXT_TELEMETRY_DISABLED=1 npm run build
```

لكن بيئة Arena قتلت العملية بـ:

```txt
SIGKILL
```

وهذا تكرر سابقاً بسبب قيود الذاكرة في بيئة Arena، بينما typecheck/lint/tests ناجحة.

## المطلوب قبل التفعيل على Vercel

### 1) تطبيق migration

```bash
psql "$DATABASE_URL" -f drizzle/0035_auto_scaling_intelligence.sql
```

### 2) Deploy جديد
حتى تظهر الصفحة:

```txt
/admin/scaling
```

وتظهر APIs:

```txt
/api/admin/scaling
/api/admin/scaling/stream
/api/cron/scaling/evaluate
```

### 3) اختيار وضع التشغيل
للتوصيات فقط:

```env
AUTO_SCALING_AUTOPILOT=false
```

للتطبيق التلقائي:

```env
AUTO_SCALING_AUTOPILOT=true
```

وللتكامل مع controller خارجي:

```env
SCALING_CONTROLLER_WEBHOOK_URL=https://your-scaling-controller.example/scale
SCALING_CONTROLLER_WEBHOOK_TOKEN=secure-token
```

## ملاحظة مهمة
داخل Vercel Serverless لا يمكن للتطبيق نفسه إجبار Vercel على زيادة API instances مباشرة من كود Next.js. لذلك تم بناء النظام كـ Control Plane ذكي:

- يراقب.
- يقرر.
- يسجل.
- يضبط desired state.
- يرفع أو يقلل worker runtime hints.
- يستدعي webhook خارجي عند الحاجة للتعامل مع مزود البنية التحتية.

هذا هو الأسلوب الصحيح production-grade بدون ادعاء قدرة غير متاحة من داخل بيئة Serverless.
