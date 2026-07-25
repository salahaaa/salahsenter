# تقرير معمارية تكامل ERP والنظام المالي والمخزني

**المشروع:** Yemeni Trade Center / Salah Center Mall OS  
**تاريخ التقرير:** 14 يوليو 2026  
**منهج التقرير:** مراجعة المصدر والـschema والمسارات وLocal Sync Agent الموجودين محلياً.  
**حدود الدليل:** لا يوجد في هذه البيئة ERP حي، أو Sandbox محاسبي، أو SQL Server/Access فعلي، أو .NET SDK لتجميع Agent. لذلك يميز التقرير بصرامة بين ما هو **منفذ في الكود** وما هو **جزئي** وما هو **مخطط**.

> **قاعدة التشغيل المعتمدة:** العميل يدفع للتاجر مباشرة. المنصة لا تعمل وسيطاً مالياً لمبيعات العملاء، وتحصل فقط إيراداتها (إيجار/عمولة/إعلانات) عبر دورة منفصلة.

---

## الملخص التنفيذي

البنية الحالية مناسبة كأساس **Pilot مضبوط لمتجر واحد** بعد اختيار ERP محدد، لكنها ليست جاهزة بعد لإطلاق تجاري عام مع أي نظام محاسبي بشكل تلقائي.

الموجود فعلياً هو:

```text
Platform API + Integration Clients + Mapping Profiles + Event/Job tables
+ Retry/Failed Sync queue + Reconciliation dashboard
+ Admin certification gate + Local Sync Agent design (.NET 8 + SQLite)
```

أما ما ينقص للإطلاق الحقيقي فهو:

```text
Adapter فعلي لنظام محاسبي محدد
+ compile/install للـAgent على Windows
+ Sandbox وE2E حقيقي
+ تثبيت دلالات invoice/payment/delivery لكل ERP
+ Warehouse/Branch typed workflows
+ OAuth/Webhook/mTLS/IP policy عند الحاجة
```

---

# 1) Architecture Overview — نظرة عامة على المعمارية

## 1.1 الرسم المعماري

```text
┌────────────────────────────────────────────────────────────────────┐
│ العميل                                                             │
│ يدفع للتاجر مباشرة: COD / تحويل / بوابة تخص التاجر                │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ منصة Yemeni Trade Center                                            │
│ Orders / Reservations / Catalog / Product UI / Customer Experience │
│ Integration API / Mapping / Audit / Reconciliation                 │
└────────────────────────────────────────────────────────────────────┘
       │ outbound events / pull API                ▲ inbound batches
       ▼                                           │
┌────────────────────────────────────────────────────────────────────┐
│ Integration boundary                                                │
│ integration_clients + scoped API key + store scope                 │
│ integration_events + background_jobs + sync_runs + failed_syncs    │
└────────────────────────────────────────────────────────────────────┘
       │ HTTPS outbound only                         ▲ HTTPS
       ▼                                             │
┌────────────────────────────────────────────────────────────────────┐
│ Local Sync Agent — موقع التاجر                                     │
│ .NET 8 Worker + SQLite inbox/outbox/dead letters + checkpoint      │
└────────────────────────────────────────────────────────────────────┘
       │ parameterized staging / ODBC / files                         │
       ▼                                                              │
┌────────────────────────────────────────────────────────────────────┐
│ ERP/POS التاجر                                                      │
│ SQL Server / Access / CSV-Excel / ERP Desktop / Cloud API لاحقاً  │
└────────────────────────────────────────────────────────────────────┘
```

## 1.2 المكونات ومسؤولياتها

