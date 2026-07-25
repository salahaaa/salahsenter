# تقرير تنظيف وتجهيز حزمة التحميل

**التاريخ:** 14 يوليو 2026

تم تنظيف حزمة المصدر قبل التحميل مع الإبقاء على source code وmigrations وfonts المطلوبة لتوليد PDF والتوثيق و`package-lock.json`.

## محذوف من المشروع المصدر

```text
node_modules/
coverage/
.next/
.config/
.cache/
tsconfig.tsbuildinfo
build/
dist/
out/
```

هذه ملفات مولدة ويمكن استعادتها عبر:

```bash
npm ci
```

## غير محذوف

```text
package-lock.json
drizzle/meta/
assets/fonts/DejaVuSans.ttf
docs/
source code
GitHub workflows
```

خط DejaVuSans محفوظ لأنه مطلوب لتوليد PDF عربي للعقود والملاحق، وليس صورة مستوردة أو ملفاً مؤقتاً.

## ملف التحميل

```text
Yemeni Trade Center.zip
```

- حزمة source فقط، من دون `.git` أو `node_modules` أو caches.
- يجب فكها ثم تشغيل `npm ci` قبل التطوير أو الاختبار.
- لا تحتوي على مفاتيح تشغيل حية؛ تضم فقط ملفات `.env.example`.
