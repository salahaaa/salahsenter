# Accounting Integration Architecture — 2026-07-06

## الهدف
تجهيز بنية Enterprise لربط منصة Salah Center مستقبلاً مع أنظمة محاسبية محلية غير Web مثل:

- Microsoft Access.
- SQL Server داخل شبكة محلية.
- POS محلي.
- Desktop ERP.
- نظام محاسبي Desktop داخل شبكة التاجر.

مع الالتزام بالمعمارية الصحيحة:

```txt
Salah Center API ↔ Integration Layer ↔ Local Sync Agent ↔ Desktop Accounting System
```

وليس:

```txt
Database ↔ Database
```

أي أن النظام المحاسبي المحلي لا يصل مباشرة إلى قاعدة بيانات Salah Center، والمنصة لا تتصل مباشرة بقاعدة بيانات التاجر المحلية.

---

## Architecture Proposal

### 1) Salah Center Integration Layer
طبقة API داخل المنصة توفر Contracts ثابتة وموثقة للـ Local Sync Agent.

المسار الأساسي:

```txt
/api/integrations/*
```

وظائفها:

- تصدير المنتجات إلى النظام المحاسبي.
- تصدير المخزون والأسعار.
- تصدير الطلبات والفواتير.
- استقبال دفعات تحديث من النظام المحاسبي بدون تنفيذ مباشر داخل request.
- تسجيل Integration Events داخل outbox قابل للمعالجة الخلفية.
- دعم API Key/Bearer Token.
- دعم Store-scoped access في منصة متعددة التجار.

### 2) Local Sync Agent — مستقبلاً
برنامج مستقل يتم تركيبه داخل شبكة التاجر أو المحاسب.

مسؤوليته مستقبلاً:

- الاتصال المحلي بـ Access/SQL Server/POS/ERP عبر ODBC/OLE DB/SDK.
- تحويل بيانات النظام المحلي إلى DTOs موحدة.
- الاتصال بـ Salah Center APIs عبر HTTPS.
- حفظ cursors محلياً مثل `lastSyncedAt`.
- تنفيذ retry محلي عند انقطاع الإنترنت.
- عدم كشف قاعدة بيانات التاجر للإنترنت.

### 3) Queue-ready Architecture
طلبات POST القادمة من Agent لا تحدث المخزون/الفواتير مباشرة الآن، بل يتم قبولها ووضعها في:

- `integration_events`
- `background_jobs` queue باسم `integrations`

بحيث يمكن لاحقاً بناء Worker مستقل لمعالجة:

- Redis Queue.
- Retry System.
- Dead-letter queue.
- Webhook dispatch.
- Conflict resolution.

---

## الملفات الجديدة والمعدلة

### ملفات جديدة

```txt
lib/integrations/accounting/auth.ts
lib/integrations/accounting/dtos.ts
lib/integrations/accounting/events.ts
lib/integrations/accounting/service.ts

app/api/integrations/health/route.ts
app/api/integrations/products/route.ts
app/api/integrations/inventory/route.ts
app/api/integrations/orders/route.ts
app/api/integrations/invoices/route.ts
app/api/integrations/events/route.ts

drizzle/0036_accounting_integration_architecture.sql

tests/accounting-integration-auth.test.ts
```

### ملفات معدلة

```txt
lib/db/schema.ts
middleware.ts
.env.example
.env.production.example
```

---

## Database / Outbox Design

تمت إضافة migration:

```txt
drizzle/0036_accounting_integration_architecture.sql
```

### جدول integration_clients
لحفظ عملاء التكامل مستقبلاً:

- `client_key`
- `name`
- `provider`
- `token_hash`
- `status`
- `store_ids`
- `scopes`
- `metadata`
- `last_seen_at`

> لا يتم حفظ API Key الخام. يتم حفظ SHA-256 hash فقط.

### جدول integration_events
Outbox/Ingestion table للأحداث:

- `provider`
- `direction`: inbound/outbound.
- `event_type`
- `entity_type`
- `entity_id`
- `store_id`
- `status`
- `payload`
- `attempts`
- `next_attempt_at`
- `processed_at`
- `last_error`
- `dedupe_key`

