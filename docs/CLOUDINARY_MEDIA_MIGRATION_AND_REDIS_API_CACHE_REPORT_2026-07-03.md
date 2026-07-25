# تقرير تحويل الصور إلى Cloudinary + Redis API Cache — 2026-07-03

## 1) ملخص تنفيذي
تم تحويل منصة الصور من **Base64 Storage** إلى **Cloudinary URL-based Media Architecture** على قاعدة البيانات المشتركة، مع منع حفظ `data:image/` في مسارات الصور مستقبلاً، وتجهيز طبقة Redis cache للـ APIs الثقيلة.

النتيجة النهائية:

```txt
Base64 media في جداول الصور/الواجهات/العقود/الطلبات: 0
Base64 media في كل أعمدة public text/varchar/jsonb بعد الفحص الشامل: 0
Cloudinary URLs غير محسنة f_auto/q_auto: 0
```

كما تم تنظيف نسخ base64 القديمة داخل `audit_logs` بالاستبدال الآمن، دون حذف سجلات التدقيق نفسها.

---

## 2) الملفات المعدلة/المضافة

### Cloudinary / Media
```txt
lib/cloudinary.ts
lib/media/providers/cloudinary.ts
lib/media/data-url.ts
lib/media/index.ts
lib/validators.ts
scripts/media/inline-media-maintenance.ts
scripts/media/redact-inline-media-audit-logs.ts
```

### Redis API Cache
```txt
lib/redis.ts
lib/cache/private-api-cache.ts
app/api/admin/wings/route.ts
app/api/admin/wings/[id]/route.ts
app/api/admin/stores/route.ts
app/api/admin/stores/[id]/route.ts
app/api/merchant/products/route.ts
app/api/merchant/products/[id]/route.ts
app/api/merchant/inventory/route.ts
app/api/merchant/inventory/bulk/route.ts
app/api/orders/route.ts
```

### Search / Launch hardening مستمر
```txt
lib/search/fallback.ts
lib/enterprise/search-engine.ts
app/api/search/smart/route.ts
app/api/search/advanced/route.ts
```

### اختبارات / Scripts / Docs
```txt
package.json
package-lock.json
docs/CLOUDINARY_MEDIA_MIGRATION_AND_REDIS_API_CACHE_REPORT_2026-07-03.md
```

---

## 3) Cloudinary Architecture

تم إنشاء:

```txt
lib/cloudinary.ts
```

ويحتوي على:

- `getCloudinaryConfig()`
- `uploadImage()`
- `deleteImage()`
- `optimizeUrl()`

يدعم طريقتين للإعداد:

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

أو:

