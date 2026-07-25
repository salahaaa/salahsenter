# تقرير تنفيذ دورة طلب وربط ERP عامة

**التاريخ:** 14 يوليو 2026  
**الهدف:** تمكين التاجر من طلب ربط أي نظام محاسبي/ERP، مع دورة حوكمة لا تفترض Onyx أو محاسبي أو مزوداً واحداً.  
**قاعدة الحوكمة:** **لا إضافة بدون حساب التوسع، ولا إضافة بدون حساب الصيانة.**

> لا يعني وجود هذه الدورة وجود Adapter إنتاجي أو Installer فعلي لكل ERP. الموصل لا يعد مدعوماً فعلياً إلا بعد إدخاله في catalog بحالة active، وتوفر حزمة موقعة/توثيق، واجتياز Pilot وشهادة.

## النتيجة

تم تحويل دورة الربط المقترحة إلى workflow برمجي فعلي:

```text
Merchant Request
→ Admin Review
→ Connector Assignment
→ one-time Integration Key
→ provisional Agent registration/heartbeat
→ External-ID Mapping Readiness
→ Certification
→ Activate ERP Mode
```

## 1) طلب التاجر

أضيفت صفحة التاجر:

```text
/merchant/integrations
```

ويستطيع التاجر إدخال:

- اسم مزود ERP بحرية، وليس من قائمة مغلقة.
- نسخة النظام.
- نوع النظام: Desktop / Cloud / SQL Server / Access / POS / Custom.
- طريقة الاتصال: Local Agent / Cloud API / CSV-Excel / Manual export / Custom.
- عدد الفروع والمخازن.
- نوع النشاط وحجم العمليات.
- جهة الاتصال الفنية.
- عناصر الجاهزية: backup، دعم فني، Agent، staging/import surface.

المسار:

```text
POST /api/merchant/erp-integration-requests
```

ويُمنع إنشاء طلب مفتوح ثانٍ لنفس المتجر حتى يُرفض أو يُلغى الطلب السابق.

## 2) Catalog موصلات عامة

أضيف:

```text
erp_connector_catalog
```

ويحتوي كل موصل على:

```text
code / provider / display name / version / system type
connection modes / capabilities / support owner
documentation URL / signed package URL / checksum / status
```

تُنشأ تلقائياً موصلات عامة أولية فقط:

```text
Generic Local Agent Connector
Generic Cloud API Connector
Generic CSV/Excel Exchange Connector
```

هذه موصلات **بنية عامة** وليست ادعاء دعم فعلي لمزود تجاري محدد.

الأدمن يستطيع إضافة catalog entry خاص بأي ERP مستقبلاً من:

```text
/admin/integrations/requests
```

ولا يظهر زر تنزيل Agent للتاجر إلا عندما يضع الأدمن رابط حزمة موقعة فعلياً في `agentPackageUrl`.

## 3) مراجعة الأدمن وتعيين الموصل

أضيفت صفحة الأدمن:

```text
/admin/integrations/requests
```

الدورة المحكومة:

| الحالة | الإجراء المسموح |
|---|---|
| `pending_review` | بدء المراجعة / طلب معلومات / رفض |
| `under_review` | طلب معلومات / تعيين موصل / رفض |
| `needs_information` | بدء مراجعة أو تعيين موصل بعد استكمال البيانات |
| `approved_for_setup` | انتظار Agent فقط |
| `agent_connected` | استقبال Mapping readiness |
| `mapping_in_progress` | استكمال Mapping |
| `ready_for_certification` | اختيار شهادة معتمدة وتفعيل |
| `activated/rejected` | حالات نهائية؛ لا يعاد تعيين الموصل مباشرة |

تعيين الموصل ينشئ Integration Client محدود النطاق للمتجر ويُرجع:

```text
Client Key
Integration Key / API Key
```

مرة واحدة فقط في واجهة الأدمن. المفتاح لا يحفظ في request أو source أو audit payload.

## 4) تثبيت Agent والتحقق قبل التفعيل

تمت إضافة طبقة وصول جديدة:

```text
assertAgentOnboardingAccess()
```

وهي تسمح قبل تفعيل ERP Mode فقط بـ:

```text
Agent register
Heartbeat
Onboarding mapping readiness
```

ولا تسمح قبل التفعيل بـ:

```text
inventory sync
order sync
invoice sync
payment sync
```

وهذا يحقق التسلسل الآمن:

```text
Agent Connected
→ Mapping
→ Certification
→ Activate ERP Mode
```

مع الإبقاء على `assertAgentStoreEnabled()` لمسارات بيانات الإنتاج بعد فتح ERP Mode فقط.

## 5) Mapping وExternal IDs

أضيف endpoint onboarding:

```text
POST /api/integrations/onboarding/mapping
```

يقبل روابط External IDs لهذه الأنواع:

```text
product
variant
warehouse
branch
customer
payment_method
price_list
```

ويخزنها في:

```text
integration_entity_links
```

مع قيود فريدة:

```text
clientKey + entityType + externalEntityId
```

