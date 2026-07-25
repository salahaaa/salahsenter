# Local Sync Agent Architecture — 2026-07-06

## 1) الهدف العام

بعد تجهيز طبقة التكامل داخل منصة **Salah Center** عبر:

```txt
/api/integrations/*
```

المطلوب مستقبلاً هو بناء برنامج وسيط يعمل داخل جهاز التاجر أو السيرفر المحلي اسمه:

```txt
Local Sync Agent
```

وظيفته ربط المنصة مع أنظمة محاسبية محلية غير Web مثل:

- Microsoft Access.
- SQL Server داخل شبكة محلية.
- POS محلي.
- Desktop ERP.
- ملفات CSV/Excel export.
- أي نظام محاسبي داخل شبكة داخلية.

مع الالتزام بالقاعدة المعمارية:

```txt
Accounting System
        ↓
Local Sync Agent
        ↓
Salah Center APIs
```

وليس:

```txt
Salah Center DB ↔ Local Accounting DB
```

أي لا يوجد اتصال مباشر بين قواعد البيانات.

---

## 2) الشكل المعماري الكامل

```txt
┌──────────────────────────────────────────────────────────┐
│                  Local Merchant Network                  │
│                                                          │
│  ┌─────────────────────┐       ┌─────────────────────┐   │
│  │ Desktop Accounting  │       │ Local Sync Agent    │   │
│  │ Access / SQL Server │◄─────►│ Windows Service     │   │
│  │ POS / ERP / Excel   │       │ + Local SQLite DB   │   │
│  └─────────────────────┘       └─────────┬───────────┘   │
│                                          │ HTTPS          │
└──────────────────────────────────────────┼───────────────┘
                                           │
                                           ▼
                           ┌──────────────────────────────┐
                           │ Salah Center Integration API │
                           │ /api/integrations/*          │
                           └──────────────┬───────────────┘
                                          │
                                          ▼
                           ┌──────────────────────────────┐
                           │ Integration Outbox / Queue   │
                           │ integration_events           │
                           │ background_jobs              │
                           └──────────────┬───────────────┘
                                          │
                                          ▼
                           ┌──────────────────────────────┐
                           │ Salah Center Domain Services │
                           │ Products / Orders / Finance  │
                           └──────────────────────────────┘
```

---

## 3) مكونات Local Sync Agent

### 3.1 Connector Layer

مسؤولة عن قراءة وكتابة البيانات من الأنظمة المحلية.

يدعم مستقبلاً:

```txt
SQL Server Connector
Access Connector
ODBC Connector
CSV/Excel Connector
POS SDK Connector
Generic File Watcher
```

#### SQL Server

طريقة الربط:

- `Microsoft.Data.SqlClient`
- أو ODBC.

مثال قراءة:

```sql
SELECT ItemCode, Barcode, Name, Price, Qty, UpdatedAt
FROM Items
WHERE UpdatedAt > @lastSync
ORDER BY UpdatedAt ASC
```

#### Access

طريقة الربط:

- OLE DB Provider.
- ODBC Driver.

مثال:

```sql
SELECT ItemCode, Barcode, ItemName, SalePrice, Quantity, LastModified
FROM Products
WHERE LastModified > ?
```

#### CSV / Excel

طريقة الربط:

- مراقبة مجلد export.
- قراءة ملفات `.csv` / `.xlsx`.
- نقل الملف إلى `processed/` بعد نجاح المزامنة.
- نقل الملف إلى `failed/` عند فشل validation.

---

### 3.2 Mapping Layer

تحويل أسماء حقول النظام المحلي إلى DTOs الخاصة بالمنصة.

مثال:

```txt
Local ItemCode        → ProductSyncDTO.productCode
Local Barcode         → ProductSyncDTO.barcode
Local SalePrice       → ProductSyncDTO.variants[].price
Local Quantity        → InventorySyncDTO.quantityOnHand
Local InvoiceNo       → InvoiceSyncDTO.externalInvoiceId
```

يجب أن يكون mapping قابل للتعديل لكل تاجر؛ لأن كل نظام محاسبي محلي له أسماء جداول وحقول مختلفة.

أفضل تصميم:

