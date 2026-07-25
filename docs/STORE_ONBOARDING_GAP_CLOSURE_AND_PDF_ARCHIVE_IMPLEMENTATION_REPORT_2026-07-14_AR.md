# تقرير سد فجوات دورة فتح المتجر والأرشفة PDF

**التاريخ:** 14 يوليو 2026  
**الحالة:** تم تنفيذ الحزمة محلياً في المصدر. لم تطبق migrations ولم ينشر أي مسار على Staging/Production.  
**الحوكمة:** لا إضافة بدون حساب التوسع، ولا إضافة بدون حساب الصيانة.

## الهدف المنفذ

تحويل دورة فتح المتجر من workflow أساس جيد إلى مسار محكوم:

```text
طلب موثق
→ وثائق PDF مطلوبة ومراجعة
→ تعديل وإعادة تقديم عند الحاجة
→ قبول مبدئي
→ شروط إيراد منصة داخل العقد
→ عقد بإصدار وبصمة وتوقيع
→ PDF archive
→ اعتماد حساب/متجر بحالة setup_pending
→ Checklist جاهزية
→ اعتماد الأدمن
→ متجر public active
```

---

# 1) سد فجوة bypass لحالات الطلب

## قبل الحزمة

كان المسار العام:

```text
PATCH /api/admin/merchant-applications/{id}
```

قادراً على تغيير حالة الطلب مباشرة، متجاوزاً review/contract/final approval.

## بعد الحزمة

أصبح هذا المسار **مخصصاً لملاحظة الأدمن فقط**. لا يغير status إطلاقاً.

كل status transition يمر الآن عبر:

```text
POST /api/admin/merchant-applications/{id}/review
POST /api/admin/merchant-applications/{id}/approve
```

وبالتالي لا يمكن جعل application `active` من دون إنشاء Store/Contract/Merchant records فعلياً.

---

# 2) دورة الوثائق الثبوتية الكاملة

## جداول وبيانات جديدة

```text
merchant_application_document_requirements
merchant_application_documents (enhanced)
```

المتطلبات الافتراضية للطلب الجديد:

```text
identity
commercial_register
tax_card
```

الحالات:

```text
requested
uploaded
approved
rejected
waived
```

## ما يحدث الآن

1. عند إنشاء طلب متجر تنشأ متطلبات الوثائق.
2. التاجر يرى المتطلبات داخل صفحة متابعة الطلب.
3. يرفع الوثيقة من folder خاص بالطلب:

```text
merchant-application-documents/{applicationId}/
```

4. يقبل النظام **PDF فقط** للوثائق القانونية الجديدة.
5. API يتحقق من:

```text
ownerId
media asset URL
storage key prefix
mime type = application/pdf
```

6. الأدمن يعتمد أو يرفض أو يعفي كل متطلب منفصلاً.
7. لا يسمح بـ`pre_approve` أو `create_contract` أو final approval قبل اعتماد/إعفاء جميع المتطلبات الإلزامية.

## المسارات الجديدة

```text
PATCH /api/admin/merchant-applications/{id}/documents/{requirementId}
```

## واجهات جديدة

- لوحة التاجر داخل `/apply-store/{id}` لرفع PDF ومتابعة الحالة.
- لوحة الأدمن داخل مراجعة الطلب لاعتماد/رفض/إعفاء كل وثيقة.
- Work Queue يضيف الوثائق المرفوعة للمراجعة.

---

# 3) تعديل وإعادة تقديم الطلب

أضيف:

```text
PATCH /api/merchant-applications/{id}
```

المتاح للتاجر فقط عندما تكون الحالة:

```text
waiting_for_data
```

ويسمح بتعديل:

```text
بيانات مقدم الطلب
الهاتف
اسم المتجر
النشاط
الوصف
الجناح
الموقع الجغرافي
روابط التواصل
```

ثم يعيد الطلب إلى:

```text
under_review
```

مع Audit Log وتنبيه للأدمن.

---

# 4) سلامة العقد والتوقيع

## النسخة والبصمة

تم تعديل العقد بحيث يتضمن:

```text
revenue model
monthly rent
commission rate
due days
grace days
```

وأصبح توقيع العقد يتطلب:

```text
contractVersion صريحة
مطابقة تامة لنسخة العقد الصادرة من الأدمن
```

ويرفض الخادم mismatch بين نسخة النموذج ونسخة `merchant_application`.

تمت إضافة:

```text
contractBodyHash (SHA-256)
```

داخل snapshot الموقع، لتوثيق النص الذي وقع عليه التاجر.

## منع إعادة التوقيع غير المقصود

التوقيع مسموح في:

```text
contract_created
```

فقط. بعد التوقيع ينتقل إلى:

```text
waiting_final_approval
```

ولا يعاد التوقيع إلا بعد أن تصدر الإدارة نسخة/مرحلة مناسبة من جديد.

---

# 5) حفظ العقد الموقع والوثائق محلياً بصيغة PDF

## اعتماد تقني

أضيفت dependency:

```text
pdfkit
```

وملف خط عربي مضمّن مطلوب لتكوين PDF عربي:

```text
assets/fonts/DejaVuSans.ttf
```

## العقد الموقع

عند نجاح التوقيع ينفذ النظام:

```text
render signed contract PDF
→ حفظ media asset
→ merchant_application_archives
→ SHA-256 archive hash
```

والـPDF يحتوي:

```text
بيانات المتجر والمتقدم
رقم العقد وإصداره
نص العقد
بصمة snapshot
وقت التوقيع
بيانات الموقّع
مرجع/معاينة التوقيع عند توفرها
```

## الوثائق

- كل وثيقة قانونية ترفع PDF أصلياً وتحفظ كـmedia asset محلي/دائم.
- عند اعتماد أو رفض متطلب وثيقة، ينشئ النظام أو يحدث:

```text
documents_manifest_pdf
```

وهو PDF فهرس تدقيقي يحتوي:

```text
المتطلبات
الحالات
أسماء الملفات
storage keys
SHA-256
ملاحظات المراجعة
```

## الأرشيف

أضيف جدول:

```text
merchant_application_archives
```

بالحالات:

```text
pending
ready
failed
```

ويستطيع الأدمن إعادة توليد archive failed من صفحة مراجعة الطلب عبر endpoint:

```text
POST /api/admin/merchant-applications/{id}/archives/{kind}
```

## التخزين المحلي والإنتاج

| البيئة | مكان الحفظ |
|---|---|
| Development مع `MEDIA_PROVIDER=local` | `/public/uploads/merchant-application-archives/...` |
| Production | يجب استخدام S3/R2/Cloudinary durable storage؛ لا يصح الاعتماد على local filesystem أو `/tmp` |

> ملاحظة أمنية: مزود media الحالي قد ينتج URLs عامة بحسب provider. قبل إطلاق وثائق قانونية حقيقية يجب اعتماد private bucket/signed URLs أو proxy تنزيل محمي. لم ندّعِ أن local public URL حلاً قانونياً نهائياً.

---

# 6) ربط نموذج إيرادات المنصة بالاعتماد النهائي

## قبل الحزمة

كان final approval ينشئ:

```text
store_rental_agreement فقط
```

## بعد الحزمة

ينشئ final approval داخل transaction نفسها:

```text
merchant_revenue_terms
```

بقيم العقد:

```text
monthly_rent
sales_commission
hybrid
monthly rent
commission rate
due days
grace days
```

كما يبقي `store_rental_agreement` للتوافق والإضافات، لكن مع:

```text
consolidatedBilling = true
```

حتى لا تتكرر فاتورة إيجار legacy بجانب كشف إيرادات المنصة الموحد.

## الترويج

لم يتم إنشاء `merchant_promotion_agreement` تلقائياً؛ لأنه مقصود أن يبقى اتفاقاً مستقلاً واختيارياً عن عقد الإيجار، وفق القرار التجاري المعتمد.

---

# 7) فصل اعتماد الحساب عن النشر العام

## قبل الحزمة

كان final approval ينشئ المتجر مباشرة:

```text
status = active
isActive = true
profileCompleteness = 75
```

## بعد الحزمة

ينشئ المتجر:

```text
status = pending
isActive = true
profileCompleteness = 0
```

وينشئ سجل:

```text
store_launch_readiness
status = setup_pending
```

المتجر غير ظاهر للعامة لأن public queries تتطلب:

```text
status = active
isActive = true
```

## Checklist الإطلاق

يفحص الخادم فعلياً:

```text
عقد نشط
وصف + هاتف + بريد
شعار + غلاف
منتج active واحد على الأقل
وسيلة دفع مفعلة للتاجر
وسيلة شحن/استلام مفعلة
```

### دورة الإطلاق

