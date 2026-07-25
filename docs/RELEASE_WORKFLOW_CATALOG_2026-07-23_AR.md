# كتالوج Workflows الرسمي للإصدار والتشغيل

> هذا الملف هو مصدر الحقيقة لملفات GitHub Actions المطلوبة في كل حزمة مصدر رسمية.  
> لا تشغّل أي Workflow على قاعدة أو خدمة حقيقية قبل التأكد أن commit المرفوع يحتوي الملف نفسه وأن CI نجح.

<!-- release-workflows:start -->

| الملف داخل `.github/workflows/` | الاسم الظاهر في GitHub | البيئة | الغرض |
|---|---|---|---|
| `ci.yml` | `CI` | مصدر فقط | تثبيت نظيف، build، lint، typecheck، tests، migrations، security، audit. |
| `security.yml` | `Security Pipeline` | مصدر فقط | فحص أسرار واعتمادات وCodeQL ضمن صلاحيات GitHub المناسبة. |
| `apply-migrations.yml` | `Apply database migrations` | `production` | تطبيق Drizzle migrations على Production فقط وبشكل متسلسل. |
| `bootstrap-first-admin.yml` | `Bootstrap first platform administrator` | `production` | إنشاء أول `super_admin` مرة واحدة فقط. |
| `apply-staging-migrations.yml` | `Apply Staging database migrations` | `staging` | تطبيق migrations على قاعدة Staging فقط. |
| `bootstrap-first-staging-admin.yml` | `Bootstrap first Staging platform administrator` | `staging` | إنشاء أول مدير Staging مرة واحدة فقط. |
| `provision-staging-test-team.yml` | `Provision isolated Staging test team` | `staging` | تجهيز حسابات الاختبار الفردية والمتجرين التجريبيين. |
| `staging-e2e.yml` | `Staging operational E2E` | `staging` | E2E تشغيلي اختياري بكتابة محدودة على Staging. |
| `staging-release-validation.yml` | `Staging release validation and evidence` | `staging` | Build وPlaywright وAxe وLighthouse وتقارير Artifacts. |
| `staging-backup-recovery-drill.yml` | `Staging backup and isolated recovery drill` | `staging` | نسخة R2 ببصمة SHA-256 واستعادة في Recovery DB منفصلة. |

<!-- release-workflows:end -->

## ترتيب تشغيل Staging من الهاتف

بعد رفع المصدر الكامل ونجاح `CI` على Node `22.19.0`:

```text
1. Apply Staging database migrations
2. Bootstrap first Staging platform administrator
3. Provision isolated Staging test team
4. Staging release validation and evidence
5. Staging backup and isolated recovery drill
```

لا تشغل الخطوتين 4 أو 5 قبل ضبط الدومين والخدمات الخارجية وGitHub Environment `staging`.

## ترتيب Production لاحقاً فقط

لا تبدأ هذه المرحلة قبل اكتمال جميع أدلة Staging وقرار إطلاق رسمي:

```text
1. Apply database migrations
2. Bootstrap first platform administrator (فقط عند قاعدة جديدة بلا مسؤول)
3. نشر Vercel Production عبر سياسة فرع محمي
4. Live verification
```

## قواعد الحزمة الرسمية

- يجب أن يحتوي كل إصدار مرفوع على **كل** الملفات المذكورة في الجدول.
- لا تقبل دليلاً يذكر Workflow غير موجود في هذه القائمة أو في المستودع.
- لا تضع روابط قواعد البيانات أو كلمات المرور أو مفاتيح R2/Vercel داخل أي Workflow أو Documentation.
- ملف المصدر المحلي أو ZIP لا يكفي؛ GitHub Actions تعمل على الـcommit المرفوع فعلياً.
- لا يعني وجود `apply-migrations.yml` أن migrations طبقت؛ النتيجة الحية من GitHub Actions هي الدليل.
