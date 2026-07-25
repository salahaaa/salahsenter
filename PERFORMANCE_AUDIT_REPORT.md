# تقرير فحص وتحسين الأداء — Performance & Payload Optimization Audit

**المنصة:** Enterprise Multi-Vendor Marketplace · Next.js 15 + Drizzle ORM + PostgreSQL
**تاريخ الفحص:** 2026-06-29
**النطاق:** 6 واجهات برمجية (List APIs) — Phase 1

---

## 📊 ملخص النتائج (Executive Summary)

تم تطبيق تحسينات جذرية على 6 واجهات برمجية مع **الحفاظ الكامل على منطق العمل** وبدون أي تغيير في مخطط قاعدة البيانات.

### الأثر الكمي الإجمالي

| المؤشر | قبل | بعد | التحسن |
|--------|-----|-----|--------|
| **إجمالي حجم الـ payload** | **4,527 KB** | **24.4 KB** | **↓ 99.5%** |
| **صور base64 مضمّنة** | 78 صورة | **0** | **↓ 100%** |
| **واجهات بلا pagination** | 6 من 6 | **0** | ✓ كامل |
| **واجهات بلا بحث/فلترة** | 6 من 6 | **0** | ✓ كامل |
| **استخدام `select()` غير محدد** | 5 واجهات | **0** | ✓ كامل |
| زمن الاستجابة (products) | 153–608ms | **95–109ms** | ↓ حتى 6× أسرع |

---

## 🔍 القياسات التفصيلية — قبل / بعد

تم القياس على بيئة حقيقية مع بيانات اختبار واقعية (صور base64 بحجم 60KB لكل حقل، 12 منتج، 13 جناح، 5 طلبات، 3 طلبات متاجر موقّعة).

| # | الواجهة | الحجم قبل | الحجم بعد | النسبة | base64 قبل | base64 بعد | زمن الاستجابة |
|---|---------|-----------|-----------|--------|------------|------------|---------------|
| 1 | `merchant/products` | **2,852 KB** | 7.8 KB | ↓ 99.7% | 48 | 0 | 608→109ms |
| 2 | `admin/wings` | **1,436 KB** | 10.4 KB | ↓ 99.3% | 24 | 0 | 2215→1290ms* |
| 3 | `admin/stores` | 177 KB | 0.8 KB | ↓ 99.5% | 3 | 0 | 1026→899ms* |
| 4 | `merchant-applications` | 57 KB | 2.0 KB | ↓ 96.5% | 3 | 0 | 538→796ms* |
| 5 | `orders` | 3.6 KB | 2.1 KB | ↓ 42% | 0 | 0 | 89→95ms |
| 6 | `merchant/inventory` | 1.3 KB | 1.3 KB | — | 0 | 0 | جيد سابقاً |

\* الزمن يشمل first-compile في وضع التطوير؛ في الإنتاج (build) يكون أقل بكثير بعد الإحماء. الفجوة الحقيقية الأهم هي **حجم النقل على الشبكة** وليس زمن التطوير.

---

## 🐞 المشاكل المكتشفة (تفصيل)

### 🔴 مستوى حرج (Critical)

#### 1. إرجاع صور base64 ضخمة داخل List APIs
- **الملفات:** `app/api/admin/wings/route.ts`, `app/api/merchant/products/route.ts`, `app/api/admin/stores/route.ts`
- **السبب:** استخدام `db.select().from(table)` يرجع **كل الأعمدة** بما فيها حقول الصور النصية التي قد تحتوي `data:image/...;base64`. جناح واحد = 4 صور × 60KB = 240KB. منتج واحد = صورة رئيسية + معرض 3 صور = 240KB.
- **الأثر:** payload بميجابايتات، بطء SSR، استهلاك عرض نطاق، تجميد لوحات التاجر مع نمو البيانات.

#### 2. تجاوز قاعدة "ممنوع base64 في List APIs"
- **الملف:** `app/api/merchant-applications/route.ts`
- **السبب:** كان يرجع `contract_body` (نص طويل)، `signed_contract_snapshot` (jsonb ضخم)، و`contract_signature_data_url` (**صورة توقيع base64**) في قائمة الطلبات.
- **مستوى الخطورة:** حرج — صورة التوقيع تُنقل كاملة في كل تحميل لجدول الطلبات.

### 🟠 مستوى عالٍ (High)

#### 3. غياب الـ pagination الكامل
- **الملفات:** كل الـ 6 واجهات
- **السبب:** كانت تستخدم `.limit(100)` أو `.limit(200)` بدون `totalCount` أو `hasNext` أو `page`. لا يمكن للواجهة الأمامية بناء ترقيم صفحات حقيقي.
- **الأثر:** عدم القدرة على تصفّح البيانات، تحميل كامل السجلات دفعة واحدة.

#### 4. غياب البحث والفلترة على مستوى الخادم
- **الملفات:** كل الـ 6 واجهات
- **السبب:** لا توجد معالجة لـ `?q=` أو `?status=`. البحث كان ليعتمد على الفلترة في المتصفح بعد تحميل كل البيانات.
- **الأثر:** تحميل غير ضروري + بطء بحث مع نمو البيانات.