| المكوّن | المسؤولية الفعلية | خارج/داخل المنصة |
|---|---|---|
| واجهة المنصة | كتالوج، منتجات، تجربة العميل، طلب، حجز، متابعة حالة | داخل المنصة |
| `financial-services` | يحدد الفرق بين ERP وStandalone للفوترة/المخزون؛ لا ينشئ settlement تاجر في وضع `merchant_collects` | داخل المنصة |
| Integration Client | مفتاح تكامل، scopes، نطاق متاجر، status، last seen | داخل المنصة |
| Mapping Profile | تعريف الحقول والهوية وpolicy/conflict versioned لكل مورد | داخل المنصة |
| Entity Links | الربط الثابت بين entity المنصة وExternal ID/Code في ERP | داخل المنصة |
| `integration_events` | Outbound/inbound event envelope، dedupe key، retry metadata | داخل المنصة |
| `background_jobs` | جدولة المعالجة الخلفية للأحداث | داخل المنصة |
| Local Sync Agent | bridge داخل شبكة التاجر، pull/apply/push durable | خارج المنصة / جهاز التاجر |
| Connector | SQL Server أو Access ODBC أو CSV/Excel staging/import | خارج المنصة |
| ERP | إصدار فاتورة ERP، خصم مخزون ERP، posting للإيراد المحاسبي، تحديثات العودة | خارج المنصة |
| Reconciliation/Admin | اعتماد الموصل، مراقبة runs، Retry، DLQ، conflicts، تعليق/تصحيح آمن | داخل المنصة |

## 1.3 مبدأ العزل

لا يوجد اتصال مباشر من Cloud المنصة إلى قاعدة بيانات ERP للتاجر. الاتصال المفترض هو:

```text
Agent داخل شبكة التاجر → HTTPS outbound → Platform API
```

وهذا يمنع فتح SQL Server أو Access للإنترنت ويحافظ على حدود مسؤولية واضحة.

---

# 2) Source of Truth Matrix — مصفوفة المصدر الحقيقي

السياسة الحالية في:

```text
lib/integrations/erp/source-of-truth.ts
lib/commerce/financial-strategy.ts
lib/commerce/financial-services.ts
```

| العنصر | ERP Mode | Standalone Mode | ملاحظة تشغيلية |
|---|---|---|---|
| المخزون | ERP | المنصة | ERP Mode: المنصة تحجز فقط ثم تنتظر snapshot/update من ERP؛ Standalone: المنصة تخصم المخزون النهائي. |
| الفاتورة | ERP | المنصة | ERP Mode: ERP يصدر الفاتورة؛ Standalone: المنصة تنشئ order invoice تشغيلياً. |
| الإيراد المحاسبي | ERP | المنصة | ERP Mode: ERP هو posting authority؛ Standalone: المنصة تسجل بيانات التشغيل، لكن لا تنشئ رصيد سحب للتاجر في نموذج `merchant_collects`. |
| التسويات المالية لمبيعات العملاء | التاجر | التاجر | العميل يدفع للتاجر مباشرة؛ `settlements = merchant`. |
| السعر | التاجر عبر المنصة | التاجر عبر المنصة | Product/price push من ERP معطل افتراضياً؛ لا يسمح ERP بكتابة السعر دون قرار تغيير سياسة. |
| الاسم/الوصف/الصور/بيانات المنتج | المنصة | المنصة | Product metadata authority للمنصة، لذلك product inbound من ERP قد يهمل أو يوثق فقط. |
| العملاء | المنصة تشغيلياً | المنصة تشغيلياً | بيانات العميل وخصوصيته تدار في المنصة؛ ERP يستقبل snapshot مطلوباً للفاتورة/الطلب عبر mapping. |
| الحسابات البنكية وطرق دفع العميل | التاجر/إعدادات المتجر | التاجر/إعدادات المتجر | المنصة لا تدير رصيد مبيعات العميل للتاجر في النموذج الحالي. |
| المرتجعات | المنصة تدير طلب العميل، ERP يعالج credit/stock عند ERP Mode | المنصة | E2E للمرتجع مع ERP ما زال جزئياً ويحتاج Adapter محدد. |
| إيرادات المنصة | المنصة | المنصة | إيجار/عمولة/إعلانات في `merchant_platform_statements`، منفصلة كلياً عن مال طلب العميل. |

## الفرق العملي بين الوضعين

### ERP Mode

```text
المنصة: create order + reserve stock + enqueue order.created
ERP: create sales order/invoice + final stock deduction + accounting revenue post
ERP/Agent: invoice/inventory/payment updates → platform mirror
```

### Standalone Mode

```text
المنصة: create order + platform invoice + platform inventory finalization
التاجر: يستلم مال العميل مباشرة من وسيلته الخاصة
المنصة: لا تنشئ merchant payout/available balance في merchant_collects mode
```

