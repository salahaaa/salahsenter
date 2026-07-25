# دليل ربط التاجر مع النظام المحاسبي المحلي — Accounting Integration Linking Guide

تاريخ: 2026-07-06

## 1) الإجابة المختصرة

نعم، تم حساب أن **كل تاجر/متجر له ربطه الخاص ونظامه الخاص**.

البنية الحالية تدعم:

- API Key مستقل لكل تاجر أو متجر.
- `clientKey` مستقل لكل Local Sync Agent.
- تقييد الربط بمتجر واحد أو أكثر عبر `storeIds`.
- صلاحيات scopes لكل ربط مثل: قراءة منتجات فقط، تحديث مخزون فقط، قراءة طلبات، إلخ.
- عدم ربط قواعد البيانات مباشرة.
- قابلية ربط أنظمة مختلفة لكل متجر: Access، SQL Server، POS، ERP، CSV/Excel.

المعادلة الصحيحة:

```txt
متجر / تاجر
  له Integration Client خاص
  له API Key خاص
  له Store Scope خاص
  له Mapping خاص حسب نظامه المحاسبي
```

---

## 2) من ينفذ عملية الربط؟

يوجد طرفان في الربط:

### 2.1 الأدمن في Salah Center

مسؤول عن:

1. إنشاء عميل تكامل Integration Client.
2. تحديد المتجر/المتاجر المسموح لها.
3. تحديد الصلاحيات scopes.
4. تسليم التاجر أو الفني:
   - `clientKey`
   - `apiKey`
   - رابط المنصة
   - storeId

### 2.2 التاجر أو الفني المحلي

مسؤول عن:

1. تثبيت Local Sync Agent على جهاز التاجر أو السيرفر المحلي.
2. إدخال بيانات الربط:
   - رابط Salah Center.
   - clientKey.
   - API Key.
   - storeId.
3. اختيار نوع النظام المحلي:
   - Access
   - SQL Server
   - POS
   - ERP
   - CSV/Excel
4. ضبط mapping بين حقول النظام المحلي وحقول المنصة.
5. تشغيل اختبار الاتصال.
6. تشغيل أول مزامنة.

---

## 3) هل كل متجر له ربط خاص؟

نعم.

في قاعدة البيانات تم تصميم جدول:

```txt
integration_clients
```

وفيه:

```txt
client_key
name
provider
token_hash
status
store_ids
scopes
metadata
last_seen_at
```

### مثال 1: متجر واحد له نظام محاسبي واحد

```json
{
  "clientKey": "store-elite-fashion-agent",
  "storeIds": ["STORE_ID_ELITE_FASHION"],
  "scopes": [
    "products:read",
    "products:write",
    "inventory:read",
    "inventory:write",
    "orders:read",
    "invoices:read",
    "events:read"
  ]
}
```

هذا Agent لا يستطيع الوصول إلا لهذا المتجر فقط.

### مثال 2: تاجر لديه أكثر من متجر ونظام محاسبي واحد

يمكن إنشاء client واحد بعدة متاجر:

```json
{
  "clientKey": "merchant-group-agent",
  "storeIds": ["STORE_ID_1", "STORE_ID_2", "STORE_ID_3"],
  "scopes": ["*"]
}
```

لكن التوصية الأفضل Enterprise:

```txt
Client منفصل لكل متجر
```

حتى تكون العزل والمراجعة أسهل.

### مثال 3: متجر واحد لديه أكثر من نظام

مثلاً:

- POS للمخزون.
- ERP للفواتير.

ننشئ clientين:

```txt
store-a-pos-agent      scopes: inventory:read, inventory:write
store-a-erp-agent      scopes: orders:read, invoices:read, invoices:write
```

---

## 4) خطوات الربط العملية للتاجر

## المرحلة الأولى — تجهيز الربط من لوحة الإدارة

حالياً تم تجهيز البنية والجداول والـ APIs. إذا لم نبنِ واجهة إدارة Integration Clients بعد، يتم إنشاء العميل مبدئياً من قاعدة البيانات أو script إداري.

### 4.1 إنشاء API Key

على جهاز آمن:

```bash
openssl rand -hex 32
```

مثال ناتج:

```txt
7b9f...secret...e21a
```

هذا هو الـ API Key الذي سيستخدمه Agent.

### 4.2 حساب SHA-256 للـ API Key

```bash
node -e "const crypto=require('crypto'); console.log(crypto.createHash('sha256').update(process.argv[1]).digest('hex'))" "PUT_API_KEY_HERE"
```

