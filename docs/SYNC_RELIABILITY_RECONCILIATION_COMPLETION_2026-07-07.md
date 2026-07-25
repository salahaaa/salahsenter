# استكمال Idempotency / Retry / Failed Queue / Reservation Expiry / Audit / Reconciliation — 2026-07-07

## الهدف
استكمال البنية التشغيلية الحرجة لدورة ERP المالية والمخزنية بحيث تصبح المزامنة أكثر أماناً واستقراراً:

- Idempotency.
- Retry Queue.
- Failed Sync Queue.
- Reservation Expiry.
- Audit Logs.
- Reconciliation Dashboard.

مع الالتزام بعدم تنفيذ sync داخل request lifecycle وعدم استخدام DB-to-DB.

---

## 1) Idempotency

### ما تم
تم تعزيز Idempotency في Integration APIs:

```txt
POST /api/integrations/products
POST /api/integrations/inventory
POST /api/integrations/orders
POST /api/integrations/invoices
```

أصبحت تقبل idempotency عبر:

```http
Idempotency-Key: <key>
```

أو داخل body:

```json
{
  "idempotencyKey": "agent-store-products-001"
}
```

أو fallback إلى:

```json
{
  "batchId": "..."
}
```

ويتم استخدام المفتاح كـ:

```txt
integration_events.dedupe_key
background_jobs.dedupe_key
```

وبالتالي إذا أرسل Local Agent نفس الدفعة مرتين لا تتم مضاعفة المعالجة.

---

## 2) Retry Queue

### ما تم
تم إنشاء معالج Retry Queue:

```txt
lib/integrations/accounting/reliability.ts
```

والـ cron endpoint:

```txt
/api/cron/integrations/retry?limit=25
```

وتم ربطه في `vercel.json` كل 5 دقائق.

### آلية العمل

```txt
integration_events.status in ('pending','retry')
next_attempt_at <= now()
        ↓
processing
        ↓
processAccountingIntegrationEvent
        ↓
processed أو retry أو failed
```

مع backoff:

```txt
1m → 2m → 4m → 8m ... حتى 60m
```

---

## 3) Failed Sync Queue

### ما تم
تم إنشاء جدول جديد في migration:

```txt
drizzle/0040_sync_reliability_reconciliation.sql
```

الجدول:

```txt
integration_failed_syncs
```

يسجل:

- integration_event_id.
- sync_run_id.
- client_key.
- store_id.
- resource.
- direction.
- failure_type.
- status.
- attempts.
- error.
- payload.
- next_retry_at.
- resolved_at.

عند فشل event بعد max attempts أو فشل واضح، ينتقل إلى Failed Sync Queue.

---

## 4) Reservation Expiry

### ما تم
تمت إضافة حقول على جدول orders:

```txt
reservation_status
reservation_expires_at
reservation_released_at
```

وأصبح إنشاء الطلب يحدد:

```txt
reservation_status = active
reservation_expires_at = now + ORDER_RESERVATION_TTL_MINUTES
```

متغير البيئة الجديد:

```env
ORDER_RESERVATION_TTL_MINUTES=120
```

### Cron جديد

```txt
/api/cron/reservations/expire?limit=50
```

مرتبط في `vercel.json` كل 5 دقائق.

### ماذا يفعل؟

إذا انتهى وقت الحجز ولم تصدر فاتورة ERP:

- يتم فك الحجز فقط.
- يتم تحديث الطلب إلى cancelled.
- لا يتم إنشاء فاتورة.
- لا يتم تأثير مالي.
- لا يتم تعديل stockQuantity الحقيقي.

لأن ERP هو مصدر الحقيقة.

---

## 5) Audit Logs

### ما تم
تم إنشاء جدول:

```txt
integration_audit_logs
```

ضمن migration:

```txt
0040_sync_reliability_reconciliation.sql
```

وتم إنشاء helper:

```txt
lib/integrations/accounting/audit.ts
```

يسجل:

- clientKey.
- deviceId.
- storeId.
- action.
- entityType.
- entityId.
- status.
- requestId.
- ipAddress.
- userAgent.
- metadata.

وتم ربطه عند استقبال دفعات التكامل عبر `enqueueAccountingPush`.

---

## 6) Reconciliation Dashboard

### صفحة جديدة

