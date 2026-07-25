# تقرير استكمال نقاط الأولوية العالية — 2026-07-02

## 1) ما تم استكماله الآن
تم تنفيذ مجموعة من نقاط Production Hardening ذات الأولوية العالية التي يمكن إنجازها برمجياً بدون مفاتيح خدمات خارجية.

---

## 2) حماية Cron/Worker في الإنتاج

### المنفذ
أضيف ملف مركزي:

```txt
lib/cron/auth.ts
```

وتم تحديث:

```txt
app/api/cron/jobs/process/route.ts
app/api/cron/contracts/check-expiry/route.ts
```

### النتيجة
- في الإنتاج إذا لم يوجد `CRON_SECRET` فلن تعمل endpoints الخاصة بالـ cron.
- يتم قبول:
  - `Authorization: Bearer <CRON_SECRET>`
  - أو `x-cron-secret: <CRON_SECRET>`
- المقارنة تتم بـ `timingSafeEqual` لتقليل مخاطر timing attacks.

### Vercel Cron
تم تحديث:

```txt
vercel.json
```

ليعمل:

```txt
/api/cron/jobs/process?limit=50    كل 5 دقائق
/api/cron/contracts/check-expiry   يومياً 05:00
```

---

## 3) Sentry / Monitoring foundation

تمت إضافة ملفات Sentry اختيارية لا تعمل إلا إذا وُجد DSN:

```txt
instrumentation.ts
instrumentation-client.ts
sentry.server.config.ts
sentry.edge.config.ts
```

وتم تحديث:

```txt
next.config.mjs
```

### ملاحظة مهمة
تم جعل Sentry client يتم تحميله ديناميكياً فقط عند وجود:

```txt
NEXT_PUBLIC_SENTRY_DSN
```

حتى لا يزيد حجم الواجهة في بيئة لا تستخدم Sentry.

---

## 4) Object Storage / base64 media hardening

### المشكلة القائمة
تم فحص قاعدة التجربة ووجدنا صوراً قديمة محفوظة كـ base64:

```txt
إجمالي الصفوف: 48
الحجم التقريبي: 24MB
```

تفصيل أهمها:

| المصدر | العدد | الحجم التقريبي |
|---|---:|---:|
| banners.image_url | 3 | 6.1MB |
| announcements.image_url | 1 | 2.0MB |
| store_offer_collections.image_url | 1 | 0.18MB |
| stores.cover_image_url | 2 | 0.19MB |
| wings.hero_image_url | 7 | 0.9MB |
| wings.icon_url | 5 | 4.5MB |
| products.main_image_url | 10 | 4.6MB |
| product_variants.image_url | 17 | 6.0MB |
| product_images.url | 2 | 0.34MB |

### ما تم تنفيذه
أضيف سكربت صيانة:

```txt
scripts/media/inline-media-maintenance.ts
```

مع أوامر:

```bash
npm run media:inline-audit
npm run media:inline-export
npm run media:inline-migrate
```

### استخدامه
- `media:inline-audit`: يفحص صور base64 ولا يغير شيئاً.
- `media:inline-export`: يصدر الصور كملفات لاستخدامها في ترحيل يدوي.
- `media:inline-migrate`: يرفع الصور إلى Cloudinary/S3/R2 ثم يحدث قاعدة البيانات.

> الترحيل الفعلي لم يتم الآن لأن Object Storage credentials غير متوفرة. السكربت يمنع migrate إذا لم يكن `MEDIA_PROVIDER=cloudinary/s3/r2` إلا إذا استخدمنا `--allow-local` للتجربة المحلية فقط.

---

## 5) Production readiness gate

تم تحسين:

```txt
lib/production/readiness.ts
```

وأضيف سكربت:

```txt
scripts/production-readiness-check.ts
```

مع أمر:

```bash
npm run production:readiness
```

### الفحوصات التي يغطيها الآن
- `DATABASE_URL`
- `JWT_SECRET`
- Redis
- `CRON_SECRET`
- Object Storage/CDN
- Payment Gateway
- SMS/WhatsApp/Email
- Monitoring/Sentry
- Backup target
- مخزون سالب
- تكرار idempotency
- تكرار حركات مخزون
- وظائف خلفية فاشلة
- صور base64 داخل DB

---

## 6) Backup hardening

تمت إضافة سكربت نسخ احتياطي CLI:

```txt
scripts/backup/create-json-backup.ts
```

مع أمر:

```bash
npm run backup:json
```

وظيفته:
- ينشئ نسخة JSON باستخدام النظام الحالي.
- ينشئ نسخة مضغوطة `.gz`.
- ينشئ manifest فيه:
  - الحجم.
  - sha256.
  - الجداول.
  - عدد الصفوف.

> هذا لا يغني عن backup managed في الإنتاج، لكنه يعطي أداة تشغيلية قابلة للتنفيذ خارج لوحة الأدمن.

---

## 7) معالجة npm audit

كان يوجد سابقاً:

```txt
2 moderate vulnerabilities
```

بسبب:

```txt
exceljs -> uuid
```

تمت إضافة override:

```json
"uuid": "11.1.1"
```

والنتيجة بعد `npm ci`:

```txt
found 0 vulnerabilities
```

كما تم التحقق بالأمر:

```bash
npm audit --omit=dev --audit-level=high
```

والنتيجة ناجحة.

---

## 8) ملفات البيئة للإنتاج

تمت إضافة:

```txt
.env.production.example
```

وتحديث:

```txt
.env.example
.env.team.example
```

ليشملوا:
- Redis production.
- Object Storage.
- Sentry.
- Cron secret.
- Payment providers.
- SMS/WhatsApp/Email.
- Backup settings.

---

## 9) الفحوصات المنفذة

تم تنفيذ:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm audit --omit=dev --audit-level=high
NEXT_TELEMETRY_DISABLED=1 npm run build
```

النتيجة:

| الفحص | النتيجة |
|---|---|
| npm ci | ناجح — 0 vulnerabilities |
| TypeScript | ناجح |
| ESLint | ناجح |
| Vitest | 8 اختبارات ناجحة |
| npm audit high | ناجح |
| Production build | ناجح |

---

## 10) ما لا يمكن استكماله بدون مفاتيح/قرارات خارجية

هذه النقاط تم تجهيز أساسها برمجياً، لكنها تحتاج بيانات أو خدمات فعلية:

1. تفعيل Cloudinary/S3/R2 ثم تشغيل:
   ```bash
   npm run media:inline-migrate
   ```
2. تفعيل Redis managed ثم ضبط:
   ```txt
   REDIS_REQUIRED=true
   ```
3. تفعيل Sentry DSN.
4. تفعيل SMS/WhatsApp/Email webhooks.
5. تفعيل بوابات دفع حقيقية.
6. تحديد وجهة backup دائمة وتجربة restore على قاعدة منفصلة.
7. تشغيل load tests على staging بقيم حقيقية.

---

## 11) الخلاصة
تم استكمال الجانب البرمجي من أهم نقاط الأولوية العالية:

- حماية cron.
- جدولة Vercel للوظائف.
- Sentry foundation.
- فحص وترحيل صور base64.
- readiness gate.
- backup CLI.
- audit vulnerabilities.
- env production template.

المتبقي الآن هو ربط الخدمات الخارجية وتشغيل أوامر الترحيل/الفحص على بيئة Staging/Production بعد توفير المفاتيح.
