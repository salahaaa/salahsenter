# تجهيز الإطلاق الحقيقي: Redis + DB Pooler + Object Storage + Search + Monitoring — 2026-07-03

## الهدف
بعد تأكيد أن Redis production وDB pooler وObject Storage وMonitoring سيتم تجهيزها، تم تحويل المشروع برمجياً من وضع Trial إلى وضع Launch-ready، مع إضافة safeguards تمنع أخطاء الإنتاج الشائعة.

---

## 1) Upstash Redis SDK
تم تثبيت:

```bash
npm install @upstash/redis
```

وتم إنشاء:

```txt
lib/redis.ts
```

يصدر:

```ts
redis
isUpstashRedisConfigured()
```

مع تجنب تحذيرات build إذا لم تكن متغيرات Redis موجودة محلياً.

> لم يتم حفظ أي أسرار داخل الملفات. يجب وضع `UPSTASH_REDIS_REST_URL` و`UPSTASH_REDIS_REST_TOKEN` داخل Vercel Environment Variables فقط.

---

## 2) طبقة cache reusable للـ APIs الخاصة
تم إنشاء:

```txt
lib/cache/private-api-cache.ts
```

خصائصها:

- TTL قصير.
- Redis tags للإبطال الجماعي.
- `x-redis-cache` header بقيم:
  - `HIT`
  - `MISS`
  - `BYPASS`
- تشفير payload داخل Redis باستخدام AES-256-GCM إذا توفر `JWT_SECRET` أو `PRIVATE_API_CACHE_SECRET`.
- cache key عبارة عن SHA-256 حتى لا نخزن query/user identifiers بشكل واضح في Redis keys.

---

## 3) APIs التي تم تسريعها بالـ Redis cache

### 3.1 `/api/admin/wings`
- TTL: 45 ثانية.
- Tag:
  ```txt
  admin:wings
  ```
- Invalidation عند:
  - إنشاء جناح.
  - تعديل جناح.
  - تعطيل جناح.

### 3.2 `/api/merchant/products`
- TTL: 30 ثانية.
- Cache scoped حسب:
  - المستخدم.
  - المتجر.
  - الصفحة.
  - pageSize.
  - البحث.
  - الحالة.
- Tag:
  ```txt
  merchant:products:<storeId>
  ```
- Invalidation عند:
  - إنشاء منتج.
  - تعديل منتج.
  - تعديل مخزون.
  - bulk inventory update.
  - إنشاء طلب يخص المتجر.

### 3.3 `/api/admin/stores`
- TTL: 20 ثانية.
- Cache scoped حسب:
  - المستخدم الإداري.
  - الصفحة.
  - البحث.
  - الحالة.
- Tag:
  ```txt
  admin:stores
  ```
- Invalidation عند:
  - إنشاء متجر.
  - تعديل متجر.
  - إغلاق متجر.

### 3.4 `/api/merchant/inventory`
- TTL: 15 ثانية.
- Cache scoped حسب:
  - المستخدم.
  - المتجر.
  - الصفحة.
  - البحث.
- Tag:
  ```txt
  merchant:inventory:<storeId>
  ```
- Invalidation عند:
  - تعديل مخزون.
  - bulk inventory update.
  - إنشاء منتج.
  - تعديل منتج.
  - إنشاء طلب يحجز مخزون المتجر.

---

## 4) عدم تخزين بيانات حساسة داخل Redis
لأن بعض APIs إدارية/خاصة وقد تحتوي بيانات تشغيلية، تم استخدام:

- مفاتيح cache hashed.
- payload encrypted at rest داخل Redis.
- TTL قصير.
- عدم cache أي secrets أو passwords أو tokens.

---

## 5) Object Storage / Cloudinary جاهزية
تم تحديث Cloudinary provider:

```txt
lib/media/providers/cloudinary.ts
```

ليدعم طريقتين:

### الطريقة الأولى
```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### الطريقة الثانية
```env
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

> لم يتم حفظ `CLOUDINARY_URL` الحقيقي داخل المشروع.

وفي وضع الإطلاق الحقيقي:

```env
PRODUCTION_LAUNCH_MODE=true
```

يتم رفض:

```txt
MEDIA_PROVIDER=local
MEDIA_PROVIDER=inline
```

ويجب استخدام:

```txt
cloudinary / s3 / r2
```

---

## 6) DB Pooler جاهزية
تم تحديث:

```txt
lib/db/index.ts
```

يدعم:

```env
DB_POOL_MAX=3
POSTGRES_POOL_MAX=3
DB_IDLE_TIMEOUT_SECONDS=20
DB_CONNECT_TIMEOUT_SECONDS=10
DB_APPLICATION_NAME=salahsentar22-production
```

الإعداد المقترح للإطلاق على Vercel:

```env
DATABASE_URL=<pooled database url>
DB_POOL_MAX=3
```

---

## 7) Search Optimization
تم تحسين البحث:

```txt
lib/enterprise/search-engine.ts
app/api/search/smart/route.ts
app/api/search/advanced/route.ts
lib/search/fallback.ts
```

التحسينات:

- Sampling للـ search analytics:
  ```env
  SEARCH_ANALYTICS_SAMPLE_RATE=0.05
  ```
- فشل analytics لا يكسر البحث.
- في حال فشل search بسبب ضغط/DB/محرك خارجي، يتم إرجاع degraded result بدلاً من 500.

---

## 8) Checkout Production Guard
تم تحديث:

```txt
app/api/orders/route.ts
```

في وضع:

```env
PRODUCTION_LAUNCH_MODE=true
```

يصبح `Idempotency-Key` إلزامياً لإنشاء الطلب.

إذا لم يوجد يرجع:

```txt
428 Precondition Required
```

هذا يمنع duplicate orders عند الضغط المزدوج أو retry.

---

## 9) Cache hit behavior
بعد نشر هذه التعديلات على Vercel مع Redis env، يمكن التأكد من header:

```txt
x-redis-cache: MISS
x-redis-cache: HIT
x-redis-cache: BYPASS
```

التوقع:

- أول طلب: `MISS`
- الطلب التالي خلال TTL: `HIT`
- بدون Redis env محلياً: `BYPASS`
- بعد أي تعديل: يرجع `MISS` لأن tags تم إبطالها.

---

## 10) Response time قبل/بعد
لا يمكن قياس after فعلي داخل هذه البيئة لأن Redis env موجود في Vercel وليس داخل sandbox، وآخر كود لم يتم نشره بعد.

لكن نقاط القياس السابقة قبل هذه التحسينات أظهرت:

| endpoint | قبل Redis/cache hardening |
|---|---:|
| `/api/search/smart` تحت probe | 50% أخطاء في run سابق |
| `/api/search/advanced` تحت probe | 50-60% أخطاء/timeout |
| `/offers` | p95 وصل 10-15s في probe |
| `/wings` | p95 وصل 10-15s في probe |

بعد النشر يجب قياس:

```bash
BASE_URL=https://salahsentar22.vercel.app npm run load:probe
```

ومقارنة:

- p50
- p95
- p99
- error rate
- x-redis-cache

---

## 11) Payload impact
التأثير المتوقع:

- cache payloads الخاصة مشفرة ومؤقتة TTL قصير.
- لا توجد base64 جديدة داخل Redis.
- صور inline القديمة لا تُخزن في cache الخاص كنصوص خام إذا تم إرجاعها من SQL عبر proxy URL.
- search degraded fallback يمنع 500 لكنه يعيد payload صغير عند الفشل.

---

## 12) الفحوصات المنفذة
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
| Tests | 10 passed |
| Audit high | ناجح |
| Build | ناجح |

---

## 13) المطلوب الآن على Vercel

### Redis
```env
REDIS_REQUIRED=true
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

### DB Pooler
```env
DATABASE_URL=<pooled connection url>
DB_POOL_MAX=3
```

### Object Storage
```env
MEDIA_PROVIDER=cloudinary
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
NEXT_IMAGE_REMOTE_HOSTS=res.cloudinary.com
```

### Launch mode
```env
PRODUCTION_LAUNCH_MODE=true
APP_ENV=production
NEXT_PUBLIC_APP_ENV=production
SEARCH_ANALYTICS_SAMPLE_RATE=0.05
```

---

## 14) بعد النشر
نفذ:

```bash
npm run production:readiness
npm run media:inline-audit
npm run media:inline-migrate
BASE_URL=https://salahsentar22.vercel.app npm run load:probe
```

ثم افحص headers:

```bash
curl -I https://salahsentar22.vercel.app/api/admin/wings
```

مع جلسة أدمن صالحة، وتحقق من:

```txt
x-redis-cache: MISS ثم HIT
```
