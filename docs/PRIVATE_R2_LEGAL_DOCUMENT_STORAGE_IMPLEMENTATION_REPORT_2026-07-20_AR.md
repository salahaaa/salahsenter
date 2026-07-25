# تنفيذ تخزين R2 خاص للوثائق القانونية والعقود

**التاريخ:** 2026-07-20

## الهدف

فصل الوثائق القانونية عن Media Storage العام. الصور والوسائط العامة تبقى في Cloudinary/S3/R2 العام حسب `MEDIA_PROVIDER`، بينما تحفظ الوثائق التالية في R2 private bucket:

```text
وثائق طلب فتح متجر PDF
توقيع العقد الإلكتروني الجديد
أرشيف PDF للعقد الموقّع
فهرس وثائق PDF
```

## التنفيذ

### طبقة التخزين الخاص

أضيف:

```text
lib/private-documents-storage.ts
```

خصائصها:

- R2 private bucket في Production.
- Local private fallback للتطوير فقط.
- رفض Production إن لم يكن `PRIVATE_DOCUMENTS_STORAGE_PROVIDER=r2` مضبوطاً.
- فحص الاسم والنوع والتوقيع binary والملف التنفيذي وMalware hook قبل الرفع.
- حد حجم مستقل `PRIVATE_DOCUMENTS_MAX_SIZE_MB`، افتراضياً 15MB.
- لا تعيد public URL؛ تحفظ مرجعاً داخلياً فقط:

```text
private-r2://<storage-key>
```

### اعتراض الرفع القانوني

`/api/media/upload` يميّز الآن هذه المجلدات:

```text
merchant-application-documents/
merchant-application-archives/
contracts/
```

ويرفعها تلقائياً إلى Private Storage بدلاً من Media Provider العام.

### تنزيلات محمية

أضيفت routes محمية:

```text
/api/merchant-applications/[id]/documents/[documentId]/download
/api/merchant-applications/[id]/archives/[archiveId]/download
/api/merchant-applications/[id]/signature
```

تتحقق من أن الطالب:

```text
صاحب طلب المتجر
أو super_admin
```

ثم تقرأ الملف من R2 وتعيده مع:

```text
Cache-Control: private, no-store
X-Content-Type-Options: nosniff
```

### العقود والأرشيف

- التوقيع الإلكتروني الجديد يحفظ في Private R2.
- PDF المنشأ للعقد وفهرس الوثائق يحفظان في Private R2.
- الروابط في صفحة المتجر والأدمن تستخدم API محمي للملفات الخاصة.
- `renderSignedContractPdf` يستطيع قراءة توقيع R2 الخاص لإدراجه في PDF.

## متغيرات Vercel المطلوبة لاحقاً

```env
PRIVATE_DOCUMENTS_STORAGE_PROVIDER=r2
PRIVATE_DOCUMENTS_R2_BUCKET=...
PRIVATE_DOCUMENTS_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
PRIVATE_DOCUMENTS_R2_REGION=auto
PRIVATE_DOCUMENTS_R2_ACCESS_KEY_ID=...
PRIVATE_DOCUMENTS_R2_SECRET_ACCESS_KEY=...
PRIVATE_DOCUMENTS_R2_PREFIX=legal-documents
PRIVATE_DOCUMENTS_MAX_SIZE_MB=15
```

لا تضع `PRIVATE_DOCUMENTS_R2_*` في `NEXT_PUBLIC_*` ولا في source أو GitHub commits.

## حدود المرحلة

- الملفات الجديدة فقط ستصبح private فور ضبط R2.
- الملفات القديمة المخزنة كرابط عام أو `/uploads/` تبقى قابلة للعرض بالطريقة القديمة حتى تنفيذ migration media منفصل ومدروس.
- لم يجر اتصال حقيقي بـR2 أو نقل ملفات قديمة في Arena.
- لا migrations SQL جديدة؛ الجداول الحالية (`media_assets`, `merchant_application_documents`, `merchant_application_archives`) تخزن provider/storageKey بشكل كافٍ.

## التحقق

- أضيف `tests/private-legal-document-storage-policy.test.ts`.
- **70** ملف اختبار / **188** اختبار ناجح.
- lint/typecheck/import-case/migrations/Drizzle/security/audit كلها ناجحة.