### 🟡 مستوى متوسط (Medium)

#### 5. `select()` غير محدد يرجع كل الأعمدة
- **الملفات:** wings (12 عمود), stores (30 عمود), products (34 عمود), orders (17 عمود), merchant-applications (36 عمود)
- **السبب:** `db.select().from(table)` يجلب كل الأعمدة بما لا يلزم لواجهة القائمة (مثل `description`, `specifications`, `delivery_address`, `updated_at`...).
- **الأثر:** نقل بيانات لا تُستخدم، استهلاك ذاكرة، بطء serialization.

#### 6. تحميل علاقات/حقول غير ضرورية
- **الملف:** `app/api/merchant/inventory/route.ts` — كان يجلب كل أعمدة حركات المخزون بدون pagination.

---

## ✅ التحسينات المنفّذة (تفصيل قبل/بعد)

### التحسين 1: طبقة تحسينات مشتركة `lib/api-list-utils.ts` (ملف جديد)
**قبل:** كل واجهة تكرر منطق الـ pagination/البحث/تنظيف الصور بشكل منفصل أو لا تفعله.
**بعد:** وحدة مركزية واحدة توفر:
- `parseListQuery()` — تحليل `page`, `pageSize`, `q` مع تحديد حد أقصى (100) وحماية من القيم غير الصالحة.
- `buildSearchFilter()` — بناء `ilike` عربي آمن (إرجاع `undefined` عند الفراغ لتفادي full scan).
- `sanitizeMediaFields()` / `sanitizeMediaList()` — استبدال base64 بـ proxy URL + وسم `hasInlineImage: true`.
- `listResponse()` — مغلف موحد `{ items, page, pageSize, totalCount, hasNext, totalPages }`.
**الأثر التقني:** مصدر واحد للحقيقة، سلوك متناسق عبر كل الـ APIs، سهولة الصيانة.

### التحسين 2: تجريد base64 إلى طبقة SQL (`inlineMediaSql`)
**قبل:** `mainImageUrl`, `coverImageUrl`, `logoUrl`, `iconUrl`, `heroImageUrl`... تُنقل كـ base64 كاملة.
**بعد:** تُستبدل على مستوى SQL بـ `case when field like 'data:image/%;base64,%' then '/api/media/inline?...' else field end`. الصورة **لا تغادر قاعدة البيانات كـ base64 إطلاقاً** — تُستبدل برابط proxy قصير، وتُخدم لاحقاً عبر `/api/media/inline` (واجهة موجودة مسبقاً).
**الأثر التقني:** products من 2.8MB → 7.8KB. الصور تظل تُعرض طبيعياً دون فقدان.

### التحسين 3: تحويل `select()` إلى حقول محددة لكل واجهة
**قبل:** `db.select().from(table)` — كل الأعمدة.
**بعد:** لكل واجهة قائمة حقول منتقاة فقط:
- `products`: 18 حقل (بدون `description`, `specifications`, `images` gallery).
- `stores`: 16 حقل (بدون `social_links`, `description`, `video_url`...).
- `merchant-applications`: 16 حقل (بدون `contract_body`, `signed_contract_snapshot`, `contract_signature_data_url`) + إضافة `hasSignature`/`hasContractBody` كـ boolean.
- `orders`: 13 حقل (بدون `delivery_address`, `customer_note`).
**الأثر التقني:** تقليل الاستهلاك وإزالة الحقول الثقيلة من مسار القائمة.

### التحسين 4: إضافة pagination + search + filter لكل واجهة
**قبل:** `.limit(100)` فقط.
**بعد:** كل واجهة تدعم:
- `?page=1&pageSize=20` (افتراضي) مع `totalCount` و `hasNext` و `totalPages`.
- `?q=` بحث عربي بـ `ilike` عبر عدة أعمدة (الاسم، الرقم، البريد، الهاتف، الكود...).
- `?status=` فلترة بالحالة.
- استعلام `count(*)` موازٍ عبر `Promise.all` لتقليل زمن الانتظار.
**الأثر التقني:** تصفّح حقيقي، بحث خادمي سريع، قابلية توسع.

### التحسين 5: حفظ التوافق الخلفي (Backward Compatibility)
**قبل:** `ok({ products: [...] })`, `ok({ stores: [...] })`.
**بعد:** المصفوفة تبقى بنفس المفتاح (`data.products`, `data.stores`) مع إضافة حقول pagination **بجانبها** (`data.page`, `data.totalCount`...). الواجهة الأمامية الحالية لا تنكسر.
**الأثر التقني:** لا حاجة لتغيير الـ frontend فوراً؛ الحقول الجديدة إضافية.

---

## 🧪 التحقق من الجودة

