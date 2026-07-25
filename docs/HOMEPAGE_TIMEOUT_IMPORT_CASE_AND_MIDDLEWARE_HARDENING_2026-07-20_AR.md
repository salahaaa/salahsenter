# تقرير تقوية مهلة الرئيسية وحالة أحرف Imports والـMiddleware

**التاريخ:** 2026-07-20

## نتائج التحقق من البلاغ

### الرئيسية و504

كان لدى الرئيسية Cache فعلياً عبر:

```text
getCachedHomeData
cachedJson
unstable_cache
Redis cache
```

وكانت فهارس الجداول الرئيسية موجودة مسبقاً (`banners`, `announcements`, `news`, `home_sections`, `products`, `stores`, `ad_campaigns`). لكن لم تكن هناك مهلة مستقلة لمسار جلب الرئيسية؛ لذلك قد يبقى miss بطيء في DB منتظراً حتى تنتهي مهلة المنصة.

### Middleware

`middleware.ts` لا يستورد Drizzle أو `@/lib/db` أو `postgres` ولا ينفذ استعلام PostgreSQL. يحتوي فقط على JWT وCSRF وCSP وطلب Redis للمراقبة داخل `event.waitUntil` مع catch غير حاجب.

### Import casing

لم توجد آلية CI مخصصة لمطابقة حالة أحرف مسارات imports مع أسماء الملفات. هذا مهم لأن نظام Windows قد يقبل مساراً خاطئاً في الحالة بينما Linux/Vercel يرفضه.

## الإصلاحات المنفذة

### 1. ميزانية قراءة الرئيسية

أضيف:

```text
HOME_DATA_TIMEOUT_MS=5000
```

في:

```text
.env.example
.env.production.example
```

وأضيفت مهلة بين 1 و10 ثوانٍ حول loader الخاص بالرئيسية.

عند تجاوز 5 ثوانٍ افتراضياً:

```text
لا ينتظر الطلب حتى 504
→ يعيد fallback منظم للرئيسية
→ لا يخزن fallback الناتج عن timeout في Redis/Next cache
```

هذا يمنع تثبيت حالة DB بطيئة داخل الكاش لمدة TTL كاملة.

### 2. fallback مركزي للرئيسية

أضيف:

```text
getHomeDataFallback()
```

في `lib/db/queries.ts`، ويستخدم عند عدم وجود DB أو عند فشل القراءة أو عند تجاوز ميزانية القراءة.

### 3. فحص حالة أحرف imports

أضيف:

```text
scripts/check-import-path-casing.mjs
```

ويتحقق من:

- imports النسبية.
- imports التي تستخدم alias `@/`.
- مطابقة كل segment في المسار مع الاسم الفعلي على filesystem.

أضيف script:

```bash
npm run check:import-case
```

ورُبط في GitHub Actions قبل lint/build.

### 4. الاعتمادات الأمنية

ظهر أثناء التحقق `brace-expansion` قديم عبر `glob` و`exceljs`. بعد فحص سلسلة الاعتماد أضيفت overrides دقيقة ومتوافقة:

```text
minimatch 3 → brace-expansion 1.1.16
minimatch 5 → brace-expansion 2.1.2
minimatch 10 → brace-expansion 5.0.7
js-yaml → 4.3.0
```

بدون `npm audit fix --force` أو تحديثات كبرى عشوائية. النتيجة النهائية:

```text
npm audit --audit-level=high
→ found 0 vulnerabilities

npm audit --omit=dev --audit-level=high
→ found 0 vulnerabilities
```

## الفهارس

لم تضف فهارس جديدة عشوائياً، لأن الفهارس الأساسية لمسار الرئيسية موجودة في migrations. إضافة فهرس جديد يجب أن تبنى على `EXPLAIN ANALYZE` من Neon Staging أو بيانات مراقبة فعلية، لا على التخمين.

## تحقق

- `npm run check:paths` ✅
- `npm run check:import-case` ✅
- `npm run lint` ✅
- TypeScript ✅
- اختبارات الوحدة ✅
- migrations وDrizzle ✅
- security verification ✅
- لا DB داخل middleware ✅

## إعداد Vercel المطلوب

في Vercel، استخدم رابط Neon pooled فقط في:

```env
DATABASE_URL=postgresql://...pooler...sslmode=require
DATABASE_POOLER_ENABLED=true
DB_POOL_MAX=3
DB_CONNECT_TIMEOUT_SECONDS=10
HOME_DATA_TIMEOUT_MS=5000
```

لا يمكن لهذا الإعداد إصلاح schema غير مطبق أو قاعدة Neon فارغة؛ يجب تطبيق migrations على Staging قبل توجيه Runtime إليها.
