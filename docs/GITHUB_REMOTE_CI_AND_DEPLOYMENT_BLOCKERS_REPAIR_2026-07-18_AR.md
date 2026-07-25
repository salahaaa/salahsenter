# إصلاح عوائق GitHub CI والنشر المكتشفة في المستودع البعيد

**تاريخ الفحص:** 2026-07-18  
**المستودع المفحوص:** `salahaaa/salahsentar22`  
**آخر commit مفحوص:** `d8d6a4a5aec8e22d85993eab800c72f6c0f742b0`

## ما تم التحقق منه في GitHub

- المستودع العام متاح ويحتوي على 5 فروع.
- أحدث CI رقم 60 فشل قبل lint/typecheck/build.
- خطوة الفشل الأولى:

```text
Safe paths check
Process completed with exit code 1
```

- سببها المباشر: `ci.yml` يستدعي:

```bash
npm run check:paths
```

بينما `package.json` الموجود في GitHub لا يملك script باسم `check:paths`.

- Security Pipeline فشل كذلك لأن workflow يستدعي:

```bash
npm run security:verify
```

وهذا script غير موجود في `package.json` البعيد.

## سبب عدم الوصول إلى build فعلياً

CI توقف عند Safe paths check، لذلك الخطوات التالية كانت skipped:

```text
Lint
Typecheck
Migrations verify
Drizzle check
Tests
Build
Bundle report
```

لا يمكن اعتبار هذا build failure حقيقياً بعد؛ لم يصل workflow إلى build أصلاً.

## مشكلة إضافية في آخر تعديل بعيد

النسخة البعيدة تحتوي على عدم توافق بين:

```text
lib/db/index.ts
lib/backup.ts
```

حيث `lib/db/index.ts` في GitHub يصدر `db` فقط باستخدام Neon، بينما `lib/backup.ts` يستورد `client` أيضاً. هذا مرشح قوي لفشل TypeScript/Vercel بعد تجاوز خطوة CI الأولى.

## الإصلاح المجهز في المصدر المحلي المحدث

الحزمة المحلية الحالية تعيد الاتساق بين طبقة DB والنسخ الاحتياطي، وتحتوي على:

```text
package.json:
- check:paths
- typecheck
- migrations:verify
- security:secrets
- security:verify
- security:admin-guards
- اختبارات E2E/fixtures/backup/reliability/a11y

lib/db/index.ts:
- db
- client

lib/backup.ts:
- يستخدم client المتوافق لعمليات SQL/backup
```

كما تم تحديث GitHub Actions إلى:

```text
Node.js 22
CodeQL v4
```

بدلاً من Node 20 المتوقف تحذيرياً وCodeQL v3.

## حالة المصدر المحلي بعد الإصلاح

```text
✅ npm run check:paths
✅ npm run lint
✅ npm run typecheck
✅ npm test: 62 ملفاً / 169 اختباراً
✅ migrations: 85 SQL / 85 journal entries
✅ drizzle-kit check
✅ security verify
✅ git diff --check
```

## ما يجب رفعه

ارفع المصدر الكامل الحالي، وبالأخص لا تنس:

```text
package.json
package-lock.json
lib/db/index.ts
lib/backup.ts
.github/workflows/ci.yml
.github/workflows/security.yml
.github/workflows/apply-migrations.yml
scripts/check-ascii-paths.mjs
scripts/security/*
drizzle/*
drizzle/meta/_journal.json
```

## إصلاح خطأ Vercel الحالي للعروض

ظهر في Vercel:

```text
column store_offer_collections.publication_target does not exist
```

لا تُحذف الاستعلامات، لأنها جزء من دورة نشر العروض الجديدة. أضيفت migration إصلاحية idempotent تضيف حقول نشر العروض المتوافقة إن كانت migration الأصلية لم تطبق أو حدث drift:

```text
publication_target
publication_state
offer_product_id
offer_variant_id
review_requested_at
storefront_published_at
homepage_approved_at
```

بعد رفع الكود، طبّق migration history عبر workflow المقفل. إذا كانت قاعدة Vercel تعرض الخطأ الآن، فالمشكلة هي أن قاعدة البيانات متأخرة عن الكود، لا أن الاستعلامات يجب حذفها.

## ما بعد الرفع

1. ادفع التحديث إلى branch منفصل.
2. افتح Pull Request.
3. تحقق أن CI تتجاوز `Safe paths check`.
4. تحقق من lint/typecheck/tests/build.
5. راقب CodeQL v4؛ إذا بقي الفشل، افتح raw logs من GitHub لأن API العامة لا تعرض نص Analyze الكامل.
6. بعد CI فقط أعد تشغيل Vercel deployment.

## حدود هذا الفحص

- لم يتم push مباشر للمستودع، لأن remote المحلي لم يكن مربوطاً ولا توجد بيانات اعتماد GitHub في البيئة.
- لم يتم تأكيد Vercel build جديد؛ يلزم رفع هذه النسخة أولاً.
