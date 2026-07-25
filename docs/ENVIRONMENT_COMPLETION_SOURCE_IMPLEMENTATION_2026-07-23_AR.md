# Environment Completion Plan — الحزمة البرمجية وCI

**التاريخ:** 23 يوليو 2026  
**النطاق:** تجهيز المصدر وGitHub Actions فقط. لا يتضمن إنشاء أو لمس Neon/Vercel/Redis/R2/Cloudinary/Stripe/ERP الفعلية.

## 1. ما الذي تحقق في المصدر؟

### عزل البيئة كعقد تشغيلي Fail-Closed

أضيفت وحدة:

```text
lib/environment/isolation.ts
```

وتتحقق من أن البيئة المعلنة تملك namespace متسقاً:

```text
APP_ENV
NEXT_PUBLIC_APP_ENV
RUNTIME_ENVIRONMENT
RESOURCE_NAMESPACE
REDIS_KEY_PREFIX
ENVIRONMENT_PUBLIC_HOST
PAYMENT_ENVIRONMENT
ERP_ENVIRONMENT
OUTBOUND_DELIVERY_MODE
```

مثال Staging الصحيح:

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

عند تفعيل:

```text
ENVIRONMENT_ISOLATION_ENFORCED=true
```

وأي نقص في العقد، يرد middleware برسالة `503` عامة ولا يكشف أسماء buckets أو روابط أو أسرار. أما التفاصيل فتظهر فقط في فحص CI أو بوابة الجاهزية.

> هذا يمنع أخطاء الإعداد الشائعة، لكنه لا يستطيع بمفرده إثبات أن مزوداً خارجياً أعطى رابطاً يخص بيئة مختلفة. لذلك تظل تسمية المشاريع والبuckets المنفصلة وإدارة الأسرار المنفصلة مطلوبة.

### Redis namespacing حقيقي

أضيف:

```text
REDIS_KEY_PREFIX
```

وأصبح مستخدماً في مفاتيح:

```text
Public cache
Cache tags
Cache locks
Rate limits
Request monitoring counters
```

فتصبح أمثلة مفاتيح Staging:

```text
mall-os:staging:cache:...
mall-os:staging:rate:...
mall-os:staging:obs:req:...
```

وهذا طبقة حماية إضافية حتى لو حدث خطأ تشغيلي ووصلت بيئتان إلى Redis واحد. لكنه **ليس بديلاً** عن Redis مستقل فعلياً لكل بيئة.

### نماذج بيئات واضحة

أضيف:

```text
.env.staging.example
```

وتم تحديث:

```text
.env.example
.env.production.example
```

في Production أصبحت المسارات النموذجية منفصلة بوضوح:

```text
CLOUDINARY_FOLDER=production
PRIVATE_DOCUMENTS_R2_PREFIX=production/legal-documents
BACKUP_S3_PREFIX=production/database
REDIS_KEY_PREFIX=mall-os:production:
```

وفي Staging تكون:

```text
CLOUDINARY_FOLDER=staging
PRIVATE_DOCUMENTS_R2_PREFIX=staging/legal-documents
BACKUP_S3_PREFIX=staging/database
REDIS_KEY_PREFIX=mall-os:staging:
```

### دعم حسابات QA ذات أدوار المتجر/المنصة المخصصة

تمت إضافة توافق middleware مع أدوار فريق Staging المعرفة سابقاً:

```text
qa_staging_platform_*
```

ولا تزال الصلاحيات الدقيقة والفصل بين المتاجر مفروضة من طبقة Authorization وRBAC.

## 2. Staging Release Validation

أضيف workflow يدوي فقط:

```text
.github/workflows/staging-release-validation.yml
```

اسمه في GitHub Actions:

```text
Staging release validation and evidence
```

لا يعمل إلا عند كتابة:

```text
RUN_STAGING_RELEASE_VALIDATION
```

ويستخدم GitHub Environment باسم:

```text
staging
```

ولا يحتوي على أي أمر نشر Production أو `vercel --prod`.

### ما ينفذه workflow

1. تثبيت الاعتمادات على Node `22.19.0`.
2. فحوص المصدر:

```text
check:paths
check:import-case
lint
typecheck
unit tests
migration verification
Drizzle schema check
security verification
npm audit --audit-level=high
environment isolation verification
next build
bundle budget report
```

3. تثبيت Chromium.
4. تشغيل Playwright على رابط Staging الصريح.
5. تشغيل Axe Accessibility على:

```text
/
/offers
/login
```

ويمنع critical/serious violations في هذه الصفحات.

6. تشغيل Lighthouse على نفس صفحات Staging مع الحدود الافتراضية:

```text
Performance >= 0.70
Accessibility >= 0.90
Best Practices >= 0.90
SEO >= 0.90
```

7. خياران لا يعملان إلا إذا اختارهما المشغل صراحة:

```text
run_full_cycle=true  → دخـول دورة بيانات Staging المعزولة
run_load_probe=true  → HTTP load probe عام وغير هدّام
```

8. إنشاء Artifact لمدة 30 يوماً يحوي:

```text
playwright-report/
test-results/                 # Axe JSON attachments
artifacts/lighthouse/
artifacts/load/
artifacts/release-evidence/
```