### 4.3 إنشاء Integration Client

مثال SQL توضيحي، بدون أسرار حقيقية:

```sql
INSERT INTO integration_clients (
  client_key,
  name,
  provider,
  token_hash,
  status,
  store_ids,
  scopes,
  metadata
)
VALUES (
  'store-abc-accounting-agent',
  'Store ABC Local Accounting Agent',
  'accounting',
  'SHA256_HASH_HERE',
  'active',
  '["STORE_ID_HERE"]'::jsonb,
  '["products:read","products:write","inventory:read","inventory:write","orders:read","invoices:read","events:read"]'::jsonb,
  '{"systemType":"sql_server","installedBy":"admin"}'::jsonb
);
```

> مهم: لا نحفظ API Key الخام في قاعدة البيانات. نحفظ hash فقط.

---

## المرحلة الثانية — تثبيت Local Sync Agent عند التاجر

مستقبلاً، التاجر أو الفني سيقوم بتثبيت برنامج Local Sync Agent على:

```txt
جهاز المحاسب
أو سيرفر المحل المحلي
أو جهاز POS الرئيسي
```

ثم يدخل:

```txt
Salah Center URL: https://salahsentar22.vercel.app
clientKey: store-abc-accounting-agent
apiKey: المفتاح السري المسلم من الإدارة
storeId: STORE_ID_HERE
```

---

## المرحلة الثالثة — اختبار الاتصال

Agent ينفذ:

```http
GET /api/integrations/health
Authorization: Bearer <apiKey>
x-integration-client-id: store-abc-accounting-agent
```

مثال curl:

```bash
curl https://salahsentar22.vercel.app/api/integrations/health \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "x-integration-client-id: store-abc-accounting-agent"
```

النتيجة المتوقعة:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "apiVersion": "2026-07-06.accounting.v1",
    "architecture": "API ↔ Integration Layer ↔ Local Sync Agent",
    "resources": ["products", "inventory", "orders", "invoices", "events"]
  }
}
```

إذا رجع 401:

```txt
API Key خطأ أو clientKey غير صحيح
```

إذا رجع 403:

```txt
الصلاحية أو store scope غير كافي
```

---

## المرحلة الرابعة — ضبط مصدر البيانات المحلي

### 4.4 SQL Server

يدخل الفني:

```txt
Server: localhost\SQLEXPRESS
Database: AccountingDB
Auth: Windows أو SQL Auth
```

ويحدد query المنتجات:

```sql
SELECT
  ItemCode,
  Barcode,
  ItemName,
  SalePrice,
  Quantity,
  LastModified
FROM Items
WHERE LastModified > @lastSync
ORDER BY LastModified ASC
```

### 4.5 Access

يدخل:

```txt
File Path: C:\Accounting\data.accdb
Table: Items
```

Query:

```sql
SELECT
  ItemCode,
  Barcode,
  ItemName,
  SalePrice,
  Quantity,
  LastModified
