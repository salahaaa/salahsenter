# Deployment Guide — نشر وتحديث Mall OS

## قاعدة الإطلاق

```text
لا نشر Production قبل نجاح CI وStaging evidence وRecovery Drill والسياسة الخارجية للفرع المحمي.
```

لا تستخدم هذه الأوامر على Production:

```bash
npm run db:push
npm run db:seed
```

## Node.js وBuild

الإصدار المعتمد:

```text
Node.js 22.19.0
npm 10+
```

المصدر الرسمي:

```text
.nvmrc
package.json → engines
```

Vercel وGitHub Actions يجب أن يستخدما Node `22.19.0`.

## فحص حزمة نظيفة قبل الرفع

```bash
npm ci
npm run release:verify:source
npm run build
npm run performance:bundle
```

`release:verify:source` يشمل:

```text
paths
import case
client/server boundary
release package completeness
lint
typecheck
unit tests
migration journal
Drizzle schema check
security checks
npm audit --audit-level=high
git diff --check
```

## بيئات التشغيل

| البيئة | قاعدة البيانات | Redis/R2/Media | قاعدة التشغيل |
|---|---|---|---|
| Development | محلية أو وهمية | محلية/معطلة | `.env.example` |
| Staging | مستقلة | مستقلة وذات namespace `mall-os:staging:` | `.env.staging.example` |
| Production | مشروع مستقل لاحقاً | مستقلة وذات namespace `mall-os:production:` | `.env.production.example` |

لا تنقل أسرار أو URLs بين البيئات. Runtime Vercel يستخدم Neon **Pooled URL**، بينما migrations وRecovery workflows تستخدم Neon **Direct/Unpooled URL** فقط.

## ترتيب Staging

راجع الكتالوج الرسمي:

```text
docs/RELEASE_WORKFLOW_CATALOG_2026-07-23_AR.md
```

الترتيب:

```text
CI
→ Apply Staging database migrations
→ Bootstrap first Staging platform administrator
→ Provision isolated Staging test team
→ Staging release validation and evidence
→ Staging backup and isolated recovery drill
```

لا تشغل workflow قبل وجود source حديث مرفوع وGitHub Environment `staging` مضبوط.

## Production لاحقاً

Production ليس امتداداً مباشراً لـ Staging. قبل النشر الفعلي يجب:

1. إنشاء Neon/Redis/R2/Cloudinary/Payment/ERP Production مستقلة.
2. إعداد GitHub Environment `production` وأسراره المنفصلة.
3. تفعيل GitHub Branch Protection وRequired Status Checks.
4. منع Vercel من نشر Production من فرع غير محمي.
5. نجاح Staging browser/load/recovery evidence.
6. أخذ backup موثق.
7. تشغيل `Apply database migrations` في GitHub Environment `production` فقط.

## أول Administrator

لا توجد بيانات دخول افتراضية. إنشاء أول مسؤول يتم مرة واحدة فقط:

```text
Bootstrap first Staging platform administrator
```

أو لاحقاً:

```text
Bootstrap first platform administrator
```

كل التفاصيل الهاتفية والأسرار المطلوبة موثقة في:

```text
docs/GITHUB_ACTIONS_FIRST_ADMIN_BOOTSTRAP_FROM_PHONE_2026-07-20_AR.md
```

## التحديث والـRollback

راجع:

```text
docs/UPGRADE_GUIDE_2026-07-23_AR.md
```

لا تحذف migration تاريخية. استخدم migration أمامية أو Recovery plan معتمدة ومختبرة في قاعدة Recovery منفصلة.
