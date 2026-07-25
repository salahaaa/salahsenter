# تقرير جاهزية الخلفية للتوسع والأمان — 2026-07-01

## ملخص تنفيذي

تم سحب مشروع `salahsentar22` وفحصه محلياً. المشروع **صالح كبنية أولية قوية** لمنصة متعددة المتاجر، لكن لا يمكن ضمان استيعاب:

- مئات الأجنحة.
- عشرات آلاف المتاجر.
- 70,000 زيارة يومياً.
- مئات آلاف العمليات اليومية.

بدون تنفيذ مرحلة تقوية Backend/Infrastructure/Database واختبارات ضغط حقيقية. الكود الحالي ينجح في البناء والاختبارات الأساسية، لكن توجد نقاط تحتاج معالجة قبل الإنتاج الكبير.

## نتائج الفحص المحلي

الأوامر التي تم تشغيلها:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run check:paths
npm audit --json
```

النتائج:

- التثبيت نجح.
- ESLint نجح.
- TypeScript نجح.
- Vitest نجح: 2 ملفات اختبار، 6 اختبارات ناجحة.
- Build نجح على Next.js.
- فحص أسماء الملفات نجح.
- `npm audit`: يوجد 2 ثغرات متوسطة مرتبطة بـ `exceljs -> uuid`، لا توجد ثغرات عالية أو حرجة في نتيجة الفحص الحالية.

إحصاءات سريعة:

- حوالي 137 API route.
- حوالي 98 جدول في Drizzle schema.
- حوالي 182 index في schema/migrations.
- حوالي 33k سطر TypeScript/TSX في app/components/lib/services/scripts/tests.

## تقدير حمل 70 ألف زيارة يومياً

70,000 زيارة يومياً تعادل تقريباً:

- 0.8 زيارة/ثانية كمتوسط يومي.
- عند اعتبار 10-30 طلب HTTP لكل زيارة: تقريباً 8-25 طلب/ثانية متوسط.
- في أوقات الذروة قد نحتاج التصميم لتحمل 5x إلى 10x: تقريباً 40-250 طلب/ثانية.

هذا الحجم **ممكن تقنياً** مع Next.js + PostgreSQL + CDN + Redis + Object Storage، بشرط ضبط البنية والاستعلامات والكاش والـ pooling. ليس مضموناً بمجرد رفع النسخة الحالية كما هي.

## نقاط القوة الحالية

1. **بنية Backend واضحة**
   - Next.js App Router.
   - Drizzle ORM.
   - PostgreSQL.
   - طبقة خدمات جزئية.
   - تقسيم API واسع.

2. **أساس أمان جيد**
   - JWT داخل Cookie `httpOnly`.
   - Session table مع إلغاء الجلسات.
   - CSRF middleware للطلبات المعدّلة.
   - Security headers وCSP.
   - RBAC وأدوار وصلاحيات.
   - MFA للأدمن عند تفعيله.
   - Rate limiting موجود على تسجيل الدخول ورفع الملفات.
   - فلترة رفع الملفات: MIME + extension + magic bytes + منع SVG + malware hook اختياري.

3. **فهرسة قاعدة البيانات موجودة**
   - توجد فهارس على جداول كثيرة مثل users/stores/products/orders/announcements/news/banners.

4. **الصفحة الرئيسية تستخدم ISR**
   - `app/page.tsx` لديها `revalidate = 120`، وهذا يقلل الضغط على قاعدة البيانات للصفحة الرئيسية.

## مخاطر الأداء والتوسع

### 1. اتصال قاعدة البيانات في بيئة Serverless

الملف: `lib/db/index.ts`

```ts
postgres(databaseUrl, { max: 10, prepare: false, idle_timeout: 20 })
```

لو تم النشر على Vercel/Serverless وكل instance يفتح حتى 10 اتصالات، قد يتم استنزاف اتصالات PostgreSQL بسرعة عند الذروة.

**التوصية:**

- استخدام Pooler/pgBouncer أو مزود PostgreSQL يدعم pooling.
- ضبط `DB_POOL_MAX` حسب نوع النشر:
  - Serverless: 1-3 لكل instance.
  - Node server دائم: 10-30 حسب حجم الخادم وقاعدة البيانات.

### 2. صفحات عامة ديناميكية بدون كاش كافٍ

مثال: `app/store/[slug]/page.tsx`

```ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
```

صفحات المتاجر العامة قد تكون الأكثر زيارة. كل زيارة تضرب قاعدة البيانات بعدة استعلامات. مع عشرات آلاف المتاجر وزيارات عالية، يجب فصل وضع المعاينة/الإدارة عن العرض العام، وتفعيل كاش للعرض العام.

**التوصية:**

- جعل صفحة المتجر العامة قابلة للكاش/ISR.
- جعل `preview=1` فقط dynamic.
- كاش Redis/unstable_cache لبيانات المتجر والمنتجات الشائعة.

### 3. البحث يستخدم `ILIKE %term%`

يوجد بحث في عدة ملفات باستخدام `ilike('%term%')`. هذا قد يؤدي إلى full table scan عند كثرة المنتجات والمتاجر.

**التوصية:**

- PostgreSQL `pg_trgm` + GIN indexes للحقول النصية المهمة.
- أو محرك بحث خارجي لاحقاً مثل Meilisearch/OpenSearch عند تضخم البيانات.

### 4. Pagination موجود لكنه Offset-based

`parseListQuery` ممتاز كبداية، لكن `offset` يصبح بطيئاً في الصفحات العميقة مع ملايين الصفوف.

**التوصية:**

- إبقاء offset في لوحات الإدارة البسيطة.
- إضافة cursor pagination للطلبات/المنتجات/الحركات/السجلات الكبيرة.

### 5. الطلبات والمخزون يحتاجان قفل/تحديث ذري

في إنشاء الطلب يتم فحص المخزون ثم تسجيل حجز، والخصم يتم لاحقاً عند حالة `preparing`. في تحديث حالة الطلب يتم فحص الكمية ثم تحديثها، لكن ليس بشرط ذري `stock_quantity >= quantity` داخل نفس جملة التحديث.

**المخاطر:**

- overselling عند طلبات متزامنة.
- ازدواج خصم/إرجاع في حالات التنافس إن لم تتم تقوية idempotency.

**التوصية:**

- تنفيذ atomic stock reservation.
- تحديث المخزون بجملة شرطية مثل:
  - `UPDATE product_variants SET stock_quantity = stock_quantity - qty WHERE id = variantId AND stock_quantity >= qty RETURNING ...`
- إضافة جدول reservations أو حالة حجز واضحة.
- إضافة idempotency key لإنشاء الطلبات والمدفوعات.

### 6. Rate limiting غير شامل لكل العمليات الحساسة

موجود لتسجيل الدخول ورفع الملفات، لكنه غير ظاهر على كل المسارات الحساسة مثل:

- إنشاء الطلبات.
- البحث.
- إنشاء المنتجات بكثافة.
- إجراءات الأدمن الحساسة.
- forgot/reset password جزئياً يحتاج مراجعة حدود دقيقة.

**التوصية:**

- Rate limits لكل scope: search, orders, product mutations, admin mutations, password reset.
- استخدام Redis إلزامياً في الإنتاج، وعدم الاعتماد على memory fallback.

### 7. الصور/base64

توجد طبقة media تمنع base64 الجديد، لكن validators لا تزال تسمح بـ `data:image/` وبعض Routes تكتب `imageUrl` مباشرة من payload. هذا قد يسمح بتضخم قاعدة البيانات إن لم تكن كل المسارات تستخدم sanitizer.

**التوصية:**

- تطبيق `sanitizeImageUrl/sanitizeImageArray` في كل مسارات إدخال الصور.
- منع `data:image` من validators العامة باستثناء مسار التوقيع الإلكتروني فقط.
- إجبار الإنتاج على Cloudinary/S3/R2.

## مخاطر الأمان

### نقاط جيدة

- Cookies آمنة نسبياً: httpOnly + sameSite + secure في الإنتاج.
- CSRF موجود للـ API mutating requests.
- CSP وHeaders موجودة.
- RBAC مركزي جزئياً.
- MFA موجود للأدمن عند تفعيله.
- Upload hardening جيد.

### نقاط تحتاج تقوية

1. **JWT_SECRET يجب أن يكون قوياً وطويلاً**
   - لا يجوز استخدام قيمة `.env.example` في الإنتاج.

2. **Redis rate limiting إلزامي**
   - memory fallback غير كافٍ في production/serverless.

3. **مراجعة كل route ضد IDOR**
   - توجد طبقة authorization جيدة، لكن يلزم التأكد أن كل API يستخدمها وليس checks متفرقة.

4. **CSP يحتوي unsafe-inline**
   - مقبول مؤقتاً مع Next/UI، لكن في مستوى أمان أعلى يفضل nonce/hashes.

5. **MFA للأدمن يجب أن يكون إلزامياً**
   - الكود يدعمه، لكن يجب فرضه في policy.

6. **توقيع العقود يحفظ data URL**
   - مقبول كحالة خاصة، لكن يجب حد حجم وتطهير ومعالجة تخزينه على object storage إن كبر.

## الحكم النهائي

### هل يستطيع المشروع تحمل الحجم المطلوب حالياً؟

**ليس بضمان حالياً.**

هو قابل للوصول لهذا الحجم بعد مرحلة تقوية. النسخة الحالية تعمل وتبني بنجاح، لكنها تحتاج:

- Pooling مضبوط لقاعدة البيانات.
- كاش للصفحات العامة والمتاجر والبحث.
- فهارس بحث نصي وفهارس مركبة إضافية.
- قفل/تحديث ذري للمخزون والطلبات.
- Rate limits شاملة.
- Load testing قبل الإنتاج.

### هل المشروع مؤمن؟

**لديه أساس أمني جيد، لكنه ليس مكتملاً كمنصة إنتاج كبيرة حتى الآن.**

يحتاج Hardening إضافي وسياسات إنتاج صارمة، خصوصاً Redis rate limit، MFA إلزامي للأدمن، منع base64، مراجعة IDOR، وضبط الأسرار والبيئة.

## خطة المرحلة الأولى المقترحة

1. **Database & connection hardening**
   - إضافة إعداد `DB_POOL_MAX`.
   - توثيق إلزامية DB Pooler في الإنتاج.
   - فهارس مركبة للصفحات العامة والطلبات والبحث.

2. **Public caching**
   - كاش بيانات المتجر والمنتج.
   - فصل preview/admin عن public pages.
   - Redis cache للـ search/results الشائعة.

3. **Orders & inventory correctness**
   - atomic reservation/deduction.
   - idempotency keys.
   - قيود تمنع overselling.

4. **Rate limit expansion**
   - search.
   - orders.
   - product mutations.
   - admin sensitive mutations.

5. **Media hardening**
   - منع base64 في كل الصور باستثناء signature.
   - فرض S3/R2/Cloudinary في production.

6. **Security hardening**
   - MFA إلزامي للأدمن.
   - مراجعة route-by-route للـ authorization.
   - تحسين CSP لاحقاً.

7. **Load testing**
   - k6 أو Artillery.
   - سيناريوهات: home, store page, product page, search, login, create order, merchant dashboard.
   - هدف أولي: 250 req/sec peak للقراءات و50 req/sec للعمليات الحساسة مع p95 أقل من 500-1000ms حسب الصفحة.
