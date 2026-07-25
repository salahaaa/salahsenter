# فحص هندسي شامل — Enterprise ERP Integration Infrastructure

**المشروع:** Salah Center
**تاريخ الفحص:** 13 يوليو 2026
**نوع الفحص:** مراجعة كود ومسارات وschema وLocal Sync Agent، مع تحقق محلي.
**لا يشمل:** ربط ERP حي أو sandbox خارجي أو اختبار شبكة عميل أو إنتاج.

## النتيجة التنفيذية

### نسبة الجاهزية

| المقياس | النسبة | الحكم |
|---|---:|---|
| أساس البنية البرمجية والتشغيلية | **62%** | جيد كقاعدة قابلة للبناء ومناسب لتجربة controlled pilot بعد استكمال الفجوات الحرجة |
| جاهزية التشغيل التجاري Enterprise | **38%** | غير جاهز بعد؛ لا يوجد Adapter فعلي ولا Agent مثبت/مختبر ولا OAuth/Webhook/RLS/Conflict workflow مكتمل |
| النتيجة الإجمالية المركبة | **52%** | لا يوصى بإطلاق ERP للتجار بشكل عام الآن؛ يوصى بمتجر تجريبي واحد بعد تنفيذ أولويات P0/P1 |

المشروع لا يعتمد على ERP محدد داخل Core، ولديه طبقة API/DTO/Queue/Agent ومراقبة جيدة نسبيًا. لكن أجزاء مهمة ما زالت metadata أو scaffold وليست تنفيذًا فعليًا: adapters الحقيقية، مزامنة الطلبات الواردة، CRM/customer sync، warehouses، conflict resolution، cloud OAuth/webhooks، وAgent production lifecycle.

---

## 1) معمارية التكامل

**الحالة: منفذ جزئيًا وبشكل صحيح مبدئيًا.**

المسارات الموجودة:

```text
lib/integrations/accounting/
lib/integrations/erp/
app/api/integrations/
app/api/admin/integrations/
local-sync-agent/
```

السلسلة الفعلية الحالية:

```text
Platform Core
  → integration_events / background_jobs
  → /api/integrations/*
  → Local Sync Agent أو Integration Client
  → Desktop ERP/POS
```

ملفات محورية:

```text
lib/integrations/accounting/events.ts
lib/integrations/accounting/service.ts
lib/integrations/accounting/apply.ts
lib/queue/processor.ts
lib/integrations/erp/abstraction.ts
```

**فجوة:** لا توجد طبقة `sync-engine` موحدة مستقلة بالاسم والمسؤوليات لكل الموارد؛ المنطق موزع بين service/apply/reliability/queue.

---

## 2) ERP Abstraction Layer

**الحالة: جزئي.**

الموجود:

```text
lib/integrations/erp/abstraction.ts
```

يوفر:

```text
ErpAdapterDefinition
ErpCapability
ErpResource
SyncDirection
ERP_ADAPTERS
```

يدعم تعريف قدرات SQL Server وAccess وCSV/Excel وGeneric Desktop ERP.

**غير موجود:** واجهة Connector تنفيذية حقيقية من نوع:

```text
createOrder()
syncInventory()
syncProducts()
syncCustomers()
syncPayments()
fetchWarehouses()
fetchBranches()
fetchPriceLists()
```

الطبقة الحالية تصف adapter metadata ولا تنفذ adapter methods موحدة داخل المنصة.

---

## 3) ERP Adapters

**الحالة: Scaffold/Metadata فقط.**

الموجود:

```text
SqlServerConnector
AccessOdbcConnector
CsvExcelConnector
Generic Adapter Definition
```

المسارات:

```text
local-sync-agent/src/Connectors/SqlServerConnector.cs
local-sync-agent/src/Connectors/AccessOdbcConnector.cs
local-sync-agent/src/Connectors/CsvExcelConnector.cs
lib/integrations/erp/abstraction.ts
```

**غير موجود:**

```text
OnyxAdapter
OdooAdapter
SAPAdapter
Cloud OAuth Adapter
Webhook Adapter per ERP vendor
```

لا يوجد إثبات تنفيذ فعلي لـ Onyx أو Odoo أو SAP، ولا ينبغي اعتبار وجود `ERP_ADAPTERS` دعمًا فعليًا لهذه الأنظمة.