---

# 3) Merchant ERP Integration Flow — ربط تاجر بالنظام المحاسبي

## 3.1 من يفعّل ERP؟

التاجر **لا يستطيع فتح ERP Mode لنفسه**. الفتح إداري فقط بعد اعتماد موصل وشهادة.

## 3.2 خطوات التفعيل الحالية

```text
1. الأدمن ينشئ Integration Client.
2. النظام يعرض API key مرة واحدة فقط؛ يخزن Hash في المنصة.
3. الأدمن يحدد store scope وscopes للعميل.
4. ينشئ Mapping Profiles للـproducts/inventory/orders/invoices.
5. يضيف mapping للمخزن/الفرع/customer/payment/price list داخل operational mapping.
6. يثبت/يشغل Agent تجريبي ويرسل register + heartbeat.
7. الأدمن ينشئ Certification ويشغل checklist.
8. بعد اجتياز checklist يعتمد certification.
9. الأدمن يفتح ERP Mode للمتجر ويربط integration client المعتمد.
10. فقط عندها تقبل API دفعات Agent/ERP لهذا المتجر.
```

## 3.3 المتطلبات التقنية لدى التاجر

| المجال | متطلبات فعلية |
|---|---|
| النظام | Windows مناسب للـAgent عند Desktop ERP/SQL Server/Access حالياً. |
| الشبكة | اتصال HTTPS outbound إلى المنصة؛ لا يجب فتح DB للإنترنت. |
| الهوية | `ClientKey`, `StoreId`, API key. |
| SQL Server | Connection String محلي + staging tables + `ApplyOrderCommand`/`ApplyEventCommand` parameterized. |
| Access | ODBC driver + ملف محمي + أوامر inbound parameterized. |
| CSV/Excel | مجلد export + processed + failed + inbound-orders + inbound-events. |
| Mapping | External IDs وSKU/Barcode وسياسة conflict لكل مورد. |
| التشغيل | حساب Windows Service محدود الصلاحيات، log path، backup لقاعدة ERP قبل Pilot. |

## 3.4 إعدادات الاتصال والسر

مثال configuration غير سري:

```text
BaseUrl
ClientKey
StoreId
ConnectorType
EnableOrdersPull
EnableEventsPull
ProductsPushSeconds
InventoryPushSeconds
```

السر لا يوضع في Git أو في `appsettings.json` الحقيقي. الـAgent يبحث بالترتيب عن:

```text
SALAH_SYNC_API_KEY
أو ApiKeyProtectedPath (Windows DPAPI)
ثم ApiKey legacy فقط للتطوير
```

---

# 4) Product Mapping Process — ربط الأصناف

## 4.1 الهوية المسموح بها

الـMapping profile يفرض:

```text
externalId  إلزامي
externalCode اختياري
barcode      اختياري
SKU          اختياري
```

استراتيجيات المطابقة المعرّفة:

```text
external_id_first
barcode_then_external
sku_then_external
```

## 4.2 ما لا يسمح به النظام

```text
Name-only matching = ممنوع
allowNameFallback = false افتراضياً
```

والسبب أن الاسم العربي/الإنجليزي قابل للتكرار أو التغيير ولا يصلح كهوية مالية أو مخزنية.

## 4.3 الأصناف الجديدة والمكررة

| الحالة | السلوك المعتمد |
|---|---|
| صنف ERP له External ID غير مربوط | لا يُنشأ تلقائياً ككتالوج عام افتراضياً؛ يحتاج mapping/قرار إداري لأن المنتج والوصف والسعر سلطة المنصة. |
| صنف منصة جديد | يحتاج Entity Link/External ID قبل مزامنة ERP الآمنة. |
| External ID مكرر | يمنعه unique index على `clientKey + entityType + externalEntityId`. |
| SKU/Barcode مكرر | لا يكفي وحده لتجاوز Entity Link؛ يفتح conflict أو يحتاج سياسة mapping. |
| اختلاف الاسم | لا يغير الربط ولا يطابق بالاسم؛ يحتفظ كل نظام بالاسم ضمن سلطته. |

## 4.4 إصدارات Mapping