```env
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

> لم يتم حفظ أي سر Cloudinary داخل ملفات المشروع.

---

## 4) منع حفظ Base64 مستقبلاً

تم تعديل:

```txt
lib/validators.ts
```

أي حقل صورة/رابط يستخدم `optionalUrlOrPathSchema` أو `requiredUrlOrPathSchema` لن يقبل بعد الآن:

```txt
data:image/...
```

كما أن وضع الإطلاق الحقيقي يمنع `local` و`inline`:

```env
PRODUCTION_LAUNCH_MODE=true
MEDIA_PROVIDER=cloudinary|s3|r2
```

---

## 5) Upload flow الجديد

التدفق أصبح:

```txt
Client
→ /api/media/upload
→ Cloudinary
→ optimized Cloudinary URL
→ Save URL only in DB
```

وليس:

```txt
Client
→ base64
→ DB
```

كذلك تم تعديل توقيع العقود:

```txt
app/api/merchant-applications/[id]/contract/route.ts
```

العميل ما زال يرسل توقيع canvas كـ base64، لكن السيرفر يرفعه إلى Cloudinary ويحفظ URL فقط.

---

## 6) APIs لا ترجع Base64

تم تعديل list APIs الحساسة بحيث لا ترجع `data:image/` أبداً:

### `/api/admin/wings`
يرجع الصور كـ URL فقط، وإذا وجد inline قبل الترحيل كان سيعيد:

```txt
imageUrl = null
hasInlineHeroImage = true
hasInlineIconImage = true
...
```

### `/api/merchant/products`
يرجع:

```txt
mainImageUrl = URL|null
hasInlineMainImage = boolean
```

### `/api/admin/stores`
يرجع:

```txt
coverImageUrl = URL|null
logoUrl = URL|null
hasInlineCoverImage = boolean
hasInlineLogoImage = boolean
```

بعد الترحيل الحالي كل flags يجب أن تكون false عملياً لأن base64 صار 0.

---

## 7) Migration الصور القديمة إلى Cloudinary

### قبل الترحيل
الفحص قبل الترحيل كشف:

```txt
132 قيمة/موضع media بصيغة base64
73.38MB تقريباً
```

تفصيل أهم المصادر:

| المصدر | العدد | الحجم التقريبي |
|---|---:|---:|
| banners.image_url | 5 | 9.6MB |
| announcements.image_url | 2 | 3.77MB |
| products.main_image_url | 10 | 4.63MB |
| products.images[] | 9 | 4.52MB |
| product_variants.image_url | 17 | 6.08MB |
| product_variants.images[] | 17 | 6.08MB |
| media_assets.url | 52 | 33.79MB |
| wings.icon_url | 5 | 4.59MB |
| wings.hero_image_url | 7 | 0.91MB |
| settings.homepage.welcome_popup.imageUrl | 1 | 1.72MB |
| settings.homepage.content.heroBackgroundImage | 1 | 0.46MB |

ثم بعد اكتشاف أعمدة إضافية تم ترحيل:

| المصدر | العدد |
|---|---:|
| order_items.image_url | 2 |
| order_items.product_snapshot.imageUrl | 2 |
| merchant_applications.contract_signature_data_url | 6 |
| merchant_contracts.signature_data_url | 6 |

### إجمالي ما تم رفعه إلى Cloudinary

```txt
148 قيمة/موضع media تم تحويلها إلى Cloudinary URL
```

### تنظيف audit logs
وجدنا أيضاً نسخ base64 داخل `audit_logs`:

```txt
120 صف audit_logs يحتوي base64
```

تم استبدال base64 داخلها بنصوص redacted آمنة، مع إبقاء سجلات التدقيق نفسها.

---

## 8) بعد الترحيل

### فحص media المحدد
```txt
npm run media:inline-audit
```

النتيجة:

```txt
totalRows: 0
totalApproxMb: 0
```

### فحص شامل لكل أعمدة public النصية و JSONB
تم فحص 475 عموداً من نوع:

```txt
text
varchar
jsonb
```

النتيجة:

```txt
found: []
```

أي لا يوجد `data:image/...base64` في قاعدة البيانات العامة حالياً.

### فحص Cloudinary optimization
تم فحص روابط Cloudinary غير المحسنة:

```txt
nonOptimizedCloudinaryReferences: []
```

أي أن الروابط تحتوي على:

```txt
f_auto
q_auto
```

---

## 9) Payload قبل/بعد

### قبل
كان هناك base64 داخل الجداول بحجم تقريبي:

```txt
73.38MB media base64
```

### بعد
```txt
0MB base64 في مصادر الصور
0 data:image في فحص شامل لكل أعمدة public النصية/jsonb
```

### قياس payload بعد الترحيل على استعلامات مشابهة للـ APIs

| API / Query | rows | زمن DB تقريبي | JSON payload بعد الترحيل |
|---|---:|---:|---:|
| admin/wings | 16 | 152.5ms | 7.6KB |
| admin/stores page20 | 16 | 154.3ms | 8.5KB |
| merchant/products أكبر متجر page20 | 5 | 303.3ms | 3.3KB |

> هذه قياسات query مباشرة على قاعدة staging. قياس HTTP cache HIT يحتاج نشر آخر كود على Vercel مع Redis env ثم فحص `x-redis-cache`.

---

## 10) حجم قاعدة البيانات قبل/بعد

قبل آخر تدقيق Enterprise كان حجم قاعدة البيانات تقريباً:

```txt
227MB
```

بعد ترحيل الصور وتنظيف media:

```txt
145MB
```

ملاحظة:

```txt
audit_logs ما زال حجمه الفيزيائي 123MB رغم تنظيف النصوص داخله.
```

هذا لأن PostgreSQL لا يرجع كل المساحة فوراً بدون VACUUM FULL/maintenance. البيانات نفسها نُظفت، لكن مساحة الجدول تحتاج صيانة managed لاحقاً.

---

## 11) Redis cache behavior

تم تطبيق cache على:

```txt
/api/admin/wings
/api/merchant/products
/api/admin/stores
/api/merchant/inventory
```

مع headers:

```txt
x-redis-cache: MISS
x-redis-cache: HIT
x-redis-cache: BYPASS
```

السلوك المتوقع بعد نشر آخر كود على Vercel:

1. أول طلب: `MISS`
2. الطلب الثاني خلال TTL: `HIT`
3. بعد تعديل/إضافة/حذف: invalidation ثم `MISS`
4. بدون Redis env محلياً: `BYPASS`

---

## 12) صفحات أصبحت أسرع أو أخف

المستفيد الأكبر:

- `/admin/wings`
- `/admin/stores`
- `/merchant/products`
- `/merchant/inventory`
- `/admin/ads`
- الصفحة الرئيسية `/`
- `/wings`
- `/offers`
- صفحات المنتجات والمتاجر التي كانت تعتمد على صور base64

تحسن الأداء هنا يأتي من:

- عدم سحب base64 من DB.
- تقليل SSR payload.
- استخدام Cloudinary CDN.
- Redis cache للـ APIs الثقيلة بعد النشر.

---

## 13) اختبار Probe بعد الترحيل

تم تشغيل probe خفيف على Vercel بعد ترحيل DB إلى Cloudinary.

النتائج العامة:

| endpoint | p50 | p95 | ملاحظة |
|---|---:|---:|---|
| homepage | 68ms | 1369ms | مستقر نسبياً |
| offers | 593ms | 7797ms | تحسن نسبي لكن يحتاج نشر آخر كود/Redis |
| wings | 415ms | 15001ms | متوسط أفضل لكن timeout متقطع |
| track-order | 744ms | 15001ms | timeout متقطع |
| search | ما زال فيه 500 | — | لأن آخر search fallback code لم يُنشر بعد على Vercel |
| health | 134ms | 1931ms | مستقر |

مهم: نتائج search الحالية على Vercel لا تعكس آخر كود fallback لأن التعديلات لم تُنشر بعد.

---

## 14) الفحوصات النهائية

تم تنفيذ:

```bash
npm run typecheck
npm run lint
npm test
npm audit --omit=dev --audit-level=high
NEXT_TELEMETRY_DISABLED=1 npm run build
```

النتيجة:

| الفحص | النتيجة |
|---|---|
| TypeScript | PASS |
| ESLint | PASS |
| Vitest | 10 tests PASS |
| npm audit high | 0 vulnerabilities |
| Build | PASS |

---

## 15) ملاحظات مهمة جداً

1. لا توجد أي أسرار Cloudinary محفوظة داخل ملفات المشروع.
2. تم استخدام المفاتيح مؤقتاً فقط لتنفيذ الترحيل ثم حذف ملفات البيئة المؤقتة.
3. يجب إعادة نشر Vercel ليعمل آخر كود:
   - Redis private API cache.
   - Search degraded fallback.
   - Object Storage enforcement.
   - No-base64 validators.
4. يفضل تنفيذ maintenance على PostgreSQL لاحقاً لاسترجاع مساحة `audit_logs` الفيزيائية.

---

## 16) التوصيات القادمة

### قبل الإطلاق
1. تأكد في Vercel من:
   ```env
   MEDIA_PROVIDER=cloudinary
   REDIS_REQUIRED=true
   PRODUCTION_LAUNCH_MODE=true
   DB_POOL_MAX=3
   SEARCH_ANALYTICS_SAMPLE_RATE=0.05
   ```
2. أعد نشر Vercel.
3. شغّل:
   ```bash
   npm run production:readiness
   BASE_URL=https://salahsentar22.vercel.app npm run load:probe
   ```
4. افحص headers للـ APIs المحمية بعد تسجيل الدخول:
   ```txt
   x-redis-cache: MISS ثم HIT
   ```
5. فعّل Sentry DSN لمراقبة أي 500.
6. اطلب من مزود PostgreSQL تنفيذ maintenance/VACUUM على `audit_logs` إن أردت استرجاع المساحة الفيزيائية فوراً.

### بعد الإطلاق
- نقل search إلى Meilisearch/Typesense إذا زاد الضغط.
- تشغيل k6 الحقيقي على staging مع جلسات admin/merchant/customer.
- مراقبة Redis memory/hit-rate.
- مراقبة DB connections عبر pooler.