ويفشل workflow إذا فشل Playwright/Axe أو Lighthouse، أو الاختبارات الاختيارية عند طلبها.

## 3. Lighthouse وAxe

### Axe

أضيف:

```text
tests/playwright/staging-accessibility.spec.ts
```

لا يعمل هذا الاختبار تلقائياً على التطوير المحلي؛ لا يُفعّل إلا عبر:

```text
PLAYWRIGHT_A11Y_AUDIT=true
```

وذلك حتى لا نخلط تقرير Staging الحقيقي بمعاينة محلية غير مهيأة.

### Lighthouse

أضيف:

```text
scripts/lighthouse/run-staging-audit.mjs
npm run test:staging:lighthouse
```

الحماية الإلزامية:

```text
APP_ENV=staging
LIGHTHOUSE_BASE_URL=https://<staging-host>
```

ولا يمكن تشغيله على Production من دون تغيير صريح في المصدر، وهو غير مطلوب في هذه الحزمة.

## 4. GitHub Environment المطلوبة لاحقاً

بعد رفع المصدر فقط، أنشئ Environment باسم `staging` وأضف بدون إرسال أي قيمة في المحادثة:

### Secrets

```text
STAGING_DATABASE_URL          # Neon Direct/Unpooled، فقط migrations وfull-cycle الاختياري
STAGING_JWT_SECRET
```

### Variables

```text
STAGING_APP_URL
STAGING_APP_HOST
STAGING_PRIVATE_DOCUMENTS_R2_BUCKET
STAGING_BACKUP_BUCKET
```

يجب أن تكون القيم التشغيلية الفعلية في مشروع Vercel الخاص بـ Staging مطابقة لنموذج:

```text
.env.staging.example
```

وخاصة URL قاعدة بيانات **pooled** داخل Vercel runtime، وRedis/R2/Cloudinary sandbox المستقلة.

## 5. بوابة Production: ما الذي يفرضه المصدر وما الذي يحتاج إعداداً خارجياً؟

### يفرضه المصدر / CI

- التحقق البرمجي والأمني والمهاجرات والبناء.
- فشل Staging validation عند فشل Playwright/Axe/Lighthouse.
- حفظ أدلة قابلة للتنزيل من GitHub Artifacts.
- منع تشغيل Staging test workflow بلا تأكيد نصي.
- عدم وجود أمر Production deployment في workflow الجديد.

### يحتاج إعداداً خارجياً ولا يمكن للكود فرضه وحده

1. GitHub Branch Protection لـ `main` مع Required Status Checks.
2. عدم جعل Vercel ينشر Production تلقائياً من فرع غير محمي.
3. ربط Vercel Production لاحقاً بمشروع Neon/Redis/R2/Cloudinary مستقلين.
4. وضع secrets الصحيحة في Vercel/GitHub Environment، لا في المصدر.
5. Domain وDNS مثل:

```text
staging.salahsenter.com
```

6. إنشاء Payment Sandbox وERP Sandbox حقيقيين.
7. تمرين Backup + Recovery حقيقي على قاعدة Recovery منفصلة.

لذلك لا يعني وجود workflow أن Production أصبح مسموحاً. الدليل الحقيقي لا يكتمل إلا بعد نجاح تشغيله على Staging الخارجية وحفظ الـArtifacts، ثم تفعيل Branch Protection وVercel policy يدوياً.

## 6. ما لم يُنفذ فعلياً

لم يتم في هذه الحزمة:

```text
- إنشاء Neon أو قاعدة بيانات أو migrations خارجية
- إنشاء Redis أو R2 أو Cloudinary أو domain
- رفع المصدر إلى GitHub
- تشغيل GitHub Action
- تشغيل Playwright/Axe/Lighthouse على رابط Staging
- إنشاء Stripe/local-gateway/ERP Sandbox
- نشر Vercel أو Production
```

## 7. التحقق المحلي من المصدر

يجب تنفيذ هذه المجموعة قبل رفع المصدر:

```bash
npm run check:paths
npm run check:import-case
npm run lint
NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck
npm test
npm run migrations:verify
npx drizzle-kit check --config=drizzle.config.ts
npm run security:verify
npm audit --audit-level=high
git diff --check
```

كما تمت إضافة اختبارات سياسة للعزل تشمل:

```text
- قبول Staging namespaces الصحيحة.
- رفض خلط R2 Production أو Payment live داخل Staging.
- حماية مفاتيح Redis من التصادم.
```

### نتيجة التحقق المحلي لهذه الحزمة

```text
npm run check:paths                                      ✅
npm run check:import-case                                ✅
npm run lint                                             ✅
NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck ✅
npm test                                                 ✅ 72 ملفات / 197 اختباراً
npm run migrations:verify                                ✅ 87 migrations
npx drizzle-kit check --config=drizzle.config.ts         ✅
npm run security:verify                                  ✅
npm audit --audit-level=high                             ✅ 0 vulnerabilities
git diff --check                                         ✅
YAML workflows validation                                ✅
```

هذه الحزمة تجعل المصدر **جاهزاً لتهيئة Staging واختبارها عبر CI**، لكنها لا تمنح تصريح إطلاق Production ولا تعتبر اختباراً حياً للخدمات الخارجية.