`integration_mapping_profiles` يحتوي:

```text
clientKey + resource + version
mapping
sourceOfTruth
conflictPolicy
isActive
```

والفهرس الفريد يمنع تكرار إصدار المورد للعميل نفسه. شهادة ERP تحفظ evidence عن إصدارات mapping الموجودة.

---

# 5) Warehouse Mapping — المخازن والفروع والتحويلات

## المنفذ الآن

- عقد ERP typed يعرّف `warehouse`, `branch`, `price list`, `payment method`.
- `mapping.operational` يدعم JSON mappings لـ:

```text
warehouses
branches
customers
payments
priceLists
```

- Checklist الشهادة يطلب وجود warehouse/branch mapping ضمن متطلبات readiness.
- `inventory.updated` يستطيع حمل external product/warehouse identity عبر DTO/Agent contract.
- platform inventory transfers موجودة بين متاجر التاجر نفسه، لكن لا توجد بعد workflow ERP warehouse transfer كامل end-to-end.

## الحالة حسب المحور

| العنصر | الحالة | الملاحظة |
|---|---|---|
| Warehouse mapping | **Partially Implemented** | JSON mapping + certification check، لا UI typed كامل ولا fetch/apply حي. |
| Branch mapping | **Partially Implemented** | مهيأ في mapping/contract، لا sync flow حي مكتمل. |
| Platform inventory transfers | **Implemented داخل المنصة** | draft → sent → received لنطاق متاجر التاجر. |
| ERP transfer synchronization | **Planned** | يحتاج Adapter provider-specific وevent/DTO واضح للتحويل. |
| Warehouse master sync | **Planned/Partial** | `fetchWarehouses()` في contract، بلا Adapter فعلي. |

---

# 6) Order Synchronization Workflow — دورة الطلب

## 6.1 ERP Mode المقصود

```text
1. العميل ينشئ الطلب في المنصة.
2. المنصة تتحقق من المنتج والسعر وتعمل reservation للمخزون.
3. المنصة لا تخصم stock نهائياً ولا تصدر فاتورة محاسبية ERP.
4. بعد commit، تنشئ integration event: order.created.
5. Agent أو Integration Client يسحب الطلب عبر /api/integrations/orders أو events.
6. Agent يكتب الطلب في staging table أو ملف inbound؛ لا يرسل ACK قبل نجاح التطبيق المحلي.
7. ERP ينشئ Sales Order / Invoice بحسب إعداد التاجر.
8. ERP يخصم المخزون ويرحل الإيراد محاسبياً.
9. ERP/Agent يدفع invoice/inventory/payment update إلى المنصة.
10. المنصة تحدث mirror للفاتورة/المخزون/الحالة، وتبقي مال العميل خارج رصيد المنصة.
```

## 6.2 reservation

- في ERP Mode: reservation داخل المنصة لحماية الكمية أثناء انتظار ERP.
- إذا لم تصل فاتورة ERP ضمن المهلة، يوجد مسار expiry/reconciliation لتحرير الحجز.
- `expireReservations` يعمل على الطلبات ذات reservation نشط بلا invoice وبحالة مناسبة.

## 6.3 Sales order / invoice / stock / revenue / settlement

| المرحلة | ERP Mode | Standalone Mode |
|---|---|---|
| Sales order | ERP ينشئه عبر Agent/staging | المنصة تدير الطلب مباشرة |
| Invoice | ERP هو authority | منصة تنشئ order invoice |
| Stock deduction | ERP | منصة تخصم variant stock |
| Revenue posting | ERP محاسبياً | المنصة تسجل تشغيل الطلب، دون رصيد payout للتاجر في merchant_collects |
| Settlement | التاجر مباشرة مع العميل | التاجر مباشرة مع العميل |

## ملاحظة حرجة

الكود الحالي يوفر event/API/Agent foundation، لكنه لا يثبت بعد أن Adapter محاسبي محدد يقوم فعلياً بإنشاء Sales Order أو Invoice داخل ERP. هذه خطوة Pilot لازمة قبل الإطلاق.

---

# 7) Synchronization Mechanism — آلية المزامنة

## الآليات المستخدمة