---

## 4) دورة الطلب والمخزون والمحاسبة

**الحالة: جزئي، مع أساس صحيح للـ ERP mode.**

### الموجود

1. المنصة تنشئ الطلب وتحجز المخزون:
   ```text
   app/api/orders/route.ts
   ```
2. في ERP Mode لا تنشئ المنصة الفاتورة محليًا ولا تخصم stock النهائي:
   ```text
   lib/commerce/financial-services.ts
   ```
3. يرسل الطلب outbound integration event/background job:
   ```text
   lib/integrations/accounting/events.ts
   ```
4. `invoice.created` الوارد من ERP ينشئ/يحدث invoice ويرر reservation ثم يسوي المنصة:
   ```text
   lib/integrations/accounting/apply.ts
   ```
5. inventory snapshot الوارد من ERP يحدث mirror المنصة:
   ```text
   applyInventorySnapshot()
   ```

### الفجوات الحرجة

- Local Sync Agent الحالي يدفع products/inventory فقط؛ لا يسحب orders/events أو ينفذ createOrder داخل ERP.
- inbound `orders` لا يطبق داخل `apply.ts`؛ ينتهي إلى `queued_for_future_mapper` ثم failure.
- returns/cancellations من ERP ليست دورة مكتملة end-to-end.
- تطبيق invoice الوارد يجعل order `closed` و`paid` و`delivered` مباشرة؛ هذا افتراض تشغيلي يحتاج فصل invoice/settlement/delivery حسب ERP الحقيقي.
- outbox المحلي في Agent يسجل الرسائل لكنه لا يملك worker ظاهرًا لإعادة drain/replay للـ outbox.

---

## 5) Source of Truth

**الحالة: منفذ كسياسة ثابتة ووضع متجر إداري.**

الملفات:

```text
lib/integrations/erp/source-of-truth.ts
lib/commerce/financial-strategy.ts
lib/commerce/financial-services.ts
app/api/admin/stores/{id}/erp-mode/route.ts
```

السياسة المنفذة:

| المجال | ERP Mode | Standalone |
|---|---|---|
| Inventory | ERP | Platform |
| Invoice | ERP | Platform |
| Revenue & Settlement | Platform | Platform |
| Price | Merchant | Merchant |
| Product data / description / images | Platform | Platform |
| Bank accounts | Platform | Platform |
| Customers | Platform | Platform |

**الفجوة:** السياسة ليست قابلة للتخصيص per entity/per merchant من UI؛ هي policy مركزية حسب mode، وهذا مناسب للسلامة الآن لكنه لا يحقق بعد مرونة enterprise الكاملة المطلوبة.

---

## 6) Mapping System

**الحالة: جيد جزئيًا.**

الملفات:

```text
lib/integrations/erp/mapping.ts
lib/integrations/erp/admin-service.ts
app/api/admin/integrations/mappings/route.ts
integration_mapping_profiles
integration_entity_links
```

الموجود:

- `externalId` إلزامي.
- SKU وBarcode مدعومان.
- name-only matching ممنوع.
- versioned mapping profiles.
- sourceOfTruth وconflictPolicy محفوظان لكل Mapping Profile.
- client/store scope يدعم Multi Merchant على مستوى Integration Client.

غير المكتمل:

```text
Warehouse mapping typed UI
Branch mapping typed UI
Customer mapping typed UI
Payment method mapping typed UI
Price list mapping typed UI
```

يمكن تخزينها JSON حاليًا، لكنها ليست workflow أو data model واضحًا لكل مورد.

---

## 7) Integration APIs

**الحالة: جيد للموارد الأساسية.**

الموجود:

```text
/api/integrations/products
/api/integrations/inventory
/api/integrations/orders
/api/integrations/invoices
/api/integrations/events
/api/integrations/events/ack
/api/integrations/sync-runs
/api/integrations/agents/register
/api/integrations/agents/heartbeat
/api/integrations/config
/api/integrations/health
```

DTOs وvalidation:

```text
lib/integrations/accounting/dtos.ts
```

يدعم DTOs للـ products/inventory/orders/invoices.

غير موجود:

```text
customers API
payments API
warehouses API
branches API
price-lists API
returns DTO/API مكتمل
```

---

## 8) Authentication والأمان

**الحالة: جيد جزئيًا.**

الموجود:

```text
Bearer Token / x-api-key
Scoped permissions
Store scope
Token hash (SHA-256)
API key rotation
integration audit logs
```

الملفات:

```text
lib/integrations/accounting/auth.ts
lib/integrations/accounting/audit.ts
app/api/admin/integrations/clients/{id}/rotate-key/route.ts
```

الإضافة الجديدة:

```text
lib/integrations/erp/agent-access.ts
```

تمنع Agent أو inbound ERP sync قبل:

```text
Admin ERP Mode + Certified Connector + Matching Client Key
```

غير موجود:

```text
Encrypted stored ERP credentials
IP allowlist / mTLS
OAuth 2.0 cloud connector flow
per-client rate limits خاصة بالتكامل
secret manager integration
```

---

## 9) Events وWebhook

**الحالة: جزئي.**

الموجود:

```text
integration_events
outbound events
inbound event ingestion
ack endpoint
idempotency/dedupe keys
integration audit logs
```

الأحداث المعرفة تشمل:

```text
product.updated
inventory.updated
order.created
order.updated
invoice.issued
invoice.cancelled
return.created
return.updated
```

الفجوات:

- لا توجد generic inbound webhook signature validation للـ ERP providers.
- لا توجد outbound webhook dispatcher مستقل مع signing/retry/delivery log.
- replay protection موجود عمليًا عبر dedupe keys للأحداث، لكنه ليس webhook nonce/signature layer عامة.
- Webhook الحقيقية الموجودة أساسًا خاصة بمزودي الدفع، وليست ERP webhook infrastructure عامة.

---

## 10) Queue وSync Engine

**الحالة: جيد جزئيًا.**

الموجود:

```text
background_jobs
integration_events
integration_failed_syncs
retry queue
dead_letter status
cron integration retry
```

الملفات:

```text
lib/queue/processor.ts
lib/integrations/accounting/reliability.ts
app/api/cron/integrations/retry/route.ts
```

المتاح:

```text
background processing
retry/backoff
failed sync queue
manual retry
DLQ in generic background jobs
incremental cursors في APIs/Agent
```

غير الموجود فعليًا:

```text
Redis queue / BullMQ
RabbitMQ
Kafka
full sync orchestration
agent outbox drain/replay executor
per-resource schedule policy managed from admin
```

---

## 11) Conflict Resolution

**الحالة: ضعيف / غير مكتمل.**

الموجود:

```text
conflictPolicy JSON في mapping profiles
reconciliation dashboard
integration audit logs
manual retry
```

غير موجود:

```text
conflict table
conflict states
manual resolution UI
per-entity resolution actions
price conflict workflow
delete/tombstone policy
inventory conflict case management
```

هذه من أكبر فجوات Enterprise ERP الحالية.

---

## 12) Desktop ERP وLocal Sync Agent

**الحالة: Scaffold متقدم لكنه غير production-ready.**

المجلد:

```text
local-sync-agent/
```

الموجود:

```text
.NET 8 Worker
SQLite checkpoints/outbox/inbox/dead_letters
SQL Server connector
Access/ODBC connector
CSV/Excel connector
heartbeat/register APIs
retry loop
sync runs
```

الإصلاح الجديد:

```text
StoreId داخل PushEnvelope
EnableProductPush=false افتراضيًا
ERP Mode admin gate قبل register/heartbeat/inbound sync
```

غير مكتمل:

```text
Windows Service installer
DPAPI / Windows Secret Store implementation
signed release binary
auto updater
outbox drain/replay
orders/events pull loop
agent diagnostics UI
installer/onboarding wizard
agent E2E test مع SQL Server/Access حقيقي
```

لا يوجد .NET SDK في Arena؛ لم يتم compile للـ agent في هذا الفحص.

---

## 13) Cloud ERP

**الحالة: غير مكتمل.**

المتاح API surface يمكن استخدامه مع Cloud ERP، لكن لا يوجد:

```text
Odoo REST/XML-RPC adapter
SAP OData/BAPI adapter
Onyx API adapter
OAuth flow
Webhook verification
cloud credential vault
```

---

## 14) لوحة إدارة التكامل

**الحالة: جيدة جزئيًا.**

الصفحات:

```text
/admin/integrations
/admin/integrations/reconciliation
/admin/integrations/certification
```

تعرض:

```text
Integration Clients
Agent Devices
Mapping Profiles
Recent Events
Sync Runs
Failed Sync Queue
Retry Queue
Reservations
ERP invoice gaps
Negative available stock
Certification checklist
```

ينقصها:

```text
Webhook delivery failures
warehouse/branch status
sync duration charts/SLA
resource-level inventory freshness
one-click conflict resolution
agent installer download/provisioning wizard
```

---

## 15) إعدادات التاجر

**الحالة: محسنة لكن الإدارة هي المتحكم.**

صفحة التاجر تعرض الوضع والمصدر الحقيقي، لكنها لا تفتح ERP.

المسار الإداري الجديد:

```text
PATCH /api/admin/stores/{id}/erp-mode
```

يفتح ERP للمحل بعد certified connector فقط، ويعيد معلومات agent onboarding من دون كشف API secret.

غير مكتمل:

```text
merchant warehouse mapping
merchant branch mapping
merchant payment mapping
merchant sync rules editor
merchant sync schedule settings
```

---

## 16) السلامة المالية

**الحالة: جيدة جزئيًا.**

الموجود:

```text
order idempotency
integration event dedupe keys
transactional inventory reservation
financial close draft/review/close
payout requested → approved → paid
ledger entries
integration audit logs
```

المخاطر:

- `invoice.created` الوارد يعتبر حاليًا إغلاقًا/سدادًا/تسليمًا؛ يجب فصلها حسب status contract للـ ERP.
- لا توجد transaction journal مشتركة/immutable لكل تأثير ERP المالي.
- لا توجد reversal/compensation workflow موحد لكل failure بعد external side effect.

---

## مخاطر معمارية رئيسية

1. Adapter layer وصفي أكثر من كونه executable interface.
2. Agent لا ينفذ orders/events pull أو outbox replay فعليًا.
3. Source-of-truth policy لا يزال central ولا يملك per-entity override آمن.
4. لا يوجد Cloud adapter/OAuth/Webhook enterprise path.
5. لا يوجد Conflict Case Management.
6. لا يثبت sandbox certification اتصال ERP حقيقي؛ checklist داخلية فقط.
7. لا يوجد اختبار Postgres/SQL Server/Access/E2E حقيقي لدورة كاملة.

---

## توصيات قبل التشغيل التجاري

### P0 — مانع إطلاق عام

1. بناء adapter contract قابل للتنفيذ، ثم Onyx أو ERP واحد فقط كـ pilot.
2. استكمال Agent:
   ```text
   orders/events pull
   outbox drain/replay
   DPAPI
   Windows Service installer
   signed binary
   ```
3. بناء warehouse/branch/customer/payment mapping الحقيقي.
4. فصل invoice issued عن payment/delivery في inbound apply contract.
5. Conflict table + manual resolution UI.
6. staging E2E مع ERP sandbox ومتجر تجريبي.

### P1 — قبل التوسع لتجار متعددين

1. Cloud OAuth + encrypted credential vault.
2. Generic webhook signature/replay/delivery architecture.
3. Sync freshness/SLA dashboard.
4. Full sync + reconciliation close approval.
5. per-merchant policy overrides بإدارة محكومة.

### P2 — قابلية التوسع

1. Redis/BullMQ أو queue provider فعلي.
2. Outbox/inbox pattern كامل لكل external side effect.
3. Kafka/RabbitMQ فقط عند الحاجة لحجم events كبير.
4. Adapter SDK واختبارات certification قابلة للتكرار لكل provider.

## خطة تنفيذ للوصول إلى Enterprise Architecture

```text
Sprint 1: ERP pilot contract + Agent completion + admin provisioning
Sprint 2: Orders/invoices/returns end-to-end + warehouse/customer/payment maps
Sprint 3: Conflict management + full reconciliation + financial close evidence
Sprint 4: Cloud adapter/OAuth/webhooks + observability/SLA
Sprint 5: Second provider adapter + automated certification suite
```

## فحص محلي مرتبط

| الفحص | النتيجة |
|---|---|
| ESLint | ناجح |
| TypeScript | ناجح |
| Tests | 31 test files / 87 tests passed |
| Migration parity | 57 SQL / 57 journal entries |
| Drizzle check | ناجح |
| Security verification | 0 production dependency vulnerabilities |
| `git diff --check` | ناجح |
