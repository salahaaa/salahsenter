# تدقيق دورة فتح متجر — من طلب التاجر إلى الجاهزية التشغيلية

**التاريخ:** 14 يوليو 2026  
**نوع التدقيق:** مراجعة source/routes/schema/workflow محلياً، بلا تجربة مستخدم أو قاعدة Staging حقيقية.  
**النطاق:** طلب فتح المتجر، المستندات، مراجعة الأدمن، العقد والتوقيع، التفعيل، ثم التهيئة الأولى.

## الخلاصة التنفيذية والرأي

الدورة الحالية لديها **هيكل جيد ومقنع كبداية**: تسجيل دخول إلزامي، منع الطلبات المتكررة، حالات workflow، إشعارات، عقد وتوقيع، ثم إنشاء متجر/تاجر/عقد داخل transaction واحدة، وأدوات تهيئة أولية.

لكنها **ليست جاهزة بعد للاعتماد التجاري الواسع دون إصلاحات P0**، لأن بعض الضوابط المهمة موجودة في الواجهة أو في مسار محدد، بينما يوجد مسار Admin عام يمكنه تجاوز machine state، والمستندات لا تملك workflow اعتماد/رفض مكتمل أو واجهة رفع ظاهرة في رحلة العميل، و`request_changes` لا يقدم حالياً نموذج تعديل وإعادة إرسال فعلي.

### التقييم العملي

| المجال | التقييم | الحكم |
|---|---:|---|
| أساس رحلة التقديم والعقد والتفعيل | جيد | **موجود فعلياً** |
| سلامة machine state | متوسط | **يوجد bypass يحتاج إغلاقاً** |
| الوثائق والثبوتية | ضعيف إلى متوسط | **رفع API موجود، مراجعة/إلزام/واجهة غير مكتملة** |
| العقد والتوقيع | متوسط | **Snapshot وتوقيع مرئي موجودان، الإثبات القانوني يحتاج تقوية** |
| إنشاء المتجر | جيد | **transaction واحدة وrecords مترابطة** |
| الجاهزية قبل الظهور العام | متوسط | **المتجر يفعّل قبل اكتمال checklist** |
| توافقه مع نموذج إيرادات المنصة الجديد | جزئي | **ينشئ إيجار legacy، ولا ينشئ شروط الإيراد الموحد تلقائياً** |
| جاهزية إطلاق واسع | غير كافية | **يتطلب P0 قبل الإطلاق العام** |

---

# 1) الدورة الفعلية الموجودة حالياً

## المرحلة A — دخول المستخدم وبدء الطلب

### المسار

```text
/apply-store
```

### ما يحدث

1. المستخدم غير المسجل يرى دعوة لإنشاء حساب أو تسجيل الدخول.
2. المستخدم المسجل يرى واحداً من الحالات:
   - متجر موجود بالفعل → يوجه إلى لوحة التاجر.
   - طلب مفتوح → يوجه إلى متابعة الطلب.
   - لا متجر ولا طلب مفتوح → يظهر نموذج فتح متجر.
3. الصفحة تحمل الأجنحة والموقع الجغرافي النشط من قاعدة البيانات.

### عناصر جيدة

- تسجيل الدخول مطلوب فعلياً في API وليس في الواجهة فقط.
- منع متجر ثانٍ للحساب في المسار الأساسي.
- منع طلب مفتوح مكرر للحساب نفسه.
- Rate limit لإنشاء الطلب:

```text
5 requests / hour / IP
```

- يمكن إغلاق فتح الطلبات مركزياً عبر Platform Security Settings.

### ملاحظة

التحقق من وجود متجر يستخدم أول متجر يطابق الحساب فقط، وهو مناسب لسياسة «متجر رئيسي واحد» الحالية؛ توسعة التجارة متعددة المتاجر ينبغي أن تستخدم policy صريحة لاحقاً بدلاً من الاعتماد على `limit(1)` فقط.

---

## المرحلة B — نموذج الطلب