```json
{
  "products": {
    "table": "Items",
    "fields": {
      "productCode": "ItemCode",
      "barcode": "Barcode",
      "name": "ItemName",
      "price": "SalePrice",
      "stock": "Qty",
      "updatedAt": "LastModified"
    }
  }
}
```

---

### 3.3 Local State Store

قاعدة محلية صغيرة داخل Agent، ويفضل:

```txt
SQLite
```

تستخدم لحفظ:

- sync cursors.
- outbox.
- inbox.
- retries.
- dead-letter records.
- device registration.
- آخر نجاح مزامنة.

جداول مقترحة:

```txt
agent_settings
sync_checkpoints
sync_outbox
sync_inbox
sync_attempts
dead_letters
device_registration
```

---

### 3.4 Sync Engine

محرك المزامنة الرئيسي.

مسؤول عن:

- جدولة المزامنة.
- قراءة البيانات المحلية.
- تحويلها إلى DTO.
- وضعها في outbox محلي.
- إرسالها إلى Salah Center APIs.
- سحب أحداث المنصة.
- تطبيق الأحداث محلياً.
- إدارة retry/offline.

---

### 3.5 REST API Client

يتصل بـ Salah Center عبر HTTPS فقط.

Endpoints المستهدفة:

```txt
GET  /api/integrations/health
GET  /api/integrations/products
POST /api/integrations/products
GET  /api/integrations/inventory
POST /api/integrations/inventory
GET  /api/integrations/orders
POST /api/integrations/orders
GET  /api/integrations/invoices
POST /api/integrations/invoices
GET  /api/integrations/events
```

Authentication:

```http
Authorization: Bearer <apiKey>
x-integration-client-id: <clientKey>
```

أو:

```http
x-api-key: <apiKey>
x-integration-client-id: <clientKey>
```

---

## 4) Sync Lifecycle

### 4.1 مرحلة التهيئة Provisioning

```txt
Admin creates Integration Client in Salah Center
        ↓
System generates clientKey + API Key
        ↓
Merchant installs Local Sync Agent
        ↓
Agent stores credentials securely
        ↓
Agent calls /api/integrations/health
        ↓
Agent receives API version + scopes + store scope
        ↓
Agent starts initial sync
```

### 4.2 Initial Sync

```txt
Local Agent reads local catalog
        ↓
Maps to ProductSyncDTO / InventorySyncDTO
        ↓
POST /api/integrations/products
POST /api/integrations/inventory
        ↓
Salah Center accepts batch as 202 Accepted
        ↓
Integration events enter queue
        ↓
Worker processes later
```

### 4.3 Incremental Sync

```txt
Agent reads lastSync cursor
        ↓
Query local changed rows only
        ↓
Send batch with idempotencyKey
        ↓
If success: update cursor
        ↓
If fail: keep outbox item and retry later
```

### 4.4 Pull from Salah Center

```txt
Agent calls GET /api/integrations/orders?since=...
        ↓
Receives new platform orders
        ↓
Writes them into local accounting/POS staging table
        ↓
Accounting system posts invoice/order locally
        ↓
Agent sends external invoice number back later
```

---

## 5) Data Flow Diagrams

### 5.1 Product / Price Sync from Local to Platform

```txt
Accounting Items Table
        ↓ read changed rows
Local Sync Agent Connector
        ↓ map
ProductSyncDTO
        ↓ enqueue local outbox
Local SQLite sync_outbox
        ↓ HTTPS POST
/api/integrations/products
        ↓ accepted 202
integration_events + background_jobs
        ↓ worker later
Salah Center Product Domain
```

### 5.2 Inventory Sync from Local to Platform

```txt
POS / Warehouse Stock
        ↓
Local Sync Agent
        ↓ InventorySyncDTO
POST /api/integrations/inventory
        ↓
Integration Queue
        ↓
Salah Center Inventory Update
```

### 5.3 Order Sync from Platform to Local

```txt
Customer creates order in Salah Center
        ↓
Salah Center emits order.created
        ↓
integration_events outbound
        ↓
Agent polls /api/integrations/events or /orders
        ↓
Agent writes order into local POS/ERP staging
        ↓
Local accounting confirms invoice/order
        ↓
Agent posts invoice/order reference back
```