---

## DTO Contracts

تم إنشاء DTOs موحدة في:

```txt
lib/integrations/accounting/dtos.ts
```

### ProductSyncDTO
يحتوي على:

- `productId`
- `externalProductId`
- `storeId`
- `sku`
- `barcode`
- `productCode`
- `name`
- `description`
- `brand`
- `status`
- `basePrice`
- `discountPercent`
- `variants[]`
- `updatedAt`

### InventorySyncDTO
يحتوي على:

- `storeId`
- `productId`
- `variantId`
- `sku`
- `barcode`
- `productName`
- `quantityOnHand`
- `reservedQuantity`
- `availableQuantity`
- `lowStockThreshold`
- `updatedAt`

### OrderSyncDTO
يحتوي على:

- `orderId`
- `orderNumber`
- `storeId`
- `customerId`
- `statusCode`
- `paymentStatus`
- `currency`
- `subtotal`
- `shippingFee`
- `discountTotal`
- `grandTotal`
- `deliveryAddress`
- `lines[]`
- `createdAt`
- `updatedAt`

### InvoiceSyncDTO
يحتوي على:

- `invoiceId`
- `invoiceNumber`
- `orderId`
- `orderNumber`
- `storeId`
- `status`
- `currency`
- `total`
- `issuedAt`
- `lines[]`
- `sellerSnapshot`
- `buyerSnapshot`
- `totalsSnapshot`
- `updatedAt`

---

## API Contracts

كل endpoints تستخدم:

```txt
Authorization: Bearer <token>
```

أو:

```txt
x-api-key: <token>
x-integration-client-id: <clientKey>
```

### Health

```http
GET /api/integrations/health
```

يرجع حالة Integration Layer ونسخة العقد.

### Products

```http
GET /api/integrations/products?storeId=<storeId>&since=<iso>&cursor=<iso>&limit=100
```

يرجع `ProductSyncDTO[]`.

```http
POST /api/integrations/products
```

يقبل دفعة منتجات من Agent، ولا ينفذها مباشرة؛ بل يضعها في queue/outbox.

مثال body:

```json
{
  "sourceSystem": "Local Access Accounting",
  "sourceType": "access",
  "batchId": "products-2026-07-06-001",
  "idempotencyKey": "agent-a-products-001",
  "items": [
    {
      "externalProductId": "P-1001",
      "name": "منتج محلي",
      "sku": "SKU-1001",
      "price": 1200
    }
  ]
}
```

### Inventory

```http
GET /api/integrations/inventory?storeId=<storeId>&since=<iso>&cursor=<iso>&limit=100
```

يرجع `InventorySyncDTO[]`.

```http
POST /api/integrations/inventory
```

يقبل دفعة تحديث مخزون للمعالجة الخلفية.

### Orders

```http
GET /api/integrations/orders?storeId=<storeId>&since=<iso>&cursor=<iso>&limit=100
```

يرجع `OrderSyncDTO[]`.

```http
POST /api/integrations/orders
```

يقبل دفعة تحديث حالة/أرقام مرجعية من Agent للمعالجة الخلفية.

### Invoices

```http
GET /api/integrations/invoices?storeId=<storeId>&since=<iso>&cursor=<iso>&limit=100
```

يرجع `InvoiceSyncDTO[]`.

```http
POST /api/integrations/invoices
```

يقبل دفعة فواتير/أرقام خارجية من Agent للمعالجة الخلفية.

### Events Outbox

```http
GET /api/integrations/events?storeId=<storeId>&status=pending&since=<iso>&limit=100
```

يرجع أحداث outbound الجاهزة للمزامنة مستقبلاً.

---

## Auth Strategy

### 1) Database Clients — الإنتاج المفضل
يتم إنشاء سجل في:

```txt
integration_clients
```

مع:

```txt
token_hash = sha256(apiKey)
```

ثم يرسل Agent:

```http
Authorization: Bearer <apiKey>
x-integration-client-id: <client_key>
```

### 2) Environment fallback — للإعداد الأولي
تمت إضافة:

```env
INTEGRATION_API_KEYS="agent-1:local-secret:*:*"
```

أو:

```env
INTEGRATION_CLIENTS_JSON='[{"clientId":"agent-1","token":"local-secret","storeIds":[],"scopes":["*"]}]'
```

### 3) Scopes
النظام يدعم scopes مثل:

```txt
products:read
products:write
inventory:read
inventory:write
orders:read
orders:write
invoices:read
invoices:write
events:read
events:write
```

ويدعم أيضاً `*` للعميل الداخلي الموثوق.

### 4) Store-scoped Access
`store_ids` الفارغة تعني كل المتاجر للعميل المصرح، أو يمكن تقييد Agent بمتجر معين فقط.

---

## Webhook / Event Architecture

تم إنشاء:

```txt
lib/integrations/accounting/events.ts
```

ويحتوي على hooks مستقبلية مثل:

- `productUpdated`
- `inventoryUpdated`
- `orderCreated`
- `invoiceIssued`

هذه hooks تكتب في outbox:

```txt
integration_events
```

وتنشئ job في:

```txt
background_jobs queue='integrations'
```

الأحداث المدعومة معمارياً:

```txt
product.created
product.updated
inventory.updated
price.updated
order.created
order.updated
invoice.issued
invoice.cancelled
return.created
return.updated
```

---

## Queue-ready Design

طلبات POST لا تطبق التحديث مباشرة داخل request.

بدلاً من ذلك:

1. يتم التحقق من Auth/Scope.
2. يتم Validate للـ envelope.
3. يتم إنشاء `integration_events` direction=inbound.
4. يتم إنشاء `background_jobs` queue=`integrations`.
5. يرجع API استجابة 202 Accepted.

هذا يجهز لاحقاً لبناء:

- `integrations:worker`
- retry/backoff
- dead-letter queue
- conflict resolution
- idempotency
- agent acknowledgements

---

## Security Considerations

- لا يوجد DB ↔ DB.
- لا يتم كشف DATABASE_URL لأي نظام خارجي.
- API Key/Bearer Token إلزامي.
- دعم token hash في DB.
- استخدام timing-safe compare.
- دعم scopes.
- دعم store-level restriction.
- CSRF تم استثناؤه فقط لمسار `/api/integrations/*` لأن الاستهلاك خارجي، مع الاعتماد على API key بدلاً من session/CSRF.
- عدم حفظ أسرار في الملفات.
- idempotency/dedupe keys لتجنب تكرار الدفعات.
- POST لا يحدث البيانات مباشرة، بل يدخل queue/outbox.

---

## Scalability Considerations

- دعم pagination عبر `limit` و`cursor`.
- دعم incremental sync عبر `since`.
- limit أقصى 500 لكل request.
- outbox table قابل للمعالجة بالـ workers.
- queue مستقلة باسم `integrations` حتى لا تتداخل مع jobs العادية.
- dedupe keys لمنع double-processing.
- قابل للتوسع لاحقاً مع Redis Queue / BullMQ / Upstash Queue.
- صالح لمنصة متعددة التجار عبر store scopes.

---

## ملاحظات مهمة

### Local Sync Agent غير منفذ حالياً
حسب المطلوب، لم يتم بناء برنامج Desktop الآن. تم تجهيز API contracts والبنية فقط.

### تطبيق migration مطلوب
قبل استخدام clients/events في قاعدة البيانات:

```bash
psql "$DATABASE_URL" -f drizzle/0036_accounting_integration_architecture.sql
```

### Deploy مطلوب
بعد النشر ستتوفر endpoints:

```txt
/api/integrations/health
/api/integrations/products
/api/integrations/inventory
/api/integrations/orders
/api/integrations/invoices
/api/integrations/events
```

---

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

وهذا بسبب قيود ذاكرة البيئة، بينما TypeScript/Lint/Tests ناجحة.

---

## النتيجة
تم تجهيز Accounting Integration Architecture بطريقة Enterprise صحيحة وقابلة للتوسع مستقبلاً لربط أي Access/SQL Server/POS/Desktop ERP عبر Local Sync Agent، بدون ربط قواعد البيانات مباشرة، وباعتماد API contracts وAuth وOutbox/Queue-ready Event Architecture.