### الحقول الحالية

```text
اسم مقدم الطلب
البريد الإلكتروني
الهاتف
اسم المتجر
النشاط التجاري
الجناح
الدولة / المحافظة / المدينة / المنطقة
وصف المتجر
روابط واتساب / فيسبوك / إنستغرام
```

### التحقق server-side

`merchantApplicationSchema` يفرض فقط بصورة أساسية:

```text
applicantName >= 2
email صحيح
storeName >= 2
businessActivity >= 2
```

بينما الحقول التالية اختيارية حالياً:

```text
phone
wing
country/governorate/city/district
description
```

### رأيي

هذا مناسب لطلب اهتمام أولي، لكنه غير كافٍ كطلب تجاري نهائي في اليمن عند اعتماد المتجر. ينبغي التفريق بين:

```text
Lead/Application draft
و
Ready-for-contract application
```

ولا يجب أن يصل الطلب للعقد قبل استكمال حقول الهوية والموقع ووسيلة التواصل المطلوبة بحسب نوع النشاط.

---

## المرحلة C — إنشاء الطلب والتنبيه

### المسار

```text
POST /api/merchant-applications
```

### ما ينفذ

```text
merchant_applications.status = pending
applicantUserId = user session
notification للتاجر
notification للإدارة
Audit log
```

### حالات الطلب المعتمدة

