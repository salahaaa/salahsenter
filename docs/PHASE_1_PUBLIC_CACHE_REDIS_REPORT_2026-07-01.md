# تقرير تنفيذ المرحلة الأولى — Public Cache + Redis Foundation

التاريخ: 2026-07-01

## الهدف

بدء تحويل الصفحات العامة من نمط يضرب قاعدة البيانات في كل زيارة إلى بنية Cache-first تستخدم:

- ISR على مستوى الصفحات العامة.
- `unstable_cache` على مستوى loaders.
- Redis/Upstash REST كطبقة cache وكمتطلب إنتاجي للـ rate limiting.
- فصل مسار البيانات العامة عن مسار المعاينة/الإدارة قدر الإمكان في هذه المرحلة.

## ما تم تنفيذه

### 1. Redis Foundation

أضيفت طبقة Redis موحدة:

```txt
lib/redis/client.ts
lib/redis/cache.ts
```

المزايا:

- دعم Upstash REST.
- دعم Vercel KV REST aliases.
- منع memory fallback في production عند `REDIS_REQUIRED=true`.
- السماح فقط بتجاوز Redis أثناء build/local حتى لا يتعطل `next build` بدون أسرار الإنتاج.
- JSON cache envelope مع Date reviver.
- Tag sets داخل Redis لتسهيل حذف مفاتيح الكاش المرتبطة بتاج معين.

تم تعديل:

```txt
lib/rate-limit.ts
```

بحيث:

- Redis مطلوب في production.
- memory fallback مسموح فقط خارج production أو أثناء build.

### 2. Public Cache Layer

أضيفت طبقة كاش عامة:

```txt
lib/cache/cache-tags.ts
lib/cache/public-cache.ts
lib/cache/public-home-cache.ts
lib/cache/public-store-cache.ts
lib/cache/public-product-cache.ts
lib/cache/public-wing-cache.ts
lib/cache/public-wings-cache.ts
lib/cache/public-offers-cache.ts
```

تستخدم:

- `unstable_cache`.
- Redis `cacheRememberJson`.
- Tags واضحة:
  - `public:home`
  - `public:stores`
  - `public:products`
  - `public:wings`
  - `public:offers`
  - `public:store:{slug}`
  - `public:product:{storeSlug}:{productSlug}`
  - `public:wing:{slug}`

### 3. تعديل الصفحات العامة

تمت إزالة:

```txt
force-dynamic
revalidate = 0
```

من الصفحات العامة التالية:

```txt
app/store/[slug]/page.tsx
app/store/[slug]/products/[productSlug]/page.tsx
app/wings/[slug]/page.tsx
app/offers/page.tsx
```

وتم تقوية:

```txt
app/page.tsx
app/wings/page.tsx
```

أصبحت الصفحات تستدعي cached loaders بدلاً من تنفيذ استعلامات DB مباشرة داخل الصفحة.

### 4. فصل preview عن public data loaders

أضيفت loaders منفصلة:

- public cached loaders.
- fresh preview loaders.

مثال:

```txt
getCachedPublicStorePageData
getFreshPreviewStorePageData
getCachedPublicProductPageData
getFreshPreviewProductPageData
```

حالياً preview لا يستخدم الكاش ويستدعي fresh DB read ويتحقق من صلاحيات المتجر.

> ملاحظة تنفيذية: ما زال رابط preview القديم `?preview=1` مدعوماً حتى لا تنكسر روابط لوحة التاجر. النقل الكامل إلى route مستقل للمعاينة سيكون خطوة تحسين لاحقة ضمن نفس مسار الفصل.

### 5. منع ضرب DB لتحديث viewCount داخل صفحة المنتج

تمت إزالة التحديث المباشر:

```ts
UPDATE products SET view_count = view_count + 1
```

من صفحة المنتج العامة.

السبب: هذا كان يسبب write على قاعدة البيانات مع كل زيارة منتج.

البديل في المرحلة التالية:

- Queue/background analytics job.
- أو Redis counters مع flush دوري.

### 6. Cache invalidation أولي للعمليات المؤثرة

تم ربط invalidation أولي مع بعض أهم عمليات التعديل:

```txt
app/api/admin/stores/[id]/route.ts
app/api/admin/wings/route.ts
app/api/admin/wings/[id]/route.ts
app/api/admin/store-offers/[id]/status/route.ts
app/api/merchant/products/route.ts
app/api/merchant/products/[id]/route.ts
app/api/merchant/store-media/route.ts
app/api/merchant/offers/route.ts
```

الآلية:

- `revalidateTag`
- `revalidatePath`
- حذف Redis keys المرتبطة بالـ tags.

### 7. تحديث متغيرات البيئة

تم تحديث:

```txt
.env.example
```

بإضافة:

```env
REDIS_REQUIRED="true"
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
# KV_REST_API_URL=""
# KV_REST_API_TOKEN=""
```

## نتائج التحقق

تم تشغيل:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

النتائج:

- Lint: ناجح.
- TypeScript: ناجح.
- Tests: ناجحة — 2 ملفات / 6 اختبارات.
- Production build: ناجح.

## ملاحظات مهمة

1. بعض الصفحات العامة قد تظهر في تقرير Next كـ dynamic بسبب طبيعة dynamic routes أو وجود fallback/preview support، لكن تم إزالة `force-dynamic` و `revalidate=0` ونقل الاستعلامات إلى cached loaders.
2. Redis REST عبر POST قد يجعل بعض أجزاء render غير static تماماً في تقرير Next، لكن طبقة البيانات نفسها أصبحت cache-first ولا تضرب DB بعد warmup.
3. النقل الكامل للمعاينة إلى routes مستقلة مثل `/preview/store/...` سيجعل الفصل أنظف أكثر ويقلل احتمالية dynamic rendering في الصفحات العامة.
4. cache invalidation تم تطبيقه على المسارات الأساسية، وتبقى مرحلة لاحقة لتوحيد كل admin/home/news/banner mutation routes على helper واحد.

## الخطوة التالية المقترحة

الانتقال إلى المرحلة الثانية:

**Atomic Inventory System + Idempotency**

وسيتم فيها:

- إضافة idempotency keys.
- atomic stock reservation داخل transaction.
- conditional update لمنع overselling.
- منع الخصم المزدوج.
- تجهيز اختبارات تزامن للمخزون.
