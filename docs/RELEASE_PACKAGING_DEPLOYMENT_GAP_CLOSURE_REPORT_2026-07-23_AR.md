# تقرير إغلاق فجوات Release Packaging وGitHub/Vercel

**التاريخ:** 23 يوليو 2026  
**النوع:** معالجة مصدر وتوثيق وCI محلياً. لا يثبت هذا التقرير أن GitHub remote أو Neon أو Vercel تم تحديثها فعلياً.

## الملخص التنفيذي

تمت معالجة الأسباب التنظيمية والتقنية التي تجعل إصداراً صالحاً في المصدر يفشل عند الرفع أو النشر:

```text
Workflow مفقود أو دليل يشير إلى ملف غير موجود
Node version غير موحد
Client Component يصل بشكل مباشر أو غير مباشر إلى Server/DB code
حزمة مصدر لا تحتوي كل الملفات الرسمية
توثيق قديم لا يطابق Staging/Production الحالية
Security Workflow يفشل على Fork بسبب صلاحيات كتابة غير متاحة
```

أصبحت الحزمة تملك بوابة مصدر جديدة:

```bash
npm run release:verify:source
```

وتتحقق من paths وimport casing وClient/Server boundary وWorkflow package وlint وTypeScript وtests وDrizzle وsecurity وaudit وgit diff.

بوابة البناء الكاملة هي:

```bash
npm run release:verify
```

وتضيف `next build` وbundle budget؛ هذه تعمل في GitHub CI على Node `22.19.0`، وليس من الصحيح اعتماد Arena كحكم build نهائي بسبب حد الذاكرة فيها.

## مطابقة المشكلات الواردة بالحالة الحالية

| البند | المعالجة في المصدر | ما لا يزال يحتاج تنفيذاً خارجياً |
|---|---|---|
| Bootstrap first admin مفقود | الملف موجود: `bootstrap-first-admin.yml`، ومعه Staging counterpart | رفع المصدر الحالي إلى GitHub ثم تشغيله على قاعدة مقصودة فقط |
| دليل يذكر Workflows غير موجودة | أضيف كتالوج workflow رسمي وchecker يطابق الأسماء والملفات | التأكد من أن remote يحتوي نفس commit |
| Workflows غير مكتملة | manifest يفرض وجود كل 10 Workflows الحالية ويمنع وجود Workflow غير موثق | GitHub Environments/Secrets/Branch Protection |
| Schema/DB mismatch | `migrations:verify` و`drizzle-kit check` داخل Release Gate | تطبيق migrations والتحقق على Neon Staging؛ لا يوجد اتصال حي هنا |
| ترتيب migrations | 88 SQL و88 journal entries، وUpgrade Guide يمنع حذف/ترتيب history | تشغيل migration حقيقي على Staging أولاً |
| Server code داخل Client | أضيف graph checker؛ كشف مشكلة فعلية وأصلحها | GitHub CI/Vercel build على Node 22.19 هو الاختبار النهائي |
| Build/import/typo errors | CI يشغل import case + lint + typecheck + build | remote CI لم يُشغّل بعد على هذه النسخة |
| Node/Build/Vercel settings | Node موحد في `.nvmrc` و`engines` وكل Workflows | ضبط Node 22.19 في Vercel project الفعلي |
| Environment variables غير واضحة | `.env.example` و`.env.staging.example` و`.env.production.example` + checklist | إدخال الأسرار الحقيقية في GitHub/Vercel فقط |
| Security workflow permissions | Read-only default + job permissions + CodeQL لا يفشل على fork | تفعيل GitHub Advanced Security/CodeQL حسب خطة الحساب |
| Release quality gate | `release:verify:source` و`release:verify` وStaging evidence workflow | Branch Protection وربط Vercel production policy |
| Release Notes | أضيف `docs/RELEASE_NOTES_TEMPLATE.md` | إنشاء release notes فعلية لكل tag/commit لاحقاً |
| Clean clone | `npm ci` إلزامي في CI وضمن الوثائق | GitHub CI على commit المرفوع هو دليل clean clone الحقيقي |

## إصلاح Server/Client المكتشف

أظهر الفحص الجديد مساراً حقيقياً غير صحيح:

```text
app/forgot-store-credentials/page.tsx (use client)
→ components/layout/auth-shell.tsx
→ lib/home-content.ts
→ lib/db
```

هذا كان قد يسحب Drizzle/Server code إلى Client build.

الإصلاح:

```text
page أصبح Server Component
ForgotStoreCredentialsForm أصبح Client Component منفصلاً
AuthShell بقي Server Component ويقرأ Home Content من DB بأمان
```

وأضيف:

```text
scripts/check-client-server-boundaries.mjs
npm run check:client-boundaries
```

يفحص 195 Client entry points ويتتبع imports النسبية و`@/` ويمنع الوصول إلى:

```text
node:fs / fs
net
tls
perf_hooks
next/headers
next/server
next/cache
postgres
drizzle-orm/postgres-js
@/lib/db
@/lib/backup
@/lib/redis
server-only
use server
```

## Workflow Packaging Gate

أضيف:

```text
config/release-package-manifest.json
scripts/verify-release-package.mjs
docs/RELEASE_WORKFLOW_CATALOG_2026-07-23_AR.md
```

التحقق يرفض الحزمة إذا:

- غاب أي Workflow رسمي.
- ظهر Workflow جديد غير مضاف إلى manifest والكتالوج.
- اختلف اسم Workflow عن الاسم الموثق.
- غاب README أو DEPLOYMENT أو Upgrade Guide أو Release Notes template.
- غاب أحد Environment templates المطلوبة.
- لم يتطابق Node في `.nvmrc` مع manifest.

## Node.js المعتمد

```text
Node.js 22.19.0
npm 10+
```

تم توحيده في:

```text
.nvmrc
package.json engines
جميع ملفات GitHub Actions
```

ظهور تحذير `EBADENGINE` داخل Arena طبيعي لأن Arena تعمل حالياً على Node 20؛ لا يمثل فشل المصدر. Lighthouse الحديثة تحتاج Node 22.19، وCI/Vercel هما بيئة الإصدار المعتمدة.

## Security Workflow

تم تعديل:

```text
.github/workflows/security.yml
```

ليكون:

```text
Default permissions: contents: read
Dependency/secret scan: read only
Dependency review: contents/pull-requests read
CodeQL: security-events write فقط في push/schedule/internal PR
Fork PR: read-only checks تعمل، CodeQL upload يُتجاوز بدلاً من إسقاط Security Pipeline
```

## التوثيق المحدث

```text
README.md
DEPLOYMENT.md
docs/GITHUB_VERCEL_READY_CHECKLIST.md
docs/UPGRADE_GUIDE_2026-07-23_AR.md
docs/RELEASE_WORKFLOW_CATALOG_2026-07-23_AR.md
docs/RELEASE_NOTES_TEMPLATE.md
```

## الملفات ذات الحساسية المذكورة في التقرير

| الملف | النتيجة المصدرية الحالية |
|---|---|
| `lib/db/schema.ts` | يحتوي schema الحالي، وDrizzle static check ناجح؛ لا يمكن ادعاء تطابق قاعدة Neon الحية قبل migrations Staging. |
| `drizzle.config.ts` | `drizzle-kit check` ناجح محلياً. |
| `lib/home-content.ts` | Server module؛ لم يعد reachable من Client graph بعد فصل صفحة استعادة بيانات المتجر. |
| `components/layout/auth-shell.tsx` | Server Component صحيح؛ يستخدم من صفحات Server فقط. |
| `.github/workflows/ci.yml` | أضيف له client/server gate وrelease package gate وNode 22.19. |
| `.github/workflows/security.yml` | عزل صلاحيات jobs وتحمل fork PRs. |
| `apply-migrations.yml` | موجود في manifest، Node موحد، ويبقى Production-only workflow. |
| `drizzle/*.sql` وjournal | 88/88 متطابقة محلياً. |

## ما لا يمكن حسمه من المصدر

هذه بنود تشغيلية وليست أخطاء يمكن إصلاحها بملف TypeScript فقط:

```text
- هل GitHub remote يحتوي هذه النسخة؟ غير مثبت حتى الرفع.
- هل CI الحقيقي وVercel build نجحا؟ غير مثبت حتى التشغيل.
- هل Neon schema الحية مطابقة؟ غير مثبت حتى Staging migration/check.
- هل Vercel environment variables صحيحة؟ غير مثبت حتى ضبطها خارجياً.
- هل DNS/staging domain/Redis/R2/Payment/ERP تعمل؟ غير مثبت حتى التجربة الحية.
- هل Branch Protection يمنع Production فعلاً؟ إعداد GitHub خارجي مطلوب.
```

## نتائج التحقق المحلي

```text
npm run release:verify:source                  ✅
Client/server entries checked                  ✅ 195 entries
Release package manifest/catalog                ✅
Unit tests                                      ✅ 73 files / 200 tests
Migration journal                               ✅ 88 SQL / 88 journal entries
Drizzle schema check                            ✅
Security verification                           ✅
npm audit --audit-level=high                   ✅ 0 vulnerabilities
git diff --check                                ✅
```

## النتيجة

```text
جاهزية مصدر للإصدار/الرفع إلى GitHub: نعم
جاهزية GitHub remote/CI/Vercel الفعلية: غير مثبتة بعد
جاهزية Neon Staging الحية: غير مثبتة بعد
جاهزية Production التشغيلية: لا
```