FROM Items
WHERE LastModified > ?
```

### 4.6 CSV/Excel

يحدد:

```txt
Export folder: C:\SalahSync\exports
Processed folder: C:\SalahSync\processed
Failed folder: C:\SalahSync\failed
```

---

## المرحلة الخامسة — ضبط Mapping

كل نظام محلي له أسماء مختلفة، لذلك يتم ضبط mapping.

مثال:

```json
{
  "products": {
    "source": "sql_server",
    "table": "Items",
    "fields": {
      "productCode": "ItemCode",
      "barcode": "Barcode",
      "name": "ItemName",
      "price": "SalePrice",
      "stock": "Quantity",
      "updatedAt": "LastModified"
    }
  }
}
```

---

## المرحلة السادسة — أول مزامنة Initial Sync

Agent يقرأ المنتجات والمخزون من النظام المحلي ثم يرسلها.

### إرسال المنتجات

```http
POST /api/integrations/products
Authorization: Bearer <apiKey>
x-integration-client-id: store-abc-accounting-agent
Content-Type: application/json
```

Body:

```json
{
  "sourceSystem": "Store ABC SQL Server",
  "sourceType": "sql_server",
  "batchId": "products-initial-001",
  "idempotencyKey": "store-abc-products-initial-001",
  "items": [
    {
      "externalProductId": "1001",
      "productCode": "ITM-1001",
      "barcode": "628000000001",
      "name": "منتج تجريبي",
      "price": 1500,
      "stock": 20
    }
  ]
}
```

النتيجة:

```json
{
  "success": true,
  "data": {
    "accepted": true,
    "message": "تم قبول دفعة المنتجات للمعالجة الخلفية"
  }
}
```

### إرسال المخزون

```http
POST /api/integrations/inventory
```

بنفس أسلوب الدفعات.

---

## المرحلة السابعة — المزامنة المستمرة Incremental Sync

Agent يحفظ محلياً:

```txt
lastProductsSyncAt
lastInventorySyncAt
lastOrdersSyncAt
lastInvoicesSyncAt
```

ثم يقرأ فقط السجلات المتغيرة:

```sql
WHERE LastModified > @lastProductsSyncAt
```

ويرسل batches صغيرة.

---

## المرحلة الثامنة — استقبال الطلبات من المنصة

Agent يسحب الطلبات الجديدة:

```bash
curl "https://salahsentar22.vercel.app/api/integrations/orders?storeId=STORE_ID&since=2026-07-06T00:00:00Z" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "x-integration-client-id: store-abc-accounting-agent"
```

المنصة ترجع:

```txt
OrderSyncDTO[]
```

Agent يقوم بـ:

1. حفظ الطلب في local staging table.
2. إنشاء sales order أو invoice داخل النظام المحاسبي.
3. حفظ رقم الفاتورة المحلي.
4. إرسال رقم الفاتورة أو حالة المعالجة لاحقاً إلى المنصة عبر `/api/integrations/invoices`.

---

## المرحلة التاسعة — استقبال الأحداث من المنصة

Agent يسحب events:

```http
GET /api/integrations/events?storeId=STORE_ID&status=pending&limit=100
```

أمثلة أحداث مستقبلية:

```txt
order.created
order.updated
inventory.updated
invoice.cancelled
return.created
return.updated
```

---

## 5) Source of Truth لكل متجر

نعم، يجب تحديده لكل متجر عند الربط.

### النموذج الافتراضي المقترح

| البيانات | المسؤول الأساسي |
|---|---|
| المنتجات الأساسية | النظام المحاسبي المحلي أو المنصة حسب اختيار التاجر |
| المخزون | POS/ERP المحلي غالباً |
| السعر الأساسي | النظام المحلي غالباً |
| عروض وتخفيضات المنصة | Salah Center |
| الطلبات الإلكترونية | Salah Center |
| رقم الفاتورة المحاسبية | النظام المحلي |
| المرتجعات | تبدأ من Salah Center وتُرحّل محاسبياً محلياً |

### مثال إعداد لمتجر يستخدم POS

```json
{
  "sourceOfTruth": {
    "products": "local",
    "inventory": "local",
    "basePrices": "local",
    "promotions": "salah_center",
    "orders": "salah_center",
    "accountingInvoices": "local"
  }
}
```

---

## 6) حل التعارضات

### المخزون

لا نستخدم last-write-wins بشكل أعمى.

الأفضل:

```txt
Local POS stock snapshot wins
Salah Center reservations are reconciled
```

مثال:

```txt
مخزون POS = 100
محجوز في المنصة = 5
المتاح Online = 95
```

### الأسعار

```txt
Base price من النظام المحلي
Offer price من Salah Center
```

### الطلبات

```txt
Salah Center ينشئ الطلب
النظام المحلي يعطي رقم فاتورة/قيد محاسبي
```

### الفواتير

```txt
الفاتورة الرسمية المحاسبية من النظام المحلي
الفاتورة الإلكترونية/عرض الطلب من Salah Center
```

---

## 7) Offline + Retry Model

Agent لا يرسل مباشرة فقط. يجب أن يكتب أولاً في Local Outbox.

```txt
Read local changes
        ↓
Save to SQLite sync_outbox
        ↓
Try POST to Salah Center
        ↓
