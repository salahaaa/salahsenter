# النشر الآمن من الهاتف: Neon Staging + Render Recovery

> هذا الدليل لا ينفذ أي خطوة تلقائياً، ولا يطلب منك إرسال كلمات مرور أو روابط قواعد بيانات في المحادثة.

## القرار المعتمد

```text
Neon الحالية              = Staging primary database
Render database الجديدة    = Staging Recovery database فقط
Production database        = Neon project مستقل لاحقاً
```

لا تربط قاعدة Render الجديدة بـ Vercel. فهي ليست مسؤولة عن عرض الواجهة، بل تستخدم لاحقاً فقط لتمرين:

```text
Staging R2 backup → isolated restore → evidence
```

## 0) إجراء أمني فوري

لأن بيانات اتصال Render ظهرت في المحادثة، قم من لوحة Render بـ:

```text
Reset / Rotate database password
```

أو أنشئ مستخدم قاعدة بيانات جديداً، ثم ألغ القديم. لا تنسخ الرابط الجديد في المحادثة أو الكود أو commit.

## 1) لا تستبدل قاعدة Staging الحالية

الواجهة الرئيسية لا تأتي من قاعدة البيانات؛ تأتي من:

```text
Next.js + Vercel
```

قاعدة البيانات تحفظ البيانات فقط. قاعدة جديدة فارغة لن تصلح تلقائياً:

```text
Vercel build فاشل/قديم
DATABASE_URL خاطئ
migrations غير مطبقة
Environment Variables ناقصة
```

لذلك لا تبدل Neon بقاعدة Render بسبب مشكلة الصفحة السابقة. نعالج الصفحة عبر Staging deployment جديدة وسجل Vercel، بعد رفع المصدر الحالي.

## 2) رفع المصدر الصحيح إلى GitHub

الملف الجاهز هو:

```text
salahsentar22-upload-source-light.zip
```

لا ترفع ZIP كملف واحد داخل root المستودع، لأن GitHub CI لن يراه كمصدر مشروع. يجب فك ضغطه أولاً ثم رفع محتوى مجلد المشروع، بحيث تظهر هذه الملفات في root:

```text
package.json
app/
components/
lib/
drizzle/
.github/workflows/
.env.example
.env.staging.example
.env.production.example
```

بعد الرفع، أنشئ فرعاً باسم:

```text
staging
```

ثم ادفع إليه المصدر الحالي. تم ضبط `CI` و`Security Pipeline` ليعملا على pushes وPull Requests الخاصة بـ `staging` أيضاً، لذلك لا تحتاج لدمج `main` حتى ينجح فحص المصدر.

تأكد من وجود:

```text
.github/workflows/ci.yml
docs/RELEASE_WORKFLOW_CATALOG_2026-07-23_AR.md
```

ثم انتظر نجاح `CI` و`Security Pipeline` على commit فرع `staging`. لا تشغل أي Workflow تشغيلي على remote قديم.

## 3) GitHub Environment: staging

أنشئ من الهاتف:

```text
Repository → Settings → Environments → New environment → staging
```

### Secrets في GitHub Environment `staging`

| الاسم | الاستخدام |
|---|---|
| `STAGING_DATABASE_URL` | Neon **Direct/Unpooled** فقط لـ migrations وbootstrap وfixtures. |
| `STAGING_JWT_SECRET` | JWT خاص بـ Staging، مختلف عن كل البيئات. |
| `STAGING_ADMIN_BOOTSTRAP_EMAIL` | بريد قائد Staging الأول. |
| `STAGING_ADMIN_BOOTSTRAP_NAME` | اسم قائد Staging الأول. |
| `STAGING_ADMIN_BOOTSTRAP_PASSWORD` | كلمة مرور أول مدير Staging، 16 حرفاً أو أكثر. |
| `STAGING_QA_TEAM_JSON` | بيانات 14 حساب اختبار فردية فقط. |
| `STAGING_RECOVERY_DATABASE_URL` | رابط Render الجديد بعد تدوير كلمة المرور؛ Recovery فقط. |
| `STAGING_BACKUP_R2_ACCESS_KEY_ID` | مفتاح R2 backup Staging فقط. |
| `STAGING_BACKUP_R2_SECRET_ACCESS_KEY` | سر R2 backup Staging فقط. |

### Variables في GitHub Environment `staging`