| الآلية | الاستخدام الحالي | السبب |
|---|---|---|
| Pull | Agent يسحب orders/events من المنصة | لا يحتاج inbound port داخل شبكة التاجر. |
| Push | Agent يدفع inventory/products عند التفعيل؛ ERP/API يدفع inbound batches | تحديثات المصدر الخارجي تصل للمنصة. |
| Event-driven | `integration_events` + background jobs | فصل commit الطلب عن ERP latency وتحقيق retry/audit. |
| Polling | Agent intervals للـinventory/orders/events/heartbeat | مناسب للـDesktop ERP وAccess وCSV حيث لا توجد webhooks. |
| Queue | `background_jobs`, retry queue, failed sync queue | امتصاص فشل الشبكة وإعادة المحاولة. |
| Webhooks | ليست generic ERP feature مكتملة | موجودة أساساً لمزودي الدفع؛ cloud ERP webhook provider adapters ما زالت مخططة. |

## لماذا هذا الاختيار؟

- Desktop ERP غالباً خلف NAT وبدون API public؛ لذلك **Agent outbound HTTPS + polling** أكثر أمناً وواقعية.
- Cloud ERP لاحقاً قد يستخدم OAuth + signed webhooks، لكن لا ينبغي ادعاء دعمه الآن.
- event queue تمنع انتظار العميل لاتصال ERP أثناء checkout.

---

# 8) Integration Events — الأحداث

## 8.1 الأحداث المعرفة في الكود

```text
product.created
product.updated
inventory.updated
price.updated
order.created
order.updated
invoice.issued
invoice.cancelled
payment.updated
return.created
return.updated
```

## 8.2 مقارنة بالأسماء المطلوبة

| الاسم المطلوب | الاسم/الحالة الحالية | الدورة |
|---|---|---|
| `order.created` | **Implemented** | المنصة تنشئ event بعد order commit في ERP Mode. |
| `invoice.created` | **Partially / باسم `invoice.issued`** | canonical event في الكود `invoice.issued`؛ inbound invoice عبر `/api/integrations/invoices`. |
| `inventory.updated` | **Implemented foundation** | ERP/Agent يدفع batch → integration event → apply inventory snapshot عند نجاح mapping. |
| `payment.updated` | **Implemented foundation** | endpoint `/api/integrations/payments` ينشئ inbound event؛ دلالات التحصيل تعتمد ERP/provider. |
| `refund.created` | **Not canonical** | الموجود `return.created` / `return.updated`؛ refund financial E2E يحتاج DTO/Adapter محدد. |
| `settlement.completed` | **Not emitted by design** | settlement لمبيعات العميل عند التاجر مباشرة في `merchant_collects`; لا ينبغي للمنصة إصدار هذا الحدث كتحصيل وسيط. |
| `sales_report.submitted` | **Implemented (platform revenue)** | تقرير يدوي/ERP API، ثم اعتماد أدمن قبل عمولة المنصة. |

## 8.3 دورة الحدث

```text
Domain commit
  → integration_events (dedupe key)
  → background_jobs
  → Agent pull أو Integration API push
  → integration audit
  → process/apply أو retry/failed queue
```

لا يجب اعتبار event processed لمجرد وصول HTTP؛ Agent المحلي لا ACK للمنصة قبل نجاح local apply.

---

# 9) Failed Sync Handling — الفشل والتكرار والإعادة

## 9.1 داخل المنصة

| الحالة | الآلية الموجودة |
|---|---|
| فشل معالجة inbound event | `integration_events.status` مع attempts/error/nextAttemptAt. |
| Retry | exponential delay في `processIntegrationRetryQueue`. |
| تجاوز max attempts | `integration_failed_syncs` مع payload/error/nextRetryAt. |
| Replay إداري | `/api/admin/integrations/reconciliation/retry` يعيد الحدث إلى retry. |
| مراقبة | Reconciliation dashboard يعرض retry queue, failed syncs, stale reservation, negative stock. |
| duplicate inbound | `dedupe_key` unique في integration events؛ API يعيد idempotent replay بدلاً من تكرار المعالجة. |
| duplicate entity link | unique external link لكل client/resource/externalId. |

## 9.2 داخل Agent

SQLite محلي في:

```text
sync_checkpoints
sync_outbox
sync_inbox
dead_letters
```

السلوك:

```text
outbox: pending → retry → dead / processed
inbox:  pending → retry → dead / processed
```

- retry/backoff محلي.
- dead letter عند تجاوز `MaxOutboxAttempts`.
- checkpoint لكل resource.
- heartbeat يرسل pending outbox وdead count.
- inbox يستخدم deterministic ID مثل `order:{orderId}` و`event:{eventId}` لمنع تكرار التطبيق المحلي.

## حدود قائمة

- لا يوجد حالياً UI مركزي كامل لعرض Agent local dead letters أو تنزيل diagnostics bundle.
- Agent لم يُشغل فعلياً في Arena أو Windows customer network.
- لا توجد سياسة replay business-level مكتملة لكل resource، خصوصاً returns/payment/refund.

---

# 10) Admin Responsibilities — مسؤوليات الإدارة

## الأدمن يتحكم في

- إنشاء وإيقاف Integration Clients وتدوير API key.
- تقييد scopes وstore IDs.
- إنشاء Mapping Profiles وإصداراتها وconflict policies.
- إنشاء شهادة ERP وإعادة فحصها واعتمادها أو رفضها.
- فتح ERP Mode فقط بعد certification.
- مراجعة reconciliation, failed syncs, retry queue, stale reservations, negative inventory.
- إدارة conflict cases: assign / resolve_platform / resolve_external / ignore.
- مراجعة تقارير مبيعات ERP لأغراض **عمولة المنصة**.
- إدارة شروط إيراد المنصة وإتفاق الترويج بصورة منفصلة عن ERP order money.

## التاجر يتحكم في

- اختيار ERP/POS المراد ربطه بعد موافقة الإدارة.
- تجهيز جهاز Agent وشبكة ERP وstaging commands.
- إدارة المخزون والفاتورة المحاسبية عندما يكون ERP Mode مفعلاً.
- السعر والكتالوج التجاري داخل المنصة.
- وسائل دفع العميل الخاصة به واستلام أموال العملاء مباشرة.
- إرسال/مراجعة تقرير مبيعاته لإيراد المنصة عند نموذج العمولة.

## ERP يتحكم في

- المخزون النهائي والفاتورة المحاسبية والإيراد المحاسبي في ERP Mode.
- تطبيق Sales Order/Invoice/Credit Note بحسب التكوين المحلي.
- تحديثات inventory/invoice/payment التي تعود للمنصة.

## متى تتدخل الإدارة؟

```text
قبل فتح ERP
عند فشل/تأخر sync
عند تعارض SKU/External ID/stock reservation
عند وجود invoice/inventory inconsistency
عند اعتماد تقرير مبيعات العمولة
عند مراجعة readiness قبل توسعة التاجر التجريبي
```

---

# 11) Supported ERP Types — الأنواع المدعومة

| النوع | التقييم الحالي | التفاصيل |
|---|---|---|
| Desktop ERP | **Partially Implemented** | Agent .NET + staging commands، لكن لا Adapter لمحاسبي محدد. |
| Local SQL Server ERP | **Partially Implemented** | `SqlServerConnector` parameterized + query/commands configurable؛ يحتاج DB/schema فعليين. |
| Access ERP | **Partially Implemented** | `AccessOdbcConnector` مع ODBC؛ يحتاج Driver وملف ERP وتجربة حقيقية. |
| CSV/Excel | **Implemented foundation** | قراءة CSV وتصدير inbound JSON؛ مناسب fallback وليس realtime ERP كامل. |
| REST API ERP / Cloud ERP | **Planned / Foundation only** | Platform API وcontract موجودان، لا OAuth adapter أو provider webhook/client implementation. |
| Windows Service ERP Bridge | **Partially Implemented** | Worker .NET 8 قابل للاستضافة كخدمة، لكن لا installer/signing/updater/support lifecycle. |
| محاسبي | **Planned Pilot** | الأولوية التجارية المعتمدة، لكن لا Adapter رسمي أو Sandbox/E2E مثبت بعد. |
| Onyx/Odoo/SAP | **Planned** | لا يجوز ادعاء دعم فعلي الآن. |

---

