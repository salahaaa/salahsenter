# Merchant Onboarding & Contract Lifecycle — Comprehensive Audit

تاريخ التنفيذ والفحص: 2026-06-17

## ملخص التنفيذ

تم توسيع دورة فتح المتجر لتدعم التدفق الاحترافي التالي:

```txt
Guest → Customer Registration → Merchant Application → Administrative Review → Documents Required / Pre Approval → Contract Creation → Contract Signature → Final Approval → Store Creation → Merchant Promotion → Store Activation → Merchant Dashboard Access
```

## ما تم تنفيذه برمجياً

### 1) منع فتح متجر بدون حساب

`POST /api/merchant-applications` يتطلب جلسة مستخدم، وإذا لم يكن المستخدم مسجلاً يرجع 401.

### 2) حالات طلب فتح المتجر

تم توسيع حالات `merchant_application_status` إلى:

```txt
new
pending
under_review
waiting_for_data
documents_required
pre_approved
contract_created
contract_signed
waiting_final_approval
approved
active
rejected
```

### 3) مستندات طلب فتح المتجر

تمت إضافة جدول:

```txt
merchant_application_documents
```

و API:

```txt
GET/POST /api/merchant-applications/:id/documents
```

يدعم أنواع المستندات:

```txt
commercial_register
tax_card
identity
bank_account
logo
store_image
other
```

### 4) مراجعة الإدارة

تمت إضافة API:

```txt
POST /api/admin/merchant-applications/:id/review
```

يدعم الأفعال:

```txt
start_review
request_documents
request_changes
pre_approve
create_contract
reject
```

مع منع القفز غير القانوني بين الحالات.

### 5) إنشاء العقد قبل التوقيع

عند `create_contract` يتم إنشاء بيانات العقد داخل الطلب:

```txt
onboarding_contract_number
contract_body
contract_start_at
contract_end_at
contract_duration_days
commission_rate
subscription_fee
```

وتصبح الحالة:

```txt
contract_created
```

### 6) التوقيع الإلكتروني

`POST /api/merchant-applications/:id/contract` لا يسمح بالتوقيع إلا إذا كانت الحالة:

```txt
contract_created
```

أو حالات توقيع/مراجعة ذات صلة. وبعد التوقيع تتحول الحالة إلى:

```txt
contract_signed
```

### 7) الموافقة النهائية والتفعيل

`POST /api/admin/merchant-applications/:id/approve` لا يعمل إلا بعد توقيع العقد. عند الموافقة النهائية:

- إنشاء/تحديث المستخدم كتاجر.
- إنشاء سجل `merchants`.
- إنشاء `stores`.
- إنشاء رقم متجر فريد.
- إنشاء عقد فعال داخل `merchant_contracts`.
- إنشاء سجل في `contract_events`.
- إضافة دور merchant.
- إرسال إشعار بيانات الدخول.
- تفعيل المتجر.
- تحويل حالة الطلب إلى `active`.

### 8) لوحة التاجر لحالة الطلب والعقد

تمت إضافة:

```txt
/merchant/onboarding
```

تعرض:

- حالة طلب فتح المتجر.
- رقم العقد.
- رابط مراجعة/توقيع العقد.
- العقود الفعالة.
- طلب تجديد مبدئي.

## نتائج الفحص الفني

تم تشغيل:

```bash
npm run lint
npm run typecheck
npx drizzle-kit check --config=drizzle.config.ts
npm run build
npm audit --audit-level=high
```

النتيجة:

```txt
Passed
No high or critical vulnerabilities
```

## الوضع الحالي للمشروع

```txt
API routes: 71
Pages: 45
Database tables: 61
Migrations: 8
```

## سيناريوهات القبول المغطاة

| السيناريو | الحالة |
|---|---|
| Guest browsing | مدعوم |
| منع فتح متجر بدون حساب | مدعوم API |
| تسجيل العميل role=customer | مدعوم عبر register/seed roles |
| تقديم طلب فتح متجر | مدعوم |
| رفع مستندات الطلب | مدعوم |
| مراجعة الإدارة | مدعوم |
| طلب مستندات | مدعوم |
| قبول مبدئي | مدعوم |
| إنشاء عقد | مدعوم |
| توقيع إلكتروني | مدعوم |
| منع التفعيل قبل التوقيع | مدعوم |
| الموافقة النهائية | مدعوم |
| إنشاء Merchant | مدعوم |
| إنشاء Store | مدعوم |
| Store ID فريد | مدعوم |
| تسجيل دخول بالبريد أو رقم المتجر | مدعوم |
| لوحة التاجر بعد التفعيل | مدعوم |
| منع العمليات عند تجميد المتجر | مدعوم |
| تنبيهات قرب انتهاء العقد | مدعوم |
| تجديد وتمديد وتجميد وإعادة فتح | مدعوم |

## ملاحظات مهمة قبل Production

### High

1. يجب إضافة اختبارات E2E آلية فعلية باستخدام Playwright أو Cypress على بيئة Staging حقيقية.
2. يجب إضافة Rate Limiting لمسارات login/register/upload/application/contract.
3. يجب إضافة CSRF أو Origin validation للعمليات الحساسة.

### Medium

1. ربط إرسال البريد/SMS بمزود حقيقي.
2. إضافة PDF generation حقيقي للعقود.
3. رفع المستندات عبر واجهة تستخدم `/api/media/upload` ثم ربطها بـ documents API.
4. إضافة مراجعة/قبول/رفض لكل مستند منفرد.

### Low

1. تحسين شاشة التاجر لطلب تجديد العقد كنموذج كامل.
2. إضافة واجهة استعادة كلمة المرور.
3. إضافة اختبار uniqueness للأرقام ضمن test suite.

## قرار الجاهزية

الدورة الأساسية أصبحت منفذة ومربوطة بقاعدة البيانات والعقود والصلاحيات والإشعارات ولوحات التحكم. المشروع جاهز لتجربة Staging، لكن اعتماد Production النهائي يتطلب تنفيذ اختبارات E2E فعلية على قاعدة بيانات ونشر حقيقي.