### 5.4 Invoice Cancellation

```txt
Invoice cancelled in local ERP
        ↓
Agent detects cancellation
        ↓
InvoiceSyncDTO / event invoice.cancelled
        ↓
POST /api/integrations/invoices
        ↓
Salah Center queues validation
        ↓
Domain service reconciles status
```

---

## 6) Source of Truth Strategy

Source of Truth يجب ألا يكون ثابتاً لكل شيء؛ بل يحدد حسب نوع البيانات ونمط تشغيل التاجر.

### 6.1 المنتجات الأساسية

| الحالة | Source of Truth |
|---|---|
| تاجر يستخدم POS/ERP فعلي | Local Accounting/POS |
| تاجر يدير منتجاته من المنصة فقط | Salah Center |
| تاجر هجين | Per-field ownership |

Per-field ownership مثال:

```txt
Product name      → Local ERP
Images            → Salah Center
Description       → Salah Center
Barcode/SKU       → Local ERP
Category mapping  → Salah Center mapping layer
```

### 6.2 المخزون

التوصية:

```txt
Inventory Source of Truth = النظام المحلي/POS
```

لأن المخزون يتأثر بالمبيعات داخل المحل، وليس فقط طلبات المنصة.

لكن يمكن دعم نمط آخر:

```txt
Online-only merchant → Salah Center is source of truth
```

### 6.3 الأسعار

خيارات:

```txt
Local ERP is source of truth
Salah Center promotional price override
Hybrid: base price from ERP, offer price from platform
```

التوصية:

```txt
Base Price → Local ERP
Offers / Campaign Prices → Salah Center
```

### 6.4 الطلبات

```txt
Order creation source of truth = Salah Center
```

لكن:

```txt
Accounting invoice number / posting status = Local Accounting System
```

### 6.5 الفواتير

يعتمد حسب السوق وطريقة المحاسبة:

| النوع | Source of Truth |
|---|---|
| فاتورة بيع إلكترونية للعميل | Salah Center |
| فاتورة محاسبية/ضريبية رسمية | Local Accounting/ERP |
| رقم القيد المحاسبي | Local Accounting/ERP |

### 6.6 المرتجعات

```txt
Return request starts in Salah Center
Financial posting/refund confirmation may come from Local Accounting
```

---

## 7) Conflict Resolution

### 7.1 أنواع التعارض

```txt
price_conflict
inventory_conflict
invoice_status_conflict
order_status_conflict
product_identity_conflict
```

### 7.2 قواعد حل التعارض المقترحة

#### المخزون

```txt
Last write wins ممنوع للمخزون الحساس.
```

الأفضل:

```txt
Local ERP stock snapshot wins
Salah Center reservations are reconciled separately
```

مثال:

```txt
ERP Quantity = 100
Salah Reserved = 5
Available Online = 95
```

#### الأسعار

```txt
Base price from ERP
Active campaign/offer from Salah Center can override display price
```

#### الفاتورة

```txt
If local ERP says invoice cancelled, platform marks invoice under review before final cancellation.
```

#### الطلب

```txt
Salah Center controls order lifecycle until handed to merchant.
Local ERP can return external status/reference, not overwrite unauthorized statuses directly.
```

---

## 8) Retry + Offline Sync Strategy

### 8.1 لا فقدان للبيانات

كل عملية تخرج من Agent يجب أن تمر عبر:

```txt
Local Outbox
```

وليس إرسال مباشر فقط.

```txt
Read local changes
        ↓
Save to local sync_outbox
        ↓
Try send
        ↓
If success: mark sent
If fail: keep pending and retry
```

### 8.2 Exponential Backoff

جدول retry مقترح:

```txt
Attempt 1: after 10 seconds
Attempt 2: after 30 seconds
Attempt 3: after 2 minutes
Attempt 4: after 5 minutes
Attempt 5: after 15 minutes
Then: every 30 minutes
```

مع jitter عشوائي لتجنب thundering herd.

### 8.3 Dead Letter Queue

بعد عدد محاولات معين:

```txt
status = dead_letter
```

ويظهر في واجهة Agent:

```txt
Needs manual review
```

### 8.4 Idempotency

