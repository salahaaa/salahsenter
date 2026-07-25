# تصميم سد فجوات دورة فتح المتجر والأرشفة المحلية PDF

**التاريخ:** 14 يوليو 2026  
**قاعدة الحوكمة:** لا إضافة بدون حساب التوسع، ولا إضافة بدون حساب الصيانة.

## النطاق

إغلاق ست فجوات التدقيق:

1. منع bypass لحالات Merchant Application.
2. دورة مستندات: required → uploaded → approved/rejected/waived، مع واجهة تاجر وأدمن.
3. تعديل وإعادة تقديم للتاجر عند `waiting_for_data`.
4. سلامة العقد: version/hash/snapshot وتوقيع لا يقبل mismatch.
5. إنشاء `merchant_revenue_terms` ضمن اعتماد المتجر، مع فصل promotion agreement.
6. فصل Account Activation عن Public Store Launch عبر readiness gate.

وإضافة:

```text
PDF archive محلي/دائم للعقد الموقّع
+ حفظ الوثائق القانونية كـPDF محلي في media storage
+ PDF manifest للوثائق المعتمدة
```

## قرارات مهمة

### المستندات

- الوثائق القانونية الجديدة تقبل **PDF فقط**؛ هذا يمنع التحويل غير الموثوق من صور إلى PDF داخل Serverless ويضمن أن النسخة المخزنة هي أصل PDF نفسه.
- يرفع التاجر الملف إلى folder خاص بالطلب، ثم API يتحقق من `media_assets.owner_id`, `storage_key`, `mime_type` قبل ربطه بالطلب.
- لا يعتبر رفع الوثيقة اعتماداً؛ الأدمن فقط يعتمد أو يرفض أو يعفي requirement.

### PDF العقد

- ينشأ PDF فعلي عند التوقيع من النص والنسخة والـhash وبيانات الموقع والتوقيع.
- يحفظ archive record + media asset، وليس file path عابراً فقط.
- local provider يخزن في `/public/uploads` في التطوير؛ الإنتاج يتطلب S3/R2/Cloudinary durable media policy.
- إذا أخفق توليد الأرشيف بعد التوقيع، يسجل archive `failed` ولا يدّعي وجود PDF؛ يوفر retry إداري.

### إطلاق المتجر

```text
Final Approval
→ merchant account active + store status pending
→ store_launch_readiness setup_pending
→ merchant setup
→ submit readiness
→ admin approval
→ store status active/public
```

## التوسع

- document requirements مفهرسة application/status، ولا يوجد N+1 عند عرض الطلب.
- archive unique application/kind/version لمنع نسخ PDF مكررة بالتوقيع نفسه.
- readiness checks computed server-side من store/products/payments/shipping؛ لا تعتمد profileCompleteness ثابت.
- transitions محصورة في services/routes محددة، وليس PATCH عام.

## الصيانة

- Audit لكل upload/document review/application revision/signature/archive/revenue terms/launch gate.
- Admin Work Queue يلتقط documents المطلوبة، signature pending، readiness submitted.
- PDF archive retry endpoint للأدمن في حال فشل storage/render.
- لا أسرار أو PDF binary داخل DB؛ DB يحمل metadata/hash/url فقط.

## التوافق والـrollback

- Migration additive.
- الطلبات القديمة لا تكسر: لا requirements إلزامية بأثر رجعي إلا عند إنشاء/تعيين policy جديد.
- المتاجر التي أنشئت سابقاً لا تتحول pending تلقائياً.
- يمكن إعادة توليد archive بلا تغيير توقيع أو نص العقد، مع audit.
