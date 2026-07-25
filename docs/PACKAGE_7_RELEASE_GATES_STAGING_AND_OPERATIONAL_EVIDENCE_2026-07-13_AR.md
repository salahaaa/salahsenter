# تقرير الحزمة 7 — بوابات الإطلاق وStaging والأدلة التشغيلية

## جداول جديدة

```text
operational_drills
release_gate_runs
```

تسجل بدليل دائم:

- Staging E2E.
- Backup recovery drill.
- Load probe.
- Security gate.
- ERP pilot.
- readiness score وفحوصات كل لقطة Release Gate.

## واجهة وإدارة الأدلة

تمت إضافة:

```text
/admin/release-gates
/api/admin/operations/release-gates
components/admin/release-gate-panel.tsx
```

تعرض الواجهة:

- نتيجة `getProductionReadiness()` الحالية.
- عناصر الخطر والتحذير.
- حفظ Evidence Snapshot دون تنفيذ نشر.
- تسجيل نتيجة drill مع البيئة والدليل.
- آخر بوابات الإطلاق المحفوظة.

> تسجيل drill لا يدعي نجاحاً خارجياً؛ على المشغل إرفاق/توثيق دليل Staging حقيقي قبل اعتباره اعتماداً تشغيلياً.

## GitHub Actions

تمت إضافة workflow يدوي محمي:

```text
.github/workflows/staging-e2e.yml
```

- يتطلب كتابة `RUN_STAGING_E2E` صراحة.
- يعمل داخل GitHub Environment باسم `staging`.
- يستخدم أسرار Staging منفصلة فقط.
- يشغل migration verification وE2E platform وHTTP regression اختيارياً وreliability verification.
- لا يعمل على production تلقائياً.

## قائمة تشغيل الإطلاق المكتملة في الكود

| البند | الحالة البرمجية |
|---|---|
| فحوص lint/type/test/security/migration | موجودة ومتصلة بـ CI |
| E2E كتابة على staging | موجود ومحظور دائماً في production |
| HTTP regression staging | موجود |
| نسخة احتياطية واستعادة على قاعدة معزولة | scripts موجودة مع حماية تمنع تطابق production |
| Cron للنسخ/الإقفال/التكامل/التقارير | موجود في `vercel.json` |
| readiness/security deployment gate | موجود |
| سجل evidence للـ drills وrelease gate | أضيف في هذه الحزمة |

## مهام خارج Arena لا يجوز الادعاء بإنجازها

1. تطبيق migrations حتى `0061` على قاعدة Staging ثم Production من Workflow المخصص.
2. ضبط أسرار Production/Staging: DB، Redis، Object Storage، Cron، Sentry، بريد/رسائل.
3. ربط domain وSSL والتحقق من DNS على Vercel/Cloudflare.
4. تشغيل E2E الفعلي على Staging مع أسرار حسابات تجريبية.
5. تشغيل `backup:recovery-test` على قاعدة Recovery معزولة.
6. Load probe من URL Staging حقيقي.
7. اختبار هاتف Android وشبكة يمنية فعلية.
8. اختيار ERP واحد وتشغيل Pilot مع Agent/Sandbox.
9. تأكيد `next build` في GitHub Actions/Vercel؛ لم يشغل هنا بسبب حد ذاكرة Arena.
10. تنفيذ PostgreSQL RLS أو استراتيجية DB isolation قبل ادعاء Tenant isolation كامل.

## التحقق المحلي

```text
npm run lint                                      PASS
NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck   PASS
npm test                                          PASS — 38 ملفات / 107 اختبار
npm run migrations:verify                         PASS — 62 SQL / 62 journal entries
npx drizzle-kit check                             PASS
npm run security:verify                           PASS
git diff --check                                  PASS
```
