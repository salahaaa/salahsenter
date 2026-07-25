# Upgrade Guide — التحديث الآمن للإصدار

## قاعدة لا تقبل الاستثناء

لا يحدث تحديث مباشر على Production. المسار دائماً:

```text
Source verification → GitHub CI → Staging migrations → Staging validation → Release evidence → protected Production change
```

## 1) قبل رفع أي تحديث

استخدم نسخة نظيفة من المصدر ثم نفذ:

```bash
npm ci
npm run release:verify:source
npm run build
npm run performance:bundle
```

لا تستخدم:

```bash
npm run db:push
npm run db:seed
```

على Production.

## 2) مراجعة التغييرات

يجب فحص:

```text
package-lock.json
package.json
drizzle/*.sql
drizzle/meta/_journal.json
.env.example
.env.staging.example
.env.production.example
.github/workflows/
docs/RELEASE_WORKFLOW_CATALOG_2026-07-23_AR.md
```

وأي migration جديدة يجب أن تكون موجودة في `drizzle/meta/_journal.json` في نفس التحديث.

## 3) Staging أولاً

1. ارفع source الكامل إلى GitHub.
2. تأكد من نجاح `CI`.
3. تحقق من أن جميع Workflows في كتالوج الإصدار موجودة.
4. شغل `Apply Staging database migrations` فقط على Staging.
5. راجع migrations وschema check في السجل.
6. شغل فريق QA وStaging release validation عند تجهيز الدومين والخدمات.
7. لا تقبل نتيجة «نجاح» بلا Artifact أو URL من GitHub Action.

## 4) Migration Upgrade Rules

- migration history تسلسلي ولا يعاد ترتيبه أو حذفه بعد رفعه.
- لا تنفذ SQL يدوياً في Production كبديل عن Drizzle history.
- خذ backup موثقاً قبل أي migration حقيقية.
- عند تغييرات كبيرة، جرب migration والاستعادة في Staging وRecovery DB أولاً.
- أي migration يحتاج بيانات مرجعية يجب أن يكون idempotent أو موثقاً كإجراء Staging منفصل.

## 5) Production لاحقاً

لا يتم الانتقال إلا بعد:

```text
CI green
Staging release evidence green
Backup/recovery drill green
No open critical security issue
Branch protection enabled
Production environment secrets isolated
```

ثم فقط شغل `Apply database migrations` داخل GitHub Environment `production`.

## 6) Rollback

- لا تحذف migrations التاريخية لمحاولة rollback.
- أصلح المشكلة عبر migration أمامية جديدة أو استخدم خطة استعادة معتمدة.
- الاستعادة تختبر أولاً على Recovery DB المنفصلة.
- استعادة Production تتطلب maintenance mode وapproval token؛ لا تستخدمها كتجربة.

## 7) Release Notes

ابدأ من القالب الرسمي:

```text
docs/RELEASE_NOTES_TEMPLATE.md
```

كل إصدار يجب أن يتضمن على الأقل:

```text
Commit / tag
Node.js version
Migration range
Environment template changes
Workflow changes
Security/dependency changes
Staging evidence URL
Known limitations
Rollback plan
```
