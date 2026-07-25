# تقرير تطوير Central Monitoring System — 2026-07-05

## الهدف
تطوير نظام مراقبة مركزي داخل لوحة الأدمن لمراقبة المنصة لحظياً من ناحية الأداء، البنية التحتية، الأخطاء، الخدمات، الحوادث، والتكامل مع Prometheus/Grafana/Sentry.

## ما تم تنفيذه

### 1) Dashboard مركزي داخل لوحة الأدمن
تم تطوير لوحة مراقبة مباشرة في:

- `/admin/observability`

تعرض:

- نسبة صحة المنصة Health Score.
- حالة الخدمات Service Status.
- الحمل الحالي CPU / Memory.
- اتصالات قاعدة البيانات Database Connections.
- Redis status.
- Queue Jobs: queued / failed / stuck.
- Upload Services.
- API p95 response/check latency.
- عدد الطلبات المرصودة عند تفعيل Redis request counters.
- الخدمات المتوقفة.
- الخدمات البطيئة أو المتدهورة.
- Incident Logs.
- Error Tracking من structured logs.
- حالة تكامل Prometheus/Grafana/Sentry.

### 2) Realtime Updates
تمت إضافة تحديث لحظي عبر SSE المتوافق مع Vercel Serverless، مع واجهة WebSocket-ready:

- `/api/admin/observability/central/stream`

الواجهة تستخدم EventSource وتعمل بدون Refresh. إذا فشل الاتصال تتحول تلقائياً إلى polling fallback.

> ملاحظة تقنية: في Vercel Serverless، SSE أكثر أماناً وعملية من WebSocket التقليدي. يمكن لاحقاً نقل نفس الـ contract إلى WebSocket worker خارجي إذا تم توفير worker دائم.

### 3) Central Monitoring API
تمت إضافة API مركزي:

- `GET /api/admin/observability/central`
- `POST /api/admin/observability/central`

الـ POST يحفظ لقطة monitoring في جداول health checks/incidents/structured logs عند توفر migration.

### 4) Prometheus Metrics Endpoint
تمت إضافة endpoint بصيغة Prometheus text exposition:

- `/api/metrics`

المؤشرات المصدّرة تشمل:

- `platform_health_score`
- `platform_services_down`
- `platform_services_slow`
- `platform_memory_heap_usage_percent`
- `platform_cpu_load_1m`
- `platform_db_connections_used`
- `platform_db_connections_usage_percent`
- `platform_queue_failed_jobs`
- `platform_queue_queued_jobs`
- `platform_requests_last_5m`
- `platform_api_requests_last_5m`
- `platform_failed_requests_last_1h`
- `platform_api_p95_response_ms`
- `platform_service_status{service=...}`
- `platform_service_latency_ms{service=...}`

في Production Launch Mode endpoint محمي ويتطلب:

```env
METRICS_TOKEN=generate-a-long-random-metrics-token
```

الاستخدام مع Prometheus:

```yaml
scrape_configs:
  - job_name: salahsentar22
    metrics_path: /api/metrics
    bearer_token: YOUR_METRICS_TOKEN
    static_configs:
      - targets: ['salahsentar22.vercel.app']
```

### 5) Grafana Readiness
تمت إضافة متغيرات البيئة للربط مع Grafana:

```env
GRAFANA_URL=
GRAFANA_DASHBOARD_URL=
GRAFANA_CLOUD_API_KEY=
```

وتظهر حالة الربط داخل لوحة المراقبة.

### 6) Sentry Readiness
النظام يقرأ حالة Sentry من:

```env
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
```

وتظهر حالة الربط داخل Dashboard. كما أن المشروع يحتوي أساساً على ملفات Sentry foundation السابقة.

### 7) Incident Logs + Error Tracking
تم ربط Dashboard بجداول:

- `platform_incidents`
- `platform_incident_events`
- `platform_health_checks`
- `platform_structured_logs`

وتمت إضافة migration:

- `drizzle/0034_admin_platform_security_center.sql`

هذه الجداول تدعم:

- Incident ID.
- Severity.
- Affected service.
- Start/last seen/resolved timestamps.
- سجل أحداث لكل incident.
- structured logs قابلة للبحث/الفلترة لاحقاً.

### 8) Monitoring Data Layer
تمت إضافة:

- `lib/observability/central-monitoring.ts`
- `lib/observability/request-metrics.ts`
- `components/admin/central-monitoring-dashboard.tsx`
- `app/api/admin/observability/central/route.ts`
- `app/api/admin/observability/central/stream/route.ts`
- `app/api/metrics/route.ts`

كما تم تحديث:

- `app/admin/observability/page.tsx`
- `app/admin/page.tsx`
- `.env.example`
- `.env.production.example`

## ملاحظات تشغيلية مهمة

### Migration مطلوبة
قبل رؤية incident/error logs المخزنة فعلياً يجب تطبيق migration:

```bash
# على قاعدة التجربة/الإنتاج المصرح بها فقط
psql "$DATABASE_URL" -f drizzle/0034_admin_platform_security_center.sql
```

أو عبر آلية migrations المعتمدة في المشروع.

### Request counters
تم تفعيل عدادات الطلبات عبر Middleware بشكل خفيف باستخدام `event.waitUntil` مع Upstash Redis REST مباشرة بدون إبطاء الاستجابة. يتم تسجيل:

- إجمالي الطلبات لكل دقيقة.
- طلبات `/api/*` لكل دقيقة.
- sampling اختياري عبر `MONITORING_REQUEST_SAMPLE_RATE`.

وتقرأ لوحة المراقبة هذه القيم من `lib/observability/request-metrics.ts` لعرض طلبات آخر 5 دقائق وآخر ساعة.

### Build في هذه البيئة
- `typecheck` نجح.
- `lint` نجح.
- `tests` نجحت.
- `next build` تم قتله بإشارة `SIGKILL` داخل بيئة Arena المحدودة أثناء مرحلة compile رغم استخدام `NODE_OPTIONS=--max_old_space_size=4096`.
- هذا مشابه لمشكلة OOM/قيود الذاكرة السابقة في هذه البيئة، وليس خطأ TypeScript/Lint/Tests.

## نتائج الفحص

```bash
NODE_OPTIONS=--max_old_space_size=4096 npm run typecheck
# PASS

npm run lint
# PASS

npm test
# PASS — 6 files / 16 tests

NODE_OPTIONS=--max_old_space_size=4096 NEXT_TELEMETRY_DISABLED=1 npm run build
# SIGKILL في بيئة Arena المحدودة أثناء compile
```

## الملفات الأساسية المضافة

```txt
components/admin/central-monitoring-dashboard.tsx
lib/observability/central-monitoring.ts
lib/observability/request-metrics.ts
app/api/admin/observability/central/route.ts
app/api/admin/observability/central/stream/route.ts
app/api/metrics/route.ts
docs/CENTRAL_MONITORING_SYSTEM_2026-07-05.md
```

## النتيجة
تم بناء Central Monitoring System احترافي داخل لوحة الأدمن، متكامل مع Health Score وRealtime Dashboard وIncident Logs وError Tracking وPrometheus endpoint وجاهزية Grafana/Sentry، مع الحفاظ على صلاحيات الأدمن وعدم كشف بيانات المراقبة العامة إلا عند وجود Metrics Token في الإنتاج.