| الاسم | مثال منطقي بلا أسرار |
|---|---|
| `STAGING_APP_URL` | `https://staging.<your-domain>` |
| `STAGING_APP_HOST` | `staging.<your-domain>` |
| `STAGING_PRIVATE_DOCUMENTS_R2_BUCKET` | اسم bucket خاص يحمل كلمة `staging` |
| `STAGING_BACKUP_BUCKET` | اسم backup bucket خاص يحمل كلمة `staging` |
| `STAGING_BACKUP_R2_ENDPOINT` | R2 account endpoint فقط، بلا credentials |
| `STAGING_RECOVERY_TARGET_LABEL` | `staging-render-recovery` |

لا تضع `STAGING_DATABASE_URL` pooled في GitHub Actions migrations. الـpooled خاص بـ Vercel runtime فقط.

## 4) Vercel Staging Project

الأفضل إنشاء Vercel Project منفصل اسمه مثلاً:

```text
mall-os-staging
```

ويرتبط بفرع Staging، وليس بمشروع Production المستقبلي.

إذا استخدمت Vercel Production scope داخل مشروع اسمه `mall-os-staging` فهذا مقبول تقنياً، لكن تبقى القيم التالية إلزامية لتبقى البيئة **منطقياً Staging**:

```text
APP_ENV=staging
NEXT_PUBLIC_APP_ENV=staging
ENVIRONMENT_ISOLATION_ENFORCED=true
RUNTIME_ENVIRONMENT=staging
RESOURCE_NAMESPACE=mall-os:staging
REDIS_KEY_PREFIX=mall-os:staging:
PAYMENT_ENVIRONMENT=sandbox
ERP_ENVIRONMENT=sandbox
OUTBOUND_DELIVERY_MODE=sandbox
```

## 5) Vercel Staging Environment Variables

استخدم `.env.staging.example` كمرجع. لا تضع كل الخيارات المتعارضة معاً؛ اختر مزود الوسائط المناسب فقط.

### أ) Core + Database

```env
APP_ENV=staging
NEXT_PUBLIC_APP_ENV=staging
NEXT_PUBLIC_APP_URL=https://staging.<your-domain>
ENVIRONMENT_ISOLATION_ENFORCED=true
RUNTIME_ENVIRONMENT=staging
RESOURCE_NAMESPACE=mall-os:staging
ENVIRONMENT_PUBLIC_HOST=staging.<your-domain>

DATABASE_URL=<Neon STAGING POOLED URL>
DATABASE_POOLER_ENABLED=true
DB_POOL_MAX=3
POSTGRES_POOL_MAX=3
DB_IDLE_TIMEOUT_SECONDS=20
DB_CONNECT_TIMEOUT_SECONDS=10
DB_APPLICATION_NAME=salahsentar22-staging

JWT_SECRET=<different unique Staging secret>
SESSION_COOKIE_NAME=mall_staging_session
CRON_SECRET=<different unique Staging cron secret>
```

### ب) Redis Staging المستقل

```env
REDIS_REQUIRED=true
REDIS_KEY_PREFIX=mall-os:staging:
UPSTASH_REDIS_REST_URL=<Staging Redis URL>
UPSTASH_REDIS_REST_TOKEN=<Staging Redis token>
```

### ج) Public Media — اختر واحداً فقط

#### خيار Cloudinary

```env
MEDIA_PROVIDER=cloudinary
MEDIA_MAX_SIZE_MB=8
CLOUDINARY_CLOUD_NAME=<Staging Cloudinary account/product>
CLOUDINARY_API_KEY=<Staging key>
CLOUDINARY_API_SECRET=<Staging secret>
CLOUDINARY_FOLDER=staging
NEXT_IMAGE_REMOTE_HOSTS=res.cloudinary.com
CSP_IMG_SRC=res.cloudinary.com
```

#### أو خيار R2/S3-compatible للصور العامة

```env
MEDIA_PROVIDER=r2
MEDIA_MAX_SIZE_MB=8
S3_ENDPOINT=<Staging R2 endpoint>
S3_REGION=auto
S3_BUCKET=<Staging public-media bucket>
S3_ACCESS_KEY_ID=<Staging key>
S3_SECRET_ACCESS_KEY=<Staging secret>
S3_PUBLIC_BASE_URL=<Staging public media URL>
```

### د) R2 للوثائق القانونية الخاصة

