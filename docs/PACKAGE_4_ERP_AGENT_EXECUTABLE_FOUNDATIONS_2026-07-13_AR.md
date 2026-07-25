# تقرير الحزمة 4 — ERP وLocal Sync Agent

**الحالة:** تم تقوية البنية التنفيذية محلياً. لا يوجد ادعاء بتكامل ERP حي أو Agent binary مختبر في هذه البيئة.

## المنجز

### 1) عقد ERP قابل للتنفيذ

ملف جديد:

```text
lib/integrations/erp/connector-contract.ts
```

العقد يفرض العمليات التالية على أي Adapter حقيقي:

```text
createOrder
createInvoice
syncInventory
syncCustomers
syncPayments
fetchWarehouses
fetchBranches
fetchPriceLists
fetchPaymentMethods
```

ويشمل DTOs وValidation للطلبات، الفواتير، المخزون، العميل، المخازن، الفروع، وسائل الدفع وقوائم الأسعار.

### 2) Mapping تشغيلي typed

تمت إضافة mapping صريح إلى Profile:

```text
warehouses
branches
customers
payments
priceLists
```

كما تم توسيع Checklist شهادة ERP لتتطلب هذه الخرائط قبل الاعتماد، إلى جانب خرائط المنتجات/المخزون/الطلبات/الفواتير وسياسة التعارض والـ sync الناجح.

### 3) Local Sync Agent

تم تطوير Agent في:

```text
local-sync-agent/
```

- استبدال no-op الصامت في SQL Server وAccess:
  - أوامر Parameterized قابلة للتكوين `ApplyOrderCommand` و`ApplyEventCommand`.
  - إذا لم يجهز التاجر staging command، يفشل التطبيق بوضوح ولا يؤكد الحدث للمنصة.
- CSV/Excel يكتب أوامر المنصة وأحداثها إلى:
  ```text
  inbound-orders
  inbound-events
  ```
- إضافة Pull للطلبات والأحداث من منصة التكامل.
- SQLite inbox: لا يؤكد الحدث للمنصة قبل نجاح `ApplyPlatformOrderAsync` أو `ApplyPlatformEventAsync`.
- SQLite outbox: retry/backoff، عداد محاولات وdead-letter محلي، وإعادة دفع بعد انقطاع الشبكة.
- Heartbeat يرسل عداد outbox وdead-letter.
- API Key من:
  ```text
  SALAH_SYNC_API_KEY
  ```
  أو Windows DPAPI file عبر `ApiKeyProtectedPath`؛ لم يعد المثال يطلب وضع السر داخل `appsettings.json`.

### 4) توثيق تشغيل Agent

تم تحديث:

```text
local-sync-agent/README.md
local-sync-agent/appsettings.example.json
```

ويشمل أمثلة SQL Server/Access staging، مجلدات CSV، وتدفق الإعداد الآمن.

## الاختبارات

اختبار جديد:

```text
tests/erp-connector-contract.test.ts
```

يغطي عقد ERP، payloads التشغيلية وmapping typed.

## حدود صريحة ومهام خارج بيئة Arena

- `dotnet` غير متاح هنا، لذلك لم يتم compile أو تشغيل Agent C#.
- لا يوجد Sandbox أو ERP فعلي باسم تجاري، ولا SQL Server/Access فعلي لاختبار staging commands.
- لا يوجد Adapter رسمي مختبر لمحـاسبي أو Onyx أو ERP محدد؛ العقد والـ Agent جاهزان لبدء Adapter، لكن اختيار المزود مطلوب.
- يلزم قبل Pilot:
  1. اختيار ERP واحد.
  2. بناء Adapter لذلك المزود.
  3. إعداد Windows Service installer وsigned binary وupdater/diagnostics.
  4. E2E حقيقي: ERP → Agent → API → Invoice/Payment/Inventory → Reconciliation.

## التحقق

```text
npm run lint                                      PASS
NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck   PASS
npm test                                          PASS — 36 ملفات / 104 اختباراً
npm run migrations:verify                         PASS
npx drizzle-kit check                             PASS
npm run security:verify                           PASS
git diff --check                                  PASS
```
