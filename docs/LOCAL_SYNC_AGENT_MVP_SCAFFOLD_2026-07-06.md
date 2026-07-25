# تقرير استكمال المتبقي — Local Sync Agent MVP Scaffold — 2026-07-06

## الهدف
بعد تجهيز Integration APIs ودليل الربط، تم استكمال المرحلة التالية عملياً عبر تجهيز:

1. دعم تسجيل أجهزة Local Sync Agent داخل المنصة.
2. دعم heartbeat لمراقبة حالة Agent.
3. دعم acknowledgement لأحداث المزامنة.
4. API config للـ Agent.
5. Scaffold أولي لبرنامج Local Sync Agent بتقنية .NET 8.
6. SQLite local state/outbox داخل Agent.
7. Connectors أولية لـ SQL Server وAccess/ODBC وCSV.
8. Sync loop أولي يرسل products/inventory ويرسل heartbeat.

> ملاحظة: لم يتم تحويله بعد إلى برنامج Desktop نهائي بواجهة تثبيت وواجهة إعداد، لكنه أصبح scaffold تنفيذي واضح يمكن البناء عليه.

---

## ما تم تنفيذه في المنصة

### 1) جدول أجهزة Agent
تمت إضافة migration:

```txt
drizzle/0037_local_sync_agent_runtime.sql
```

وتضيف جدول:

```txt
integration_agent_devices
```

يسجل:

- `client_key`
- `device_id`
- `device_name`
- `store_id`
- `agent_version`
- `os`
- `connector_type`
- `status`
- `capabilities`
- `last_heartbeat`
- `last_seen_at`

وبهذا يمكن مراقبة كل Agent لكل متجر على حدة.

### 2) API إعدادات Agent

```txt
GET /api/integrations/config
```

يرجع للـ Agent:

- API Version.
- client info.
- store scope.
- endpoints.
- recommended schedule.
- max batch size.

### 3) تسجيل Agent

```txt
POST /api/integrations/agents/register
```

يستقبل:

```json
{
  "deviceId": "stable-device-id",
  "deviceName": "Main Accounting PC",
  "storeId": "STORE_ID",
  "agentVersion": "1.0.0",
  "os": "Windows",
  "connectorType": "sql_server",
  "capabilities": {
    "products": true,
    "inventory": true,
    "orders": true
  }
}
```

ويقوم بـ upsert في `integration_agent_devices`.

### 4) Heartbeat

```txt
POST /api/integrations/agents/heartbeat
```

يسجل حالة Agent:

- online/offline/degraded.
- pending outbox.
- failed items.
- آخر نجاح مزامنة.
- connector status.
- current operation.

### 5) تأكيد معالجة الأحداث

```txt
POST /api/integrations/events/ack
```

يتيح للـ Agent تأكيد معالجة أحداث المنصة:

```json
{
  "eventIds": ["event-id"],
  "status": "processed",
  "agentBatchId": "batch-001"
}
```

أو إرجاع failure:

```json
{
  "eventIds": ["event-id"],
  "status": "failed",
  "error": "Local ERP rejected invoice"
}
```

---

## ما تم تنفيذه في Local Sync Agent Scaffold

تم إنشاء مجلد جديد:

```txt
local-sync-agent/
```

### التقنية

```txt
.NET 8 Worker Service
SQLite Local State
SQL Server Connector
Access/ODBC Connector
CSV Connector
REST API Client
Retry Loop
Serilog logs
```

### الملفات الأساسية

```txt
local-sync-agent/LocalSyncAgent.csproj
local-sync-agent/appsettings.example.json
local-sync-agent/README.md
local-sync-agent/src/Program.cs
local-sync-agent/src/Configuration/AgentOptions.cs
local-sync-agent/src/Models/SyncDtos.cs
local-sync-agent/src/Storage/LocalStateDb.cs
local-sync-agent/src/Connectors/ILocalConnector.cs
local-sync-agent/src/Connectors/SqlServerConnector.cs
local-sync-agent/src/Connectors/AccessOdbcConnector.cs
local-sync-agent/src/Connectors/CsvExcelConnector.cs
local-sync-agent/src/Sync/PlatformApiClient.cs
local-sync-agent/src/Sync/SyncWorker.cs
```

### ما يدعمه Scaffold حالياً

#### SQL Server Connector
يقرأ:

- product code.
- barcode.
- item name.
- sale price.
- quantity.
- last modified.

#### Access/ODBC Connector
يقرأ نفس البيانات عبر ODBC/OLE DB style query.

#### CSV Connector
يقرأ ملفات CSV من مجلد export.

#### Local SQLite Store
ينشئ جداول محلية:

```txt
sync_checkpoints
sync_outbox
sync_inbox
dead_letters
```

#### SyncWorker
ينفذ loop:

- register agent.
- heartbeat.
- push products.
- push inventory.
- update checkpoints.
- retry عند الفشل.

---

## كيف سيستخدمه التاجر لاحقاً

1. الأدمن ينشئ Integration Client للمتجر.
2. التاجر/الفني يثبت Local Sync Agent.
3. ينسخ `appsettings.example.json` إلى `appsettings.json`.
4. يضبط:

```json
{
  "Agent": {
    "BaseUrl": "https://salahsentar22.vercel.app",
    "ClientKey": "store-abc-accounting-agent",
    "ApiKey": "SECRET_FROM_ADMIN",
    "StoreId": "STORE_ID",
    "ConnectorType": "sql_server"
  }
}
```

5. يضبط اتصال SQL Server أو Access أو CSV.
6. يشغل Agent.
7. Agent يسجل نفسه عبر `/api/integrations/agents/register`.
8. يرسل heartbeat دورياً.
9. يرسل المنتجات والمخزون في batches.

---

## Security

- كل endpoints تستخدم نفس Authentication Layer السابق.
- API Key أو Bearer Token إلزامي.
- `x-integration-client-id` يحدد العميل.
- `storeId` يتم التحقق منه عبر `assertStoreAllowed`.
- لا يوجد DB-to-DB.
- لا يوجد inbound port داخل شبكة التاجر.
- Agent يتصل outbound فقط عبر HTTPS.
- API Key الحقيقي لا يجب حفظه داخل Git أو ملفات المشروع.

---

## Multi-store / Multi-merchant Isolation

تم الحفاظ على العزل:

```txt
clientKey + storeIds + scopes
```

كل Agent مربوط بـ:

- clientKey.
- deviceId.
- storeId اختياري.
- scopes.

وبذلك:

```txt
Agent متجر A لا يستطيع الوصول إلى متجر B
```

إذا كانت `storeIds` مقيدة.

---

## ملاحظات تنفيذية

### ما لم يتم بعد

لم يتم بعد بناء:

- Installer رسمي Windows Service.
- UI لإعداد mapping.
- Secret storage عبر Windows DPAPI.
- Auto updater.
- شاشة Logs وRetry.
- معالجة pull orders/events داخل local ERP فعلياً.
- تطبيق changes القادمة من النظام المحلي على domain services فعلياً؛ حالياً يتم إدخالها queue/outbox.

هذه ستكون مرحلة لاحقة.

### لماذا هذا كافٍ الآن؟

لأننا انتقلنا من مجرد Architecture إلى Scaffold عملي يحتوي على:

- project structure.
- connectors.
- DTOs.
- REST client.
- local SQLite.
- sync worker.
- registration/heartbeat APIs.
- ack flow.

وهذا يجعل بناء النسخة التنفيذية النهائية أسهل بكثير.

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
8 test files passed
21 tests passed
```

تمت محاولة build:

```bash
NODE_OPTIONS=--max_old_space_size=4096 NEXT_TELEMETRY_DISABLED=1 npm run build
```

لكن بيئة Arena قتلت العملية بإشارة:

```txt
SIGKILL
```

كما حدث سابقاً بسبب قيود الذاكرة، بينما TypeScript/Lint/Tests ناجحة.

---

## المطلوب لتفعيل المنصة بعد Deploy

تطبيق migrations:

```bash
psql "$DATABASE_URL" -f drizzle/0036_accounting_integration_architecture.sql
psql "$DATABASE_URL" -f drizzle/0037_local_sync_agent_runtime.sql
```

ثم Deploy جديد.

بعدها ستكون endpoints التالية جاهزة:

```txt
/api/integrations/config
/api/integrations/agents/register
/api/integrations/agents/heartbeat
/api/integrations/events/ack
```

بالإضافة إلى endpoints السابقة:

```txt
/api/integrations/health
/api/integrations/products
/api/integrations/inventory
/api/integrations/orders
/api/integrations/invoices
/api/integrations/events
```

---

## الخلاصة

تم استكمال المتبقي على مستوى MVP Scaffold وربط المنصة مع Agent Runtime:

```txt
Salah Center Integration APIs
        ↕
Agent Registration / Heartbeat / Events Ack
        ↕
Local Sync Agent .NET 8 Scaffold
        ↕
SQL Server / Access / CSV Connectors
        ↕
Local Accounting / POS / ERP
```

وهذا يجهزنا للمرحلة التالية: بناء Installer وواجهة إعداد Mapping وتشغيل Agent فعلي عند التاجر.