Success → mark sent
Fail → keep pending and retry
```

### Retry schedule

```txt
Attempt 1: 10s
Attempt 2: 30s
Attempt 3: 2m
Attempt 4: 5m
Attempt 5: 15m
Then: every 30m
```

### عند انقطاع الإنترنت

- لا تضيع البيانات.
- تستمر في local outbox.
- تعاد المزامنة عند عودة الإنترنت.
- لا يتم تحديث cursor إلا بعد نجاح الإرسال.

---

## 8) نموذج تشغيل يومي للتاجر

### في البداية

```txt
1. الأدمن ينشئ ربط للمتجر.
2. التاجر يثبت Agent.
3. الفني يضبط اتصال SQL/Access/POS.
4. الفني يضبط Mapping.
5. تشغيل Test Connection.
6. تشغيل Initial Sync.
7. مراجعة المنتجات والمخزون في لوحة التاجر.
8. تفعيل Auto Sync.
```

### يومياً

```txt
Agent يعمل في الخلفية:
- كل 5 دقائق يرسل المخزون المتغير.
- كل 5 دقائق يسحب الطلبات الجديدة.
- كل 15 دقيقة يرسل تغيرات الأسعار/المنتجات.
- عند الفشل يخزن ويرسل لاحقاً.
```

---

## 9) هل يستطيع تاجر الوصول لبيانات تاجر آخر؟

لا، إذا تم ضبط `storeIds` بشكل صحيح.

مثال:

```json
"storeIds": ["STORE_A"]
```

أي طلب يحاول استخدام:

```txt
storeId=STORE_B
```

يرجع:

```txt
403 Forbidden
```

لأن auth layer تنفذ:

```txt
assertStoreAllowed(context, storeId)
```

---

## 10) هل كل تاجر يمكن أن يملك نظام مختلف؟

نعم.

هذا يتم عبر metadata وmapping في Agent.

أمثلة:

```json
{
  "storeId": "STORE_A",
  "systemType": "access",
  "mappingProfile": "access-basic-v1"
}
```

```json
{
  "storeId": "STORE_B",
  "systemType": "sql_server",
  "mappingProfile": "sqlserver-pos-v2"
}
```

```json
{
  "storeId": "STORE_C",
  "systemType": "csv_excel",
  "mappingProfile": "excel-simple-v1"
}
```

---

## 11) سياسة الربط الموصى بها Enterprise

### لكل متجر Agent مستقل

أفضل عزل:

```txt
One Store = One Integration Client = One API Key
```

### لتاجر لديه فروع كثيرة

خياران:

#### آمن وواضح

```txt
Client منفصل لكل فرع/متجر
```

#### أبسط في التشغيل

```txt
Client واحد مع storeIds متعددة
```

التوصية:

```txt
ابدأ بـ Client مستقل لكل متجر.
```

---

## 12) Checklist للتاجر والفني

قبل التفعيل:

```txt
[ ] تم إنشاء clientKey وAPI Key.
[ ] تم تقييد storeIds.
[ ] تم تحديد scopes.
[ ] تم تثبيت Agent.
[ ] تم اختبار /api/integrations/health.
[ ] تم ضبط اتصال النظام المحلي.
[ ] تم ضبط mapping.
[ ] تم تشغيل initial sync على بيئة تجريبية أو dry-run.
[ ] تم التأكد من المنتجات.
[ ] تم التأكد من المخزون.
[ ] تم اختبار سحب طلب جديد.
[ ] تم تفعيل Auto Sync.
```

---

## 13) ماذا بقي للتنفيذ لاحقاً؟

حالياً تم تجهيز المنصة وAPI contracts.

المتبقي عندما نبدأ بناء Agent:

1. بناء Windows Service بـ .NET 8.
2. بناء SQLite local outbox.
3. بناء SQL Server connector.
4. بناء Access connector.
5. بناء CSV/Excel connector.
6. بناء شاشة إعداد Mapping.
7. بناء شاشة Logs وRetry.
8. بناء Device Registration UI.
9. بناء Auto Updater.

---

## 14) الخلاصة

نعم، تم حساب أن كل تاجر/متجر له ربط خاص به.

التصميم يدعم:

- API Key لكل Agent.
- Store isolation.
- Scopes.
- أنظمة محلية مختلفة لكل متجر.
- Mapping مختلف لكل تاجر.
- Source of Truth مختلف حسب سياسة المتجر.
- Offline sync.
- Retry.
- Outbox.
- Queue-ready processing.

الربط النهائي للتاجر سيكون بهذه الصورة:

```txt
1. الأدمن ينشئ Integration Client للمتجر.
2. التاجر/الفني يثبت Local Sync Agent.
3. يدخل clientKey + API Key + storeId.
4. يختار نوع النظام المحلي.
5. يضبط Mapping.
6. يشغل Test Connection.
7. يشغل Initial Sync.
8. يفعل Auto Sync.
```

وبذلك يصبح كل متجر مربوطاً بنظامه المحاسبي الخاص بدون أي اختلاط مع متاجر أخرى وبدون أي ربط مباشر بقواعد البيانات.
