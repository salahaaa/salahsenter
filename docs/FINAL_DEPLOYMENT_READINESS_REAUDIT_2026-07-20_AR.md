# إعادة الفحص النهائي لجاهزية النشر

**التاريخ:** 2026-07-20  
**المصدر:** `/home/user/salahsentar22`  
**النطاق:** إعادة فحص شاملة بعد إصلاحات Build الديناميكي، Checkout متعدد المتاجر، Timeouts الرئيسية، Import casing، والتحديثات الأمنية.

## النتيجة الدقيقة

### جاهز للرفع إلى GitHub

**نعم.** اجتاز المصدر الحالي كل بوابات الجودة المحلية التالية.

### جاهز للإطلاق التشغيلي الحقيقي

**ليس مؤكداً بعد.** يلزم نجاح Build حقيقي في GitHub Actions/Vercel، تطبيق migrations على Neon Staging، وضبط Redis/Storage/Secrets واختبار Staging. لا يجوز اعتبار نجاح الفحوص المحلية بديلاً عن ذلك.

## بوابات الجودة المنفذة

| الفحص | النتيجة |
|---|---|
| `npm ci` | نجح؛ lockfile قابل للتثبيت النظيف |
| `npm run check:paths` | نجح |
| `npm run check:import-case` | نجح؛ حالة أحرف imports مطابقة لنظام الملفات |
| `npm run lint` | نجح |
| `NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck` | نجح |
| `npm test` | نجح: **67** ملف اختبار و**180** اختباراً |
| `npm run migrations:verify` | نجح: **87 SQL / 87 journal entries** |
| `npx drizzle-kit check --config=drizzle.config.ts` | نجح |
| `npm run security:verify` | نجح |
| `npm audit --audit-level=high` | **0 vulnerabilities** |
| `git diff --check` | نجح |

## Build الإنتاج المحلي

تم تشغيل:

```bash
NODE_OPTIONS='--max-old-space-size=1400' npm run build
```

النتيجة:

```text
Next.js build worker exited with code: null and signal: SIGKILL
```

بعد أكثر من 8 دقائق، من دون رسالة compile أو TypeScript أو import أو route محددة.

هذا يتوافق مع حد ذاكرة بيئة Arena المعروف، حيث يقتل النظام worker بـSIGKILL قبل إنهاء Build الكبير. لا يمثل ذلك دليلاً على خطأ مصدر محدد، لكنه أيضاً لا يثبت نجاح Build في Vercel.

**الحكم:** GitHub Actions/Vercel على Node 22 هو Build Gate النهائي.

## إصلاحات تمنع أخطاء Vercel السابقة

- Root/admin/merchant dynamic rendering مفروض لمنع static export لصفحات DB-backed.
- Build Phase Guards تمنع DB reads في Root Layout و`/_not-found` أثناء Build.
- مهلة الرئيسية `HOME_DATA_TIMEOUT_MS=5000` مع fallback آمن غير مخزن عند timeout.
- Cache موجود مسبقاً عبر Next/Redis؛ الفهارس الأساسية لمسار الرئيسية موجودة.
- Import-case checker في CI يمنع اختلاف حالة الأحرف بين Windows وLinux/Vercel.
- معالجة `brace-expansion` و`js-yaml` عبر overrides دقيقة؛ audit الكامل الآن نظيف.

## ما يجب أن يحدث خارج Arena قبل الإطلاق

1. رفع **الحزمة الكاملة الحالية** إلى GitHub `main`، وليس ترقيعاً جزئياً في GitHub UI.
2. تأكد أن GitHub Actions يستخدم Node 22 وينجح في `npm run build`.
3. أنشئ Neon Staging منفصلاً أو اعتبر قاعدة Neon الحالية Staging حتى يكتمل الاختبار.
4. طبّق migrations باستخدام Neon Direct/Unpooled URL، ولا تستخدم `db:push` أو `db:seed`.
5. ضع Neon Pooled URL في Vercel Runtime فقط:

   ```env
   DATABASE_URL=...
   DATABASE_POOLER_ENABLED=true
   DB_POOL_MAX=3
   DB_CONNECT_TIMEOUT_SECONDS=10
   HOME_DATA_TIMEOUT_MS=5000
   ```

6. Redeploy في Vercel مع تعطيل Build Cache.
7. نفذ اختبار Staging للصفحة الرئيسية، الأدمن، التاجر، Checkout متجرين، COD، تحويل يدوي، وفشل جزئي.

## لا تم تنفيذه

- لا Git commit أو Git push من بيئة Arena.
- لا اتصال أو migration على Neon أو Vercel أو Production.
- لا Redis/S3/R2 أو بوابة دفع حقيقية.
- لا تدّعَ حل Vercel حتى ينتهي Build السحابي بنجاح.