كل batch ترسل بـ:

```txt
idempotencyKey
```

مثال:

```txt
agentId:storeId:products:2026-07-06T10:30:00Z
```

حتى إذا أرسلها Agent مرتين لا يتم تكرار المعالجة.

### 8.5 Offline Mode

عند انقطاع الإنترنت:

- يستمر Agent في قراءة التغييرات المحلية.
- يخزنها في SQLite outbox.
- لا يحذف أي دفعة.
- يعيد الإرسال عند عودة الاتصال.
- يسحب أحداث المنصة لاحقاً حسب cursor.

---

## 9) Event Flow

### 9.1 order.created

```txt
Salah Center
  emits order.created
    ↓
integration_events outbound
    ↓
Local Agent polls events
    ↓
Writes order to local staging table
    ↓
Local ERP posts sales order/invoice
    ↓
Agent sends invoice reference back
```

### 9.2 inventory.updated

```txt
Local POS stock changed
    ↓
Agent detects changed quantity
    ↓
InventorySyncDTO
    ↓
POST /api/integrations/inventory
    ↓
Salah Center validates and queues update
```

### 9.3 invoice.cancelled

```txt
Local ERP cancels invoice
    ↓
Agent detects cancelled flag
    ↓
POST /api/integrations/invoices
    ↓
Salah Center creates reconciliation event
    ↓
Admin/merchant review if needed
```

### 9.4 return.created

```txt
Customer requests return in Salah Center
    ↓
Salah Center emits return.created
    ↓
Agent pulls event
    ↓
Local accounting reserves refund/return document
    ↓
Agent pushes final return/refund status
```

---

## 10) Security Model

### 10.1 API Keys

كل Agent يمتلك:

```txt
clientKey
apiKey
```

يتم إرسالها عبر HTTPS فقط.

### 10.2 Device Registration

التصميم المستقبلي:

```txt
Admin creates integration client
        ↓
Agent first run uses one-time activation code
        ↓
Platform binds device fingerprint
        ↓
Platform issues long-lived API key or rotating token
```

Device metadata:

```txt
machineId
hostname
osVersion
agentVersion
localNetworkName
lastSeenAt
```

### 10.3 Merchant Isolation

كل client لديه:

```txt
storeIds: []
scopes: []
```

إذا كان `storeIds=[store-1]` فلا يستطيع قراءة متجر آخر.

### 10.4 Secrets at Rest

داخل جهاز التاجر:

- Windows DPAPI لحفظ API Key.
- أو encrypted SQLite.
- لا تحفظ المفاتيح plain text في ملف config.

### 10.5 Network Security

- HTTPS إجباري.
- TLS certificate validation.
- عدم فتح inbound ports داخل شبكة التاجر.
- Agent يعمل outbound فقط.
- لا حاجة VPN في المرحلة الأولى.

### 10.6 Audit

كل دفعة يجب أن تحتوي:

```txt
sourceSystem
sourceType
batchId
idempotencyKey
agentVersion
```

وتسجل داخل integration_events.

---

## 11) Scalability Model

### 11.1 على مستوى Agent

Agent يجب أن يدعم:

- batch size قابل للضبط.
- incremental sync.
- throttling.
- retry/backoff.
- file watcher للـ CSV/Excel.
- multiple connectors.
- local queue.

### 11.2 على مستوى المنصة

Integration Layer يدعم:

- pagination.
- cursor-based sync.
- scopes.
- outbox.
- background jobs.
- idempotency.
- queue isolation.

### 11.3 مئات الأنظمة المختلفة

للتعامل مع مئات أنظمة محاسبية مختلفة، لا يجب بناء Agent مخصص لكل نظام من البداية.

التوصية:

```txt
Core Agent + Plugin Connector Architecture
```

مثال:

```txt
Agent Core
 ├─ SQL Server Plugin
 ├─ Access Plugin
 ├─ CSV/Excel Plugin
 ├─ ODBC Generic Plugin
 ├─ POS Vendor A Plugin
 └─ ERP Vendor B Plugin
```

### 11.4 Configuration-driven Mapping

بدلاً من تعديل الكود لكل تاجر:

```txt
mapping.json
```

يحدد:

- الجداول.
- الحقول.
- شروط القراءة.
- اتجاه المزامنة.
- source of truth.
- قواعد التحويل.

---

## 12) التوصية التقنية الأفضل للتنفيذ لاحقاً

### الخيار الموصى به

```txt
.NET 8 Worker Service + Optional WPF/WinUI Admin UI + SQLite Local Store
```

الأسباب:

- أغلب الأنظمة المحاسبية المحلية تعمل على Windows.
- دعم ممتاز لـ SQL Server.
- دعم ODBC/OLE DB/Access.
- مناسب كـ Windows Service.
- سهل التشغيل في الخلفية.
- يمكن إضافة UI محلي للتاجر.
- أداء مستقر للـ long-running services.

### المكونات التقنية المقترحة

```txt
.NET 8 Worker Service
Microsoft.Data.SqlClient
System.Data.Odbc
OleDb Provider for Access
SQLite
Polly for retries
Serilog for local logs
WPF/WinUI optional UI
Windows DPAPI for secrets
HttpClientFactory for REST APIs
```

### بدائل ممكنة

#### Node.js/Electron

مناسب إذا أردنا UI سريع متعدد المنصات، لكنه أضعف في تكامل Access/ODBC أحياناً.

#### Python Service

جيد للـ scripting والـ CSV/ODBC، لكنه يحتاج packaging مضبوط على Windows.

#### Go Agent

قوي وخفيف، لكنه أقل مرونة مع Access/OLE DB.

التوصية النهائية:

```txt
.NET 8 هو الخيار الأفضل للمرحلة الأولى بسبب طبيعة الأنظمة المحاسبية المحلية في السوق.
```

---

## 13) MVP المقترح للـ Agent مستقبلاً

### Phase 1

- Windows Service.
- SQLite local outbox.
- SQL Server connector.
- Access connector.
- Products + Inventory sync.
- API Key auth.
- Retry/offline.

### Phase 2

- Orders pull.
- Invoice reference push.
- Events pull.
- UI لإعداد mapping.
- Logs viewer.

### Phase 3

- Plugin SDK.
- Auto-updater.
- Remote diagnostics.
- Conflict dashboard.
- Multi-store per agent.

---

## 14) Local Agent Internal Tables

```txt
agent_settings
- key
- value
- encrypted

sync_checkpoints
- resource
- storeId
- lastCursor
- lastSyncedAt

sync_outbox
- id
- resource
- payload
- idempotencyKey
- status
- attempts
- nextAttemptAt
- lastError

sync_inbox
- id
- eventId
- eventType
- payload
- status
- processedAt

dead_letters
- id
- sourceId
- reason
- payload
- createdAt
```

---

## 15) Operational Monitoring

Agent يجب أن يرسل heartbeat مستقبلاً:

```http
POST /api/integrations/agents/heartbeat
```

معلومات مقترحة:

```json
{
  "agentVersion": "1.0.0",
  "deviceId": "...",
  "storeId": "...",
  "lastSuccessfulSyncAt": "...",
  "pendingOutbox": 10,
  "failedItems": 1,
  "connectorStatus": "ok"
}
```

ويظهر في لوحة الأدمن/التاجر:

```txt
Agent Online / Offline
Last Sync
Pending Items
Failed Items
Connector Type
```

---

## 16) خلاصة القرار المعماري

البنية المقترحة تحقق:

- عدم ربط قواعد البيانات مباشرة.
- حماية بيانات المنصة والتاجر.
- دعم Access/SQL Server/POS/ERP/Excel.
- تحمل انقطاع الإنترنت.
- منع فقدان البيانات.
- دعم مئات الأنظمة عبر plugins وmapping.
- قابلية التوسع عبر queue/outbox.
- قابلية التدقيق والمراجعة.

النموذج النهائي:

```txt
Desktop Accounting System
        ↕ Local Connector
Local Sync Agent
        ↕ Local SQLite Outbox/Inbox
Salah Center Integration APIs
        ↕ Integration Events + Background Jobs
Salah Center Domain Services
```

وهذا هو الأسلوب الأنسب لمنصة Enterprise متعددة التجار قابلة للتكامل مع أنظمة محاسبية محلية متنوعة.
