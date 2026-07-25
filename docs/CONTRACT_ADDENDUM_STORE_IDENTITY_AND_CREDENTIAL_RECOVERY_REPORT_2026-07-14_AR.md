# تقرير استكمال ملاحق العقود وحماية هوية المتجر واستعادة البيانات

**التاريخ:** 14 يوليو 2026  
**الحالة:** تم التنفيذ محلياً، من دون تطبيق migrations أو نشر على Staging/Production.  
**قاعدة الحوكمة:** لا إضافة بدون حساب التوسع، ولا إضافة بدون حساب الصيانة.

## الهدف

استكمال ما يلي:

1. عدم السماح للتاجر بتعديل الاسم التجاري أو البريد الإلكتروني المعتمد مباشرة.
2. اعتماد مسار ملحق عقد موقع لأي تغيير تعاقدي في الهوية.
3. حفظ ملحق العقد الموقع PDF محلياً/دائماً مثل العقد الأصلي.
4. إرسال دعوة آمنة لتعيين كلمة المرور عند أول دخول بدلاً من إرسال كلمة سر نصية.
5. تمكين استعادة رقم المتجر وبيانات الدخول بصورة لا تكشف البيانات على الشاشة.

---

# 1) الحقول المحمية بعقد

الحقول المحمية حالياً هي:

```text
store_name
contact_email
```

ولا يستطيع التاجر تعديلها من:

```text
/api/merchant/store-contact
```

حتى لو عدل payload يرفض الخادم التغيير برسالة توضح أن المسار الصحيح هو طلب تعديل الهوية.

كما أصبح Admin Store PATCH يرفض تعديل الاسم أو البريد بصورة مباشرة، حتى لا يصبح مسار الأدمن bypass لمتطلبات الملحق والتوقيع.

الحقول التالية بقيت قابلة لتعديل التاجر تشغيلياً:

```text
contact phone
WhatsApp
Facebook
Instagram
video URL
store description/media عبر المسارات المخصصة
```

## السبب

```text
اسم المتجر والبريد المعتمد
→ يظهران في العقد والفواتير والتواصل والتدقيق
→ تغييرهما بلا سجل قانوني قد يسبب خلافاً أو تهرباً أو التباساً في الاستحقاقات
```

---

# 2) طلب تعديل هوية المتجر

## صفحة التاجر

```text
/merchant/identity-change-requests
```

يستطيع التاجر طلب تعديل:

```text
اسم المتجر التجاري
البريد الإلكتروني المعتمد
```

ويكتب:

```text
القيمة الجديدة
سبب التعديل
```

## دورة الحالة

```text
pending_review
→ awaiting_addendum_signature
→ approved

أو

pending_review
→ rejected
```

ويمنع النظام تكرار طلب مفتوح للحقل نفسه داخل المتجر.

## صفحة الأدمن

```text
/admin/identity-change-requests
```

الأدمن يستطيع:

```text
إنشاء ملحق للتوقيع
رفض الطلب مع السبب
اعتماد الملحق الموقع وتطبيق التعديل
```

---

# 3) ملحق العقد الرسمي

## جدول جديد

```text
merchant_contract_addendums
```

يحفظ:

```text
العقد الأصلي
رقم الملحق
الإصدار
سبب التعديل
القيمة الحالية والجديدة
body snapshot
SHA-256 content hash
حالة الملحق
التوقيع
وقت التوقيع
اعتماد الأدمن
```

## المسار

```text
طلب تعديل الهوية
→ الأدمن ينشئ Addendum
→ يصل إشعار للتاجر
→ التاجر يوقع الملحق
→ يحفظ PDF
→ الأدمن يعتمد الملحق
→ يطبق التعديل فقط بعد الاعتماد
```

## تطبيق التغيير

| الحقل | ما يطبق عند اعتماد الملحق |
|---|---|
| `store_name` | يتغير الاسم التجاري فقط؛ يبقى slug مستقراً لتجنب كسر روابط المتجر الحالية. |
| `contact_email` | يتغير البريد الإلكتروني المعتمد بعد التوقيع والاعتماد. |

لا يغير الملحق:

```text
رقم المتجر
مالك المتجر
الـslug
شروط الإيراد
رقم العقد الأصلي
```

إلا بملحق أو مسار إداري متخصص لاحقاً.

---

# 4) PDF لملحق العقد

أضيف:

```text
merchant_contract_archives
```

وعند توقيع الملحق:

```text
Signed Addendum
→ Arabic PDF
→ Media Asset
→ SHA-256 archive hash
→ merchant_contract_archives
```

ولا يستطيع الأدمن تطبيق تعديل الاسم أو البريد حتى توجد نسخة:

```text
signed_addendum_pdf
status = ready
```

وفي حال فشل التخزين/التوليد، يمكن إعادة التوليد عبر:

```text
POST /api/admin/contract-addendums/{id}/archive
```

