# GitHub + Vercel Ready Checklist

## 1. حزمة المصدر النظيفة

- [ ] لا يوجد `.env` أو credentials في Git.
- [ ] لا يوجد `node_modules` أو `.next` أو `coverage` في Git.
- [ ] توجد الملفات الثلاثة المحدثة:

```text
.env.example
.env.staging.example
.env.production.example
```

- [ ] يوجد كل ما في:

```text
docs/RELEASE_WORKFLOW_CATALOG_2026-07-23_AR.md
```

- [ ] Node.js المعتمد هو:

```text
22.19.0
```

## 2. Clean Clone Gate

نفذ على clone نظيف أو GitHub Actions:

```bash
npm ci
npm run release:verify:source
npm run build
npm run performance:bundle
```

لا تستخدم `npm install` بدلاً من `npm ci` للتحقق من حزمة الإصدار، لأنه قد يغير lockfile أو يحل اعتمادات مختلفة.

## 3. GitHub

- [ ] ارفع المصدر الكامل بما فيه `.github/workflows/` و`drizzle/meta/_journal.json`.
- [ ] تأكد أن `CI` و`Security Pipeline` نجحا على الـcommit نفسه.
- [ ] أنشئ GitHub Environment باسم `staging` قبل أي workflow تشغيلي.
- [ ] لا تضع Database URLs أو R2 keys أو كلمات مرور في Actions inputs.
- [ ] استخدم GitHub Environment Secrets وVariables فقط.
- [ ] فعّل Branch Protection على `main` قبل Production، مع Required Status Checks.

## 4. Vercel Staging

استخدم مشروع Vercel أو Custom Environment منفصل لـ Staging، مع:

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

المتغيرات الفعلية الكاملة موثقة في:

```text
.env.staging.example
```

المتطلبات:

```text
DATABASE_URL                    → Neon pooled Staging URL في Vercel runtime
DATABASE_POOLER_ENABLED=true
DB_POOL_MAX=3
UPSTASH_REDIS_REST_URL/TOKEN    → Redis Staging مستقلة
PRIVATE_DOCUMENTS_R2_*          → R2 Staging private bucket
BACKUP_S3_*                     → R2 Staging backup bucket
NEXT_PUBLIC_APP_URL             → https://staging.<domain>
```

## 5. Database Workflows

لا تشغل migrations من Vercel runtime. من GitHub Actions فقط:

```text
Staging:
Apply Staging database migrations

Production لاحقاً:
Apply database migrations
```

كلاهما يحتاج Neon **Direct/Unpooled URL** في GitHub Environment Secret، وليس pooled URL.

## 6. أول Administrator وفريق QA

بعد migrations في Staging:

```text
Bootstrap first Staging platform administrator
Provision isolated Staging test team
```

لا توجد كلمات مرور افتراضية، ولا تشارك حساب `super_admin` بين أعضاء الفريق.

## 7. Staging Evidence

قبل أي قرار Production:

```text
Staging release validation and evidence
Staging backup and isolated recovery drill
```

يجب حفظ Artifacts وعدم اعتبار وجود Workflow أو source code دليلاً على تشغيله.

## 8. Production لاحقاً فقط

- [ ] مشروع Neon Production مستقل.
- [ ] Redis/R2/Cloudinary/Payment/ERP Production مستقلة.
- [ ] Environment `production` منفصل.
- [ ] `APP_ENV=production` و`RESOURCE_NAMESPACE=mall-os:production`.
- [ ] Vercel Production Branch محمي ولا ينشر قبل Required Checks.
- [ ] لا تشغّل `db:push` أو `db:seed` أو QA fixtures على Production.

راجع أيضاً:

```text
DEPLOYMENT.md
docs/UPGRADE_GUIDE_2026-07-23_AR.md
docs/ENVIRONMENT_COMPLETION_SOURCE_IMPLEMENTATION_2026-07-23_AR.md
```