| الفحص | النتيجة |
|-------|---------|
| `npm run lint` | ✅ نظيف (0 أخطاء) |
| `npx tsc --noEmit` | ✅ نظيف (0 أخطاء أنواع) |
| `npm run build` | ✅ نجح كاملاً (كل الصفحات + APIs مُولّدة) |
| اختبار pagination | ✅ products: page=1 (5 items, totalCount=14, hasNext=true) |
| اختبار البحث العربي | ✅ `?q=منتج` وجد 13 من 14 |
| اختبار الفلترة | ✅ `?status=active`, `?status=new`, `?status=contract_signed` |
| توافق الواجهات | ✅ `data.products` / `data.stores` لا تزال مصفوفات |

---

## 📈 توصيات مستقبلية (Future Recommendations)

### 1. تخزين سحابي للوسائط (Cloud Storage) — أولوية عالية
النظام الحالي يدعم `local | cloudinary | s3 | r2` لكن البيانات تُخزَّن أحياناً كـ base64 داخل قاعدة البيانات.
- **التوصية:** ربط رفع الصور بـ Cloudinary/R2 في الإنتاج، وتشغيل سكربت ترحيل لتحويل base64 الموجود إلى روابط CDN، وتفريغ أعمدة الصور في DB.
- **الأثر:** تقليل حجم قاعدة البيانات جذرياً، تسليم أسرع للصور عبر CDN عالمي.

### 2. تحسين الوسائط (Media Optimization)
- توليد صور مصغّرة (thumbnails) متعددة الأحجام عند الرفع (لا relies على proxy في كل طلب).
- ضغط تلقائي (WebP/AVIF) وlazy-loading على مستوى المكونات.

### 3. التخزين المؤقت (Caching)
- إضافة `Cache-Control` / `s-maxage` للاستجابات شبه الثابتة (الأجنحة، قوائم التصنيفات).
- استخدام `unstable_cache` من Next.js للاستعلامات المتكررة مع `revalidateTag` عند التعديل.
- تخزين مؤقت على مستوى Upstash Redis (موجود في الإعدادات) لعدّاد النتائج.

### 4. مركزية التفويض (Authorization Centralization)
حالياً التحقق من الصلاحيات متناثر (`requireAuth` + `assertAdmin` + `hasStoreAccess` + `userHasStorePermission` في كل واجهة).
- **التوصية:** طبقة `withAuth(handler, { permission })` موحّدة (wrapper) تختصر التكرار وتضمن عدم نسيان فحص صلاحية.

### 5. فهارس مفقودة (Missing Indexes) — عند الضرورة فقط
الفحص كشف غياب فهارس على بعض أعمدة الفلترة/البحث:
- `stores(status)`, `products(status)`, `merchant_applications(store_name)`.
- **التوصية:** إضافة فهارس B-tree على أعمدة الفلترة المتكررة عند نمو البيانات (لكن `status` ذو تعددية منخفضة فيُفضّل فهرس جزئي `WHERE status='active'`). تنبيه: هذا تغيير في المخطط، يُنفّذ عبر migration منفصل.

### 6. تقسيم اللوحات (Dashboard Splitting)
- فصل استعلامات العدّ (dashboards metrics) إلى واجهة مخصّصة (`/api/admin/metrics`) بدلاً من تضمينها في قوائم البيانات.
- تقسيم لوحة الأدمن الكبيرة إلى شرائح قابلة للتحميل المستقل (code-splitting + streaming SSR).

### 7. مراقبة الأداء (Observability)
- إضافة قياس زمن الاستعلام وعدد البايتات المنقولة في ترويسات `X-Response-Time` / `X-Payload-Bytes` للمراقبة.
- استخدام Sentry المدمج لتتبّع بطء الـ API في الإنتاج.

---

## 📂 قائمة الملفات المُعدَّلة

**ملفات محسّنة (واجهات):**
- `app/api/admin/wings/route.ts`
- `app/api/admin/stores/route.ts`
- `app/api/merchant/products/route.ts`
- `app/api/merchant/inventory/route.ts`
- `app/api/orders/route.ts`
- `app/api/merchant-applications/route.ts`

**ملفات جديدة (طبقة مشتركة):**
- `lib/api-list-utils.ts`

**أدوات قياس (اختيارية للحذف قبل الإنتاج):**
- `scripts/bench-measure.ts`, `scripts/benchmark-apis.ts`, `scripts/benchmark-seed.sql`, `scripts/test-features.js`

---

## ✅ الخلاصة

تم الوصول إلى الأهداف المطلوبة:
- ✅ **APIs خفيفة:** متوسط الحجم انخفض من ~750KB إلى ~4KB لكل واجهة.
- ✅ **SSR سريع:** إزالة الـ base64 من حمولة الخادم تسرّع التصيير بشكل كبير.
- ✅ **payload صغير:** 99.5% تقليل إجمالي.
- ✅ **استقرار أعلى:** pagination يمنع التحميل الزائد مع نمو البيانات.
- ✅ **جاهزية للتوسع:** بحث وفلترة خادمية + بنية قابلة للتمدد لآلاف السجلات.