هذا يمنع تطبيق تغيير قانوني بلا أرشيف PDF موقع.

---

# 5) أول دخول وكلمة المرور

## القرار الأمني

لا يتم إرسال كلمة مرور نصية للتاجر أبداً.

عند الموافقة النهائية:

```text
mustChangePassword = true
```

وينشئ النظام:

```text
one-time password reset invite
صلاحية 24 ساعة
```

ثم يرسل عبر notification والبريد/SMS إذا كانا مهيأين.

عند تسجيل الدخول، إذا كانت:

```text
mustChangePassword = true
```

توجه الواجهة التاجر إلى:

```text
/merchant/settings?mustChangePassword=1
```

لتغيير كلمة المرور قبل متابعة العمل.

> لا توجد كلمة مرور مؤقتة في notification أو email أو API response.

---

# 6) استعادة رقم المتجر والبيانات

أضيفت صفحة:

```text
/forgot-store-credentials
```

ومسار:

```text
POST /api/auth/recover-store-credentials
```

يدخل المستخدم:

```text
البريد الإلكتروني المعتمد
أو رقم متجر يتذكره
```

والسلوك الآمن:

```text
لا تعرض المنصة رقم متجر أو اسم مستخدم على الصفحة
→ ترسل البيانات فقط إلى البريد/الهاتف المعتمدين
→ تنشئ رابط إعادة تعيين كلمة مرور قصير العمر
→ تستجيب برسالة عامة لمنع account enumeration
```

وتظهر وصلة الاستعادة الجديدة في صفحة تسجيل الدخول:

```text
نسيت بيانات المتجر؟
```

---

# 7) Migration

Migration الجديدة:

```text
drizzle/0069_contract_addendums_identity_change_requests_and_archives.sql
```

تضيف:

```text
merchant_contract_addendums
store_identity_change_requests
merchant_contract_archives
```

والصلاحيات:

```text
contracts.addendum.manage
stores.identity_changes.review
store.identity_changes.view
store.identity_changes.create
```

تمت إضافتها إلى:

```text
drizzle/meta/_journal.json
```

---

# 8) أثر التوسع والصيانة

| المجال | التنفيذ |
|---|---|
| النزاعات | كل تغيير هوية يحمل القيمة السابقة والجديدة والسبب وملحقاً موقعاً. |
| الروابط | تغيير الاسم لا يغير slug تلقائياً، فتظل روابط المتجر الحالية سليمة. |
| التكرار | لا يوجد طلب هوية مفتوح مكرر للحقل نفسه. |
| الأرشفة | PDF metadata/hash في DB، binary في media storage. |
| recoverability | أرقام المتجر ترسل بعد التحقق خارج الصفحة، ولا تكشف بالاستعلام العام. |
| observability | Audit للطلب والملحق والتوقيع والاعتماد والأرشيف والاستعادة. |
| rollback | لا يحذف ملحقاً موقعاً؛ يمكن رفض الطلب قبل التوقيع فقط. |

---

# 9) التحقق المحلي

| الفحص | النتيجة |
|---|---|
| `npm run lint` | ناجح |
| `NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck` | ناجح |
| `npm test` | **48 ملفاً / 134 اختباراً ناجحاً** |
| identity/addendum policy tests | ناجح — يمنع slug ويثبت body الملحق والقيم السابقة/الجديدة |
| signed PDF tests | ناجح |
| `npm run migrations:verify` | ناجح — **70 SQL / 70 journal entries** |
| `npx drizzle-kit check --config=drizzle.config.ts` | `Everything's fine` |
| `npm run security:verify` | ناجح؛ لا أسرار معروفة و`npm audit --omit=dev` = 0 vulnerabilities |
| `git diff --check` | ناجح |

---

# 10) قيود واعتمادات خارجية

1. لم تطبق migrations `0068` و`0069` على Staging/Production.
2. يلزم اختبار PDF العربي بصرياً في Staging وعلى قارئات PDF المستهدفة.
3. local media مناسب للتطوير فقط؛ الوثائق القانونية في الإنتاج تحتاج private/durable object storage أو signed download proxy.
4. دعوة first login تعتمد إعداد outbound email/SMS لتصل خارج مركز التنبيهات.
5. redirect المستخدم عند `mustChangePassword` موجود في واجهة تسجيل الدخول؛ فرضه بصورة middleware شاملة لكل route يحتاج قراراً مستقلاً لتجنب تعطيل عمليات recovery/support.
6. لا يوجد بعد OTP/MFA قانوني لتوقيع الملاحق؛ PDF/hash/snapshot يوفر أدلة تشغيلية قوية لكنه ليس بديلاً عن رأي قانوني أو مزود توقيع معتمد.

## نظافة التسليم

بعد الفحوصات يعاد حذف `node_modules/` وcoverage و`tsconfig.tsbuildinfo` لأنها ملفات مولدة. لإعادة التشغيل:

```bash
npm ci
```