# 12) Local Sync Agent

## 12.1 طريقة العمل

```text
Start
→ register/heartbeat (بعد فتح ERP Mode)
→ pull platform orders/events
→ enqueue SQLite inbox
→ apply via local connector/staging
→ mark processed
→ ACK events only after local success

وفي الاتجاه العكسي:
ERP local changes
→ SQLite outbox
→ HTTPS push to Platform API
→ checkpoint update after success
```

## 12.2 التثبيت المقصود

1. تثبيت .NET 8 runtime/Agent على Windows جهاز محاسبة التاجر.
2. إنشاء Windows Service account محدود الصلاحيات.
3. إعداد `appsettings` بلا سر حي.
4. وضع `SALAH_SYNC_API_KEY` كـenvironment secret أو DPAPI protected file.
5. تجهيز SQL/Access staging tables أو CSV folders.
6. تشغيل Agent في Sandbox، التحقق من heartbeat ثم certification.

## 12.3 التحديث والمراقبة

### موجود

- Serilog file sink ضمن dependencies.
- heartbeat كل فترة قابلة للضبط.
- outbox/dead-letter counters في heartbeat.
- sync runs/checkpoints في المنصة.

### غير مكتمل

- لا يوجد installer رسمي.
- لا يوجد signed binary.
- لا يوجد auto-updater مع rollback.
- لا يوجد remote diagnostics bundle أو support tunnel رسمي.
- لا يوجد Fleet/device management lifecycle كامل.

## 12.4 الدعم الفني المقترح قبل Pilot

```text
L1: فحص heartbeat/configuration/connectivity
L2: فحص mapping/staging commands/ODBC driver
L3: تحليل SQLite dead letters + ERP vendor schema
```

ولا يجب أن يطلب الدعم الفني من التاجر إرسال API key أو Database password في chat/email.

---

# 13) Security Model — نموذج الأمان

## Authentication

- Bearer token أو `x-api-key`.
- Integration Client له `clientKey`.
- السر مخزن hash SHA-256 في DB، ويعرض المفتاح مرة واحدة عند الإنشاء/التدوير.
- Agent يستخدم environment secret أو Windows DPAPI.

## Authorization

- Integration scopes مثل:

```text
products:read/write
inventory:read/write
orders:read/write
invoices:read/write
events:read/write
sales_reports:write
```

- Store scoping عبر `storeIds` لكل client.
- Agent access يرفض store لم يفتح له ERP Mode أو client لا يطابق integration client المعتمد.
- Admin-only certification/ERP mode/conflict/retry operations.

## النقل والتشفير

- التصميم يفرض HTTPS outbound للـAgent.
- لا يفرض repository نفسه شهادة mTLS أو IP allowlist أو OAuth cloud flow حتى الآن.
- تشفير قاعدة بيانات ERP والنسخ الاحتياطية مسؤولية بيئة التاجر/المزود، ويحتاج runbook قبل Pilot.

## Secret Management

| الموجود | غير المكتمل |
|---|---|
| Token hash، DPAPI، environment variable، عدم وضع سر المثال في Git | Vault/Secret Manager managed، rotation automation للـAgent، mTLS certificates |

## Audit Traceability

- `integration_audit_logs`.
- `audit_logs` العام مع correlation ID عند توفره.
- `integration_events`, sync runs, failed syncs, conflict cases.
- Platform revenue reports/terms/statements منفصلة عن order money، مع audit لكل تقرير وقرار تسوية.

---

# 14) Deployment Readiness — الجاهزية الفعلية