ولا يسمح بـ name-only matching.

يستقبل endpoint أيضاً ملخصاً:

```text
mappedProducts
unmappedProducts
duplicateProducts
warehouses
branches
```

ولا يسمح بإرسال الطلب للشهادة إذا لم يتحقق على الأقل:

```text
mappedProducts > 0
unmappedProducts = 0
warehouses > 0
```

## 6) التفعيل النهائي

يظل ERP Mode مقفلاً حتى:

1. وجود Integration Client يطابق الطلب والمتجر.
2. وجود Certification بحالة `certified` لنفس client/store.
3. اختيار الأدمن إجراء `activate`.

عندها فقط تكتب المنصة:

```text
integrationEnabled = true
integrationMode = ERP
erpAccess = admin_enabled
integrationClientKey = approved client key
certificationId = approved certification
```

وتحفظ Source of Truth وAgent capabilities في إعدادات المتجر.

## 7) البيانات والصلاحيات

### Migration

```text
drizzle/0067_generic_erp_onboarding_requests_connector_catalog.sql
```

الجداول الجديدة:

```text
erp_connector_catalog
erp_integration_requests
erp_integration_request_events
```

والصلاحيات الجديدة:

```text
erp.requests.review
erp.connectors.manage
erp.requests.activate
store.erp.requests.view
store.erp.requests.create
```

### المسارات الجديدة

```text
GET/POST  /api/merchant/erp-integration-requests
GET/PATCH /api/admin/erp-integration-requests
GET/POST  /api/admin/erp-connectors
POST      /api/integrations/onboarding/mapping
```

كما تم تحديث OpenAPI وIntegration config/health لإظهار onboarding mapping وsales reports.

## 8) أثر التوسع والصيانة

| المجال | التنفيذ |
|---|---|
| تعدد ERP | provider مكتوب كنص + connector catalog versioned؛ لا hardcode لمزود واحد. |
| منع الطلبات المتوازية | فحص server-side لطلب مفتوح واحد لكل متجر. |
| التتبع | `erp_integration_request_events` يحتفظ بكل transition وملاحظة. |
| المفاتيح | Integration key يعاد مرة واحدة؛ DB يحفظ hash فقط في Integration Client. |
| agent | وصول onboarding محدود ولا يفتح data sync مبكراً. |
| mapping | حد 500 link لكل إرسال، وفهارس external identity تمنع التكرار. |
| التشغيل | الطلبات تظهر في workflow الإداري؛ certification/reconciliation الحاليان يكملان الدورة. |

## 9) التحقق المحلي

| الفحص | النتيجة |
|---|---|
| `npm run lint` | ناجح |
| `NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck` | ناجح |
| `npm test` | **45 ملفاً / 127 اختباراً ناجحاً** |
| `tests/erp-onboarding-policy.test.ts` | 3 اختبارات ناجحة لدورة الحالات |
| `npm run migrations:verify` | ناجح — **68 SQL / 68 journal entries** |
| `npx drizzle-kit check --config=drizzle.config.ts` | `Everything's fine` |
| `npm run security:verify` | ناجح؛ لا أسرار معروفة و`npm audit --omit=dev` = 0 vulnerabilities |
| `git diff --check` | ناجح |

## 10) ما لا يدّعيه التنفيذ

1. لا يوجد Installer Agent موقّع أو رابط تنزيل فعلي افتراضياً.
2. لا يوجد Adapter فعلي مثبت لـOnyx أو محاسبي أو أي مزود تجاري.
3. لم يتم compile Local Sync Agent في Arena؛ `dotnet` غير متوفر.
4. لم يختبر register/heartbeat/mapping مع جهاز Windows أو SQL Server/Access أو ERP حقيقي.
5. لا يوجد OAuth/cloud webhook provider adapter عام بعد.
6. لم تطبق migration 0067 على Staging أو Production، ولم ينشر أي مسار.
7. لا يُفتح ERP Mode بناءً على request أو heartbeat فقط؛ الشهادة الإدارية ما زالت بوابة إلزامية.

## 11) الخطوة التالية الصحيحة

بعد هذه البنية العامة، يمكن اختيار أي مزود يثبت وجوده عند التجار وبناء Adapter له دون تغيير workflow:

```text
1. إضافة connector catalog entry خاص بالمزود.
2. تحديد connection mode وcapabilities الفعلية.
3. إعداد signed Agent package أو OAuth/API adapter.
4. تنفيذ mapping/staging contract.
5. Sandbox + E2E + certification.
6. فتح ERP Mode للتاجر التجريبي فقط.
```

بهذه الطريقة لا تنحصر المنصة بنظام واحد، ولا تدّعي دعماً عاماً قبل وجود connector قابل للتشغيل والاختبار.

## نظافة التسليم

بعد تنفيذ الفحوصات يعاد حذف `node_modules/` وcoverage و`tsconfig.tsbuildinfo` لأنها مخرجات قابلة لإعادة الإنشاء. لتشغيل المشروع لاحقاً:

```bash
npm ci
```