```txt
/admin/integrations/reconciliation
```

تعرض:

- Retry Queue count.
- Failed Events count.
- Failed Syncs count.
- Expired Reservations count.
- Orders Awaiting ERP Invoice count.
- Negative Available Stock count.

وتعرض جداول:

- Failed Sync Queue.
- Retry Queue.
- Reservations awaiting expiry/release.
- Orders awaiting ERP invoice.
- Negative available stock.

### APIs جديدة

```txt
GET  /api/admin/integrations/reconciliation
POST /api/admin/integrations/reconciliation/retry
POST /api/admin/integrations/reconciliation/expire-reservations
```

### إجراءات من اللوحة

- إعادة failed event إلى Retry Queue.
- إنهاء الحجوزات المنتهية يدوياً.

---

## 7) علاقة هذه النقاط بدورة ERP المالية والمخزنية

### عند Checkout

```txt
Order Created
reserved_quantity += qty
reservation_status = active
reservation_expires_at = now + TTL
integration event order.created
```

### إذا Agent/ERP تأخر

Reconciliation Dashboard يظهر:

```txt
Orders Awaiting ERP Invoice
Expired Reservations
Retry Queue
Failed Sync Queue
```

### إذا ERP أرسل invoice.created

```txt
Invoice created in platform as ERP reference
Order closed/paid
Reservation released
Ledger settlement recorded
```

### إذا ERP أرسل inventory.updated

```txt
stockQuantity = ERP physical stock
reservedQuantity remains platform reservation
available = stockQuantity - reservedQuantity
```

---

## الملفات الجديدة/المعدلة

### جديدة

```txt
drizzle/0040_sync_reliability_reconciliation.sql
lib/integrations/accounting/reliability.ts
lib/integrations/accounting/audit.ts
components/admin/reconciliation-dashboard.tsx
app/admin/integrations/reconciliation/page.tsx
app/api/cron/integrations/retry/route.ts
app/api/cron/reservations/expire/route.ts
app/api/admin/integrations/reconciliation/route.ts
app/api/admin/integrations/reconciliation/retry/route.ts
app/api/admin/integrations/reconciliation/expire-reservations/route.ts
```

### معدلة

```txt
lib/db/schema.ts
app/api/orders/route.ts
app/api/orders/[id]/status/route.ts
app/api/integrations/products/route.ts
app/api/integrations/inventory/route.ts
app/api/integrations/orders/route.ts
app/api/integrations/invoices/route.ts
lib/integrations/accounting/service.ts
lib/integrations/accounting/apply.ts
vercel.json
.env.example
.env.production.example
app/admin/page.tsx
```

---

## Migrations المطلوبة الآن

```bash
psql "$DATABASE_URL" -f drizzle/0036_accounting_integration_architecture.sql
psql "$DATABASE_URL" -f drizzle/0037_local_sync_agent_runtime.sql
psql "$DATABASE_URL" -f drizzle/0038_enterprise_erp_integration_infrastructure.sql
psql "$DATABASE_URL" -f drizzle/0039_erp_financial_inventory_cycle.sql
psql "$DATABASE_URL" -f drizzle/0040_sync_reliability_reconciliation.sql
```

---

## الفحوصات

تم تشغيل:

```bash
NODE_OPTIONS=--max_old_space_size=4096 npm run typecheck
npm run lint
npm test
```

النتيجة:

```txt
typecheck: PASS
lint: PASS
tests: PASS
9 test files passed
23 tests passed
```

محاولة build:

```bash
NODE_OPTIONS=--max_old_space_size=4096 NEXT_TELEMETRY_DISABLED=1 npm run build
```

فشلت بإشارة:

```txt
SIGKILL
```

بسبب قيود الذاكرة في Arena كما حدث سابقاً.

---

## الخلاصة

أصبحت دورة ERP المالية والمخزنية أكثر اكتمالاً:

```txt
Idempotency prevents duplicate batches
Retry Queue retries transient failures
Failed Sync Queue isolates hard failures
Reservation Expiry prevents stock lock forever
Audit Logs records integration actions
Reconciliation Dashboard exposes mismatches and recovery actions
```

وهذا يرفع المنصة خطوة مهمة نحو Enterprise-grade ERP synchronization جاهز للتوسع والرقابة المالية.