```env
PRIVATE_DOCUMENTS_STORAGE_PROVIDER=r2
PRIVATE_DOCUMENTS_R2_BUCKET=<private bucket name containing staging>
PRIVATE_DOCUMENTS_R2_ENDPOINT=<R2 endpoint>
PRIVATE_DOCUMENTS_R2_REGION=auto
PRIVATE_DOCUMENTS_R2_ACCESS_KEY_ID=<Staging key>
PRIVATE_DOCUMENTS_R2_SECRET_ACCESS_KEY=<Staging secret>
PRIVATE_DOCUMENTS_R2_PREFIX=staging/legal-documents
PRIVATE_DOCUMENTS_MAX_SIZE_MB=15
```

### هـ) R2 للنسخ الاحتياطي

```env
BACKUP_STORAGE_PROVIDER=r2
BACKUP_S3_BUCKET=<private backup bucket name containing staging>
BACKUP_S3_ENDPOINT=<R2 endpoint>
BACKUP_S3_REGION=auto
BACKUP_S3_ACCESS_KEY_ID=<Staging backup key>
BACKUP_S3_SECRET_ACCESS_KEY=<Staging backup secret>
BACKUP_S3_PREFIX=staging/database
BACKUP_MEDIA_ENABLED=false
```

### و) Email/SMS Sandbox

لا ترسل رسائل إلى عملاء حقيقيين من Staging.

```env
OUTBOUND_DELIVERY_MODE=sandbox
EMAIL_NOTIFICATIONS_ENABLED=false
SMS_NOTIFICATIONS_ENABLED=false
SMS_WEBHOOK_ENABLED=false
```

عند تجهيز test sink أو allowlisted sandbox relay فقط، أضف URLs/tokens الخاصة به ثم فعّل القنوات.

### ز) الدفع وERP

مرحلة الدفع الأولى المعتمدة هي:

```env
PLATFORM_CUSTOMER_MONEY_MODE=merchant_collects
PAYMENT_ENVIRONMENT=sandbox
ERP_ENVIRONMENT=sandbox
```

لـ COD وتحويلات المحافظ لا تحتاج Stripe الآن. اترك القيم التالية فارغة إلى أن يكون لديك Sandbox حقيقي:

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
LOCAL_GATEWAY_API_URL=
LOCAL_GATEWAY_WEBHOOK_SECRET=
INTEGRATION_API_KEYS=
INTEGRATION_CLIENTS_JSON=
```

### ح) المراقبة

```env
SENTRY_DSN=<Staging Sentry DSN>
NEXT_PUBLIC_SENTRY_DSN=<Staging public DSN>
SENTRY_TRACES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
```

## 6) ترتيب تشغيل GitHub Actions

بعد أن يكون source الحديث مرفوعاً وأن GitHub CI نجح:

```text
1. Apply Staging database migrations
   confirmation: APPLY_STAGING_MIGRATIONS

2. Bootstrap first Staging platform administrator
   confirmation: BOOTSTRAP_FIRST_STAGING_ADMIN

3. Provision isolated Staging test team
   confirmation: PROVISION_STAGING_TEST_TEAM
   reset_passwords: false

4. Deploy/verify the Vercel Staging project and staging domain

5. Staging release validation and evidence
   confirmation: RUN_STAGING_RELEASE_VALIDATION

6. Staging backup and isolated recovery drill
   confirmation: RUN_STAGING_BACKUP_RECOVERY_DRILL
```

الخطوة 6 تستخدم Render فقط كهدف Recovery، ولا تربطها بـ Vercel.

## 7) التحقق من مشكلة الواجهة الرئيسية القديمة

بعد نشر Staging الجديدة لا تحكم من قاعدة البيانات فقط. افحص بالترتيب:

```text
1. GitHub CI build على commit الحديث
2. Vercel deployment logs
3. Vercel runtime environment variables
4. /api/health
5. /
6. Staging release validation artifact
```

إذا فشلت الصفحة، نستخدم Vercel Runtime Logs ورسالة الخطأ الفعلية. لا ننشئ قاعدة جديدة كل مرة؛ نصلح السبب المحدد.

## ممنوعات

```text
- لا ترسل DATABASE_URL أو كلمات المرور في المحادثة.
- لا تضع Render Recovery URL في Vercel DATABASE_URL.
- لا تستخدم Neon Direct URL في Vercel runtime.
- لا تستخدم Neon Pooled URL في GitHub migrations/recovery workflows.
- لا تشغّل db:push أو db:seed أو QA fixtures على Production.
- لا تعتبر Staging ناجحة قبل Artifacts وRecovery evidence.
```