```text
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

هذه الحالات جيدة من ناحية التعبير عن دورة onboarding.

---

# 2) المستندات الثبوتية

## الموجود

يوجد جدول ومسار API فعليان:

```text
merchant_application_documents
POST /api/merchant-applications/{id}/documents
```

والأنواع الحالية:

```text
commercial_register
tax_card
identity
bank_account
logo
store_image
other
```

كما يوجد:

- Rate limit للرفع.
- صلاحية الوصول لمقدم الطلب أو super admin.
- Audit log عند الرفع.
- انتقال تلقائي من `documents_required` إلى `under_review` بعد رفع مستند.

## الفجوات المهمة

### P0 — لا توجد دورة مراجعة وثيقة مكتملة

يوجد في schema حقول:

```text
status
reviewedBy
reviewedAt
note
```

لكن لا توجد حالياً API أو واجهة أدمن واضحة لاعتماد/رفض كل وثيقة على حدة.

النتيجة:

```text
يمكن للأدمن طلب مستندات
لكن لا توجد بوابة server-side تفرض أن المستندات المطلوبة روجعت واعتمدت
قبل pre_approve أو العقد أو التفعيل.
```

### P0 — لا توجد واجهة واضحة للعميل لرفع المستندات في صفحة المتابعة

صفحة:

```text
/apply-store/{id}
```

تعرض الحالة والملاحظات، لكنها لا تعرض uploader للمستندات المطلوبة ولا قائمة الوثائق الحالية. API موجودة، لكن الرحلة المرئية للعميل غير مكتملة.

### P1 — مصدر الملف غير مقيد بما يكفي

`fileUrl` يقبل URL/path صالحاً، لكن المسار لا يتحقق حالياً من:

```text
ملكية media asset
storage prefix مخصص للوثائق
نوع الملف
حجم الملف
malware scanning status
```

التوصية: قبول asset مرفوع من `merchant-application-documents/{applicationId}` فقط، وفحص MIME والحجم، ثم مراجعة status صريحة.

---

# 3) مراجعة الأدمن والاعتماد الأولي

## المسار

```text
/admin/merchant-applications
/admin/merchant-applications/{id}
POST /api/admin/merchant-applications/{id}/review
```

## transition machine المطبقة في review route

```text
pending/new/waiting_for_data → under_review
pending/new/under_review/pre_approved → documents_required
pending/new/under_review/pre_approved/contract_created → waiting_for_data
under_review/documents_required/waiting_for_data → pre_approved
pre_approved → contract_created
عدة حالات غير نهائية → rejected
```

## نقاط قوة

- transition route يتحقق server-side من الحالة السابقة.
- يوجد AI summary مساعد للأدمن، لكنه لا يتخذ القرار.
- detail page تعرض بيانات المتقدم والموقع والعقد والمستندات والتوقيع.
- إشعار للتاجر عند كل خطوة.
- Admin Work Queue وCommand Center يلتقطان الطلبات المفتوحة.

## P0 — يوجد route عام يتجاوز state machine

المسار التالي:

```text
PATCH /api/admin/merchant-applications/{id}
```

يقبل status عاماً من schema ثم يحدثه مباشرة، دون التحقق من transition أو إنشاء متجر أو عقد.

مخاطر ذلك:

```text
قد تتحول application إلى active ظاهرياً
دون إنشاء store / merchant profile / contract
أو يمكن تجاوز documents/contract/signature workflow
```

**التوصية الحاسمة:**

```text
إلغاء route العام لحالات التطبيق، أو حصره في admin note فقط.
كل انتقال حالة يجب أن يمر عبر transition service موحد.
```

---

# 4) طلب تعديل بيانات التاجر

## الموجود

الأدمن يستطيع اختيار:

```text
request_changes
→ waiting_for_data
```

ويكتب `adminNote` للتاجر.

## الفجوة P0

لا يوجد نموذج تعديل وإعادة إرسال مرتبط بـ:

```text
/apply-store/{id}
```

صفحة المتابعة تعرض ملاحظة الإدارة، لكنها لا تسمح فعلياً لتعديل بيانات الطلب أو إعادة إرساله. لذلك الحالة `waiting_for_data` حالياً شبه طريق مسدود من واجهة التاجر.

## التوصية

إضافة:

```text
GET/PATCH /api/merchant-applications/{id}
```

بحماية ملكية مقدم الطلب، مع:

- draft snapshot قبل وبعد.
- fields allowed فقط قبل العقد.
- submit_resubmission action يعيد الحالة إلى `under_review`.
- audit log وnotification للأدمن.

---

# 5) العقد والتوقيع

## إنشاء العقد

الأدمن في `create_contract` يحدد حالياً:

```text
مدة العقد
نسبة العمولة
رسوم الاشتراك
نص عقد اختياري
```

ثم ينشئ:

```text
contract number
contract start/end
contract body
commission rate
subscription fee
hashed access token
```

ويرسل رابط العقد للتاجر داخل Notification.

## توقيع العقد

المسار:

```text
/apply-store/{id}/contract
POST /api/merchant-applications/{id}/contract
```

الموجود:

- التاجر المسجل المرتبط بالطلب يستطيع الوصول.
- super admin يستطيع الوصول.
- توجد صلاحية بديلة عبر token hashed للرابط.
- Canvas signature.
- acceptance checkbox.
- signer name.
- snapshot للعقد والنص والموقع والتاريخ والتوقيع.
- تحويل صورة data URL إلى media URL.
- Rate limit: 10 توقيعات/ساعة/IP.
- بعد التوقيع: `waiting_final_approval`.

## نقاط جيدة

- لا يعتمد التفعيل على client-side فقط؛ approval route يتحقق من:

```text
contractAcceptedAt
contractSignatureDataUrl
status = contract_signed أو waiting_final_approval
```

- يحفظ snapshot أفضل من الاعتماد على نص عقد قابل للتعديل لاحقاً فقط.

## P0 — لا يوجد تحقق من contract version المطابق

نموذج التوقيع يرسل حالياً:

```text
contractVersion = "1.0"
```

بصورة ثابتة، وAPI لا تتحقق أن النسخة الموقعة تطابق `application.contractVersion` التي أصدرها الأدمن.

التوصية:

```text
يجب أن يرسل النموذج النسخة الفعلية من التطبيق
ويجب أن يرفض الخادم أي version mismatch
ويجب أن يوقع hash للنص + version + application ID
```

## P1 — مستوى الإثبات القانوني

Canvas signature + name + timestamp مفيد تشغيلياً، لكنه ليس وحده ضماناً قانونياً كافياً في كل ولاية قضائية. يلزم قبل الإطلاق التعاقدي مراجعة قانونية تشمل:

```text
IP / user agent / consent evidence
hash للعقد
versioning immutable
OTP أو MFA عند التوقيع
وقت موثوق
سياسة الاحتفاظ بالوثائق
```

## P1 — token في الرابط

رابط العقد يحتوي token في query string. التخزين hash داخل DB جيد، لكن token في URL قد يظهر في history أو logs أو referrer في بعض السياقات.

التوصية:

```text
قصير العمر
single-use أو rotate
Referrer-Policy: no-referrer
إخفاء token بعد session exchange
```

---

# 6) الموافقة النهائية وإنشاء المتجر

## المسار

```text
POST /api/admin/merchant-applications/{id}/approve
```

## ما ينفذ داخل transaction

```text
user (إن لم يوجد)
merchant profile
store number
store
store wing link
merchant contract
rental agreement
contract event
merchant role
application.active + createdStoreId
notification
```

## نقاط قوة

- العملية الأساسية transaction واحدة؛ تقلل إنشاء بيانات جزئية.
- أرقام merchant/store/contract تُولد مع فحص uniqueness.
- لا تتم الموافقة قبل توقيع العقد.
- ينشأ عقد فعلي `merchant_contracts` من snapshot التطبيق.
- ينشأ role للتاجر ويرتبط بالمتجر.
- يوجد audit log وإشعار تفعيل.

## فجوات مهمة

### P0 — نموذج إيرادات المنصة الجديد غير موصول تلقائياً بالاعتماد

بعد اعتماد التاجر، الكود ينشئ فقط:

```text
store_rental_agreement
baseRent = subscriptionFee
```

لكن لا ينشئ تلقائياً:

```text
merchant_revenue_terms
monthly_rent / sales_commission / hybrid
merchant_promotion_agreement
```

وهذا لا يطابق دورة إيرادات المنصة الموحدة التي تم بناؤها لاحقاً.

**التوصية:** مرحلة `create_contract` يجب أن تختار:

```text
monthly_rent | sales_commission | hybrid
monthlyRent
commissionRate
dueDays
graceDays
```

ثم approval transaction ينشئ `merchant_revenue_terms` مباشرة، ويترك اتفاق الترويج اختياريًا ومنفصلاً.

### P1 — المتجر يصبح active مبكراً

المتجر ينشأ هكذا:

```text
status = active
isActive = true
profileCompleteness = 75
```

حتى لو لم يكن لديه:

```text
logo
cover
payment method
shipping method
published products
return policy
```

وبالتالي يمكن أن يظهر متجر فارغ أو غير مكتمل للمستخدمين.

التوصية:

```text
active_setup_pending
→ setup checklist completed
→ public active
```

أو على الأقل public visibility gate مستقل عن account activation.

### P1 — profileCompleteness قيمة ثابتة

القيمة `75` لا تمثل فحصاً فعلياً للبيانات. يجب حسابها من checklist وليس تعيينها رقمياً.

### P1 — إرسال كلمة مرور مؤقتة

المسار يحاول إنشاء مستخدم جديد إذا لم يجد حساباً، ثم يرسل كلمة مرور مؤقتة في notification/message. في المسار الطبيعي التسجيل إلزامي، لذلك هذا fallback يجب أن يعاد تصميمه ليستخدم password reset/verified invite بدلاً من نقل كلمة مرور في رسالة.

---

# 7) تهيئة المتجر بعد الفتح

## الموجود

بعد التفعيل يستطيع التاجر استخدام:

```text
/merchant
/merchant/products
/merchant/operations-settings
/merchant/media
/merchant/smart-setup
/merchant/platform-revenue
/merchant/integrations
```

### Smart Setup

يوجد إعداد ذكي ينشئ:

```text
store design settings
cover/logo
banners
categories
attributes
products + variants
```

والمنتجات التي ينشئها تكون:

```text
status = draft
```

وهذا قرار جيد؛ لا ينشر منتجات demo تلقائياً.

## ملاحظات

- Smart Setup يرفع profile completeness إلى 85 بصورة ثابتة أيضاً، حتى لو لم يراجع التاجر كل الناتج.
- لا توجد بعد رحلة onboarding واحدة تربط التاجر تلقائياً بالخطوات التالية بعد التفعيل.
- dashboard يملك readiness cards، لكن لا توجد gate تشغيلية موحدة تمنع public launch حتى اكتمال الحد الأدنى.

---

# 8) الفجوات حسب الأولوية

## P0 — يجب إصلاحها قبل إطلاق واسع

1. **إغلاق bypass لحالات الطلب**
   ```text
   PATCH /api/admin/merchant-applications/{id}
   ```
   يجب ألا يغير status مباشرة.

2. **إنشاء واجهة تعديل وإعادة تقديم**
   لحالة `waiting_for_data`.

3. **إنشاء uploader وثائق حقيقي داخل صفحة متابعة الطلب**
   مع قائمة المطلوب والحالة والملاحظات.

4. **Document review workflow**
   approve / reject / required documents policy قبل pre_approve.

5. **ربط قبول المتجر بـmerchant_revenue_terms**
   بدلاً من إنشاء rental agreement legacy فقط.

6. **Server-side contract version integrity**
   النسخة والنص/hash يجب أن يطابقا ما وقعه التاجر.

## P1 — مهمة قبل إطلاق تجاري منظم

1. فصل `account active` عن `store public active`.
2. readiness checklist محسوب فعلياً.
3. verification للوثائق والهوية بحسب النشاط.
4. signed/expiring contract links وreferrer protection.
5. استبدال كلمات المرور المؤقتة بـinvite/reset flow.
6. assignment/SLA واضح لطلبات الوثائق والمراجعة.
7. سياسة رفض قابلة لإعادة التقديم بنسخة جديدة مرتبطة بالأصل.

## P2 — تحسينات تشغيلية

1. OCR/AI document classification مع مراجعة بشرية.
2. e-signature provider مع legal evidence.
3. KYB tiers وفق حجم النشاط/المحافظة/نوع المنتجات.
4. checklist قابل للتكوين من الأدمن حسب القطاع.
5. analytics لزمن كل مرحلة ونسب drop-off.
6. scheduled reminders للتاجر والأدمن عند انتظار وثيقة/توقيع.

---

# 9) المسار المقترح بعد الإصلاح

```text
1. user account verified
2. application draft
3. submit application
4. admin review
5. documents required / upload / per-document approval
6. request changes → merchant edits → resubmits
7. pre-approved
8. financial model selected (rent / commission / hybrid)
9. contract version generated + immutable hash
10. merchant signs with identity evidence
11. final approval transaction:
    merchant + store(account active, public pending setup)
    contract + merchant_revenue_terms
    optional promotion agreement
12. merchant onboarding checklist:
    identity/contact
    media
    payment method (merchant-owned)
    shipping method
    first product ready
    policies
13. admin or automatic quality gate
14. store public active
15. optional ERP request and connector onboarding
```

---

# الرأي النهائي

**الرأي الهندسي:** لا أنصح بتغيير architecture الرئيسية؛ الأساس الحالي جيد ويمكن إنقاذه وتطويره بسرعة. لكن لا أنصح باعتبار دورة فتح المتجر «مكتملة للإطلاق» الآن.

أكبر ميزتين موجودتين فعلاً هما:

```text
transaction final approval
+ contract snapshot/signature flow
```

وأكبر ثلاث فجوات تمنع الثقة التشغيلية هي:

```text
state-machine bypass
+ documents workflow غير مكتمل
+ عدم وجود edit/resubmit للتاجر
```

بعد معالجة P0 وربط شروط إيراد المنصة بالاعتماد النهائي، ستكون الرحلة مناسبة بدرجة كبيرة لتشغيل منظم ومتوسع.