```text
setup_pending
→ التاجر يكمل التهيئة
→ POST /api/merchant/store-launch-readiness
→ submitted
→ الأدمن يراجع
→ approve = store active/public
أو reject = setup_pending
```

واجهات جديدة:

```text
/merchant/launch-readiness
/admin/store-launch-readiness
```

ويظهر طلب الإطلاق في Admin Work Queue.

---

# 8) بيانات ومigrations

Migration الجديدة:

```text
drizzle/0068_store_onboarding_document_workflow_launch_gate_pdf_archives.sql
```

تشمل:

```text
merchant_applications:
  revenue_model
  monthly_rent
  due_days
  grace_days

merchant_application_documents:
  requirement_id
  media_asset_id
  storage_key
  mime_type
  sha256

merchant_application_document_requirements
merchant_application_archives
store_launch_readiness
```

تمت إضافتها فوراً إلى:

```text
drizzle/meta/_journal.json
```

---

# 9) أثر التوسع والصيانة

| المجال | القرار |
|---|---|
| الوثائق | متطلبات منفصلة indexed لكل application؛ لا يعتمد العقد على مجرد count للوثائق. |
| PDF | archive metadata/hash في DB والbinary في media storage، لا PDF/base64 ضخم داخل DB. |
| التكرار | archive unique حسب application/kind/version؛ إعادة التوليد update آمن. |
| الإطلاق | readiness row unique لكل store، checks server-side وليست profile percentage ثابتة. |
| workflow | status transition محصور في routes متخصصة؛ generic PATCH لا يغير status. |
| الإيرادات | terms تنشأ في final approval transaction؛ الترويج يبقى opt-in منفصلاً. |
| المراقبة | document review وlaunch readiness يضافان إلى Admin Work Queue. |

---

# 10) التحقق المحلي

| الفحص | النتيجة |
|---|---|
| `npm run lint` | ناجح |
| `NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck` | ناجح |
| `npm test` | **47 ملفاً / 132 اختباراً ناجحاً** |
| PDF render test | ناجح — يتحقق من `%PDF` وحجم ملف العقد |
| onboarding workflow policy | ناجح — متطلبات الوثائق ورفض status bypass وcontract version |
| `npm run migrations:verify` | ناجح — **69 SQL / 69 journal entries** |
| `npx drizzle-kit check --config=drizzle.config.ts` | `Everything's fine` |
| `npm run security:verify` | ناجح؛ لا أسرار معروفة و`npm audit --omit=dev` = 0 vulnerabilities |
| `git diff --check` | ناجح |

---

# 11) قيود متبقية

1. لم تطبق migration 0068 على Staging أو Production.
2. لم يتم اختبار lifecycle مع PostgreSQL حقيقية أو media provider S3/R2 فعلي.
3. PDFKit render اختبر binary، لكن يلزم visual QA على Staging للتأكد من Arabic shaping/RTL في قارئ PDF المستهدف.
4. لا يوجد بعد OTP/MFA أو موفر توقيع إلكتروني قانوني خارجي؛ snapshot/hash/timestamp تحسن الإثبات التشغيلي ولا تغني عن المراجعة القانونية.
5. الوثائق الجديدة PDF-only عمداً. إن تقرر قبول صور الهوية، يلزم image-to-PDF conversion service مؤمن أو رفع PDF scanner من التطبيق، لا تحويل غير موثوق داخل Serverless.
6. private signed URLs للوثائق الإنتاجية ليست مكتملة في طبقة media الحالية؛ يجب اعتماد provider وسياسة وصول قبل إنتاج حقيقي.
7. لم يُشغّل `next build` بسبب قيد ذاكرة Arena المعروف؛ يؤكد في GitHub Actions/Vercel.

---

# 12) توصية التشغيل

قبل الإطلاق الفعلي:

```text
1. طبق migrations حتى 0068 على Staging.
2. اختبر طلباً جديداً كاملاً مع 3 PDFs.
3. ارفض وثيقة ثم ارفع بديل واعتمده.
4. اختبر waiting_for_data ثم edit/resubmit.
5. أنشئ عقد hybrid، تحقق من version/hash/PDF.
6. اعتمد الحساب، ثم أكمل checklist الدفع والشحن والمنتج.
7. اعتمد launch readiness وتحقق أن المتجر لم يكن عاماً قبل ذلك.
8. اختبر archive download من S3/R2 أو private proxy قبل Production.
```