| المكون | التصنيف | الدليل/الحد |
|---|---|---|
| Source-of-truth policy ERP/Standalone | **Implemented** | سياسة ثابتة ومختبرة source-level؛ settlement الآن merchant-direct. |
| Integration clients/scopes/store scope | **Implemented** | schema/API/auth موجودة. |
| Mapping profiles/versioning/entity links | **Implemented / Partial** | profile/entity link/version موجود؛ UX typed كامل لكل مورد ليس مكتملًا. |
| Order outbound event | **Implemented foundation** | ERP Mode ينشئ `order.created` event بعد commit. |
| Inventory inbound update | **Partially Implemented** | API/event/apply موجود؛ يتطلب mapping وERP فعلي. |
| Invoice inbound update | **Partially Implemented** | API/event/apply موجود؛ semantics الحقيقية تحتاج Pilot. |
| Payment update | **Partially Implemented** | endpoint/event موجود؛ لا يعني تحصيل منصة لأموال العميل. |
| Returns/refunds ERP E2E | **Planned / Partial** | return events موجودة، DTO/workflow كامل غير مثبت. |
| Warehouse/branch sync | **Partially Implemented** | typed contract + mapping/checklist؛ لا Adapter/run فعلي. |
| SQL Server connector | **Partially Implemented** | code parameterized، لا DB حقيقي أو compile/test. |
| Access connector | **Partially Implemented** | code ODBC، لا Windows/driver/DB test. |
| CSV/Excel bridge | **Implemented foundation** | code موجود، غير مثبت في بيئة تاجر حقيقية. |
| Local Sync Agent | **Partially Implemented** | .NET source + SQLite durable design، غير compiled في Arena. |
| Retry/DLQ/Reconciliation | **Implemented foundation** | tables/services/admin retry/reconciliation موجودة؛ no live failure drill. |
| Conflict case management | **Implemented** | case table/API/admin UI؛ policies واسعة per entity ما زالت جزئية. |
| Cloud ERP OAuth/webhooks | **Planned** | لا adapter/provider implementation. |
| محاسبي Adapter/Pilot | **Planned — P0** | لم يُختر schema/API/Sandbox أو Windows installer رسمي. |
| Production E2E | **Not Ready** | لا Staging DB/ERP/Agent/Pilot proof. |

## حكم الجاهزية

```text
جاهزية البنية: جيدة كأساس Pilot
جاهزية تكامل محاسبي حقيقي: غير مكتملة
جاهزية إطلاق Enterprise عام: غير جاهزة حالياً
```

لا يصح إطلاق ERP للتجار جميعاً قبل نجاح Pilot واحد موثق.

---

# خطة Pilot المقترحة لنظام المحاسبي

## المرحلة 1 — قرار ومختبر

1. اعتماد إصدار محدد من نظام المحاسبي.
2. توفير Sandbox أو نسخة تجريبية من قاعدة البيانات.
3. تعيين Owner محاسبي وOwner تقني.
4. توثيق schema/staging/import contract دون مشاركة DB على الإنترنت.

## المرحلة 2 — Adapter محدود

ابدأ فقط بهذه الموارد:

```text
inventory.updated
order.created
invoice.issued
payment.updated
```

ولا تبدأ بـproducts/price/customer/returns دفعة واحدة.

## المرحلة 3 — E2E

```text
Customer order
→ platform reservation
→ Agent pull
→ ERP sales order/invoice
→ ERP stock deduction
→ invoice/inventory update platform
→ reconciliation clean
```

ثم اختبر:

```text
network loss
retry
same event twice
ERP rejects order
inventory below reservation
cancel/credit note
```

## المرحلة 4 — Acceptance Gate

لا يفتح ERP Mode لتاجر إنتاجي إلا بعد:

- Certification checklist مكتمل.
- Agent heartbeat مستقر.
- Mapping versions محفوظة.
- Successful sync runs موثقة.
- Reconciliation بلا unresolved reservations/conflicts.
- rollback/runbook جاهز.

---

# الخلاصة النهائية

المنصة لا تربط نفسها مباشرة بقاعدة ERP للتاجر، بل تستخدم **Integration API + Local Sync Agent + mapping + durable events**. هذا القرار صحيح من ناحية العزل والأمان وقابلية التوسع.

لكن التنفيذ الحالي هو **بنية جاهزة للـPilot وليست موصل محاسبي مكتمل الإنتاج**. أكبر العناصر المتبقية هي Adapter محاسبي فعلي، Windows Service production lifecycle، Sandbox/E2E، وتثبيت قواعد invoice/payment/return لكل ERP.

وفي النموذج المالي الجديد، تظل أموال العميل خارج المنصة؛ ERP يسجل محاسبة التاجر، بينما المنصة تحسب وتحصّل فقط إيراداتها المنفصلة عبر الإيجار والعمولة والإعلانات.
