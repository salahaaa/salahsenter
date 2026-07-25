# Database Readiness + Honest Public Fallbacks

**التاريخ:** 25 يوليو 2026  
**النطاق:** تطوير مصدر فقط، بلا تغيير Vercel أو قاعدة بيانات حية أو نشر.

## سبب الحزمة

الفحص الخارجي للنسخة المنشورة كشف تناقضاً:

```text
/api/health?deep=1 → database ping نجح
/offers            → رسالة «قاعدة البيانات غير متصلة»
/wings/fashion     → تعذر تحميل ثم الجناح غير موجود
/store/tech-store  → خطأ مؤقت ثم المتجر غير موجود
```

كما أظهر Vercel Runtime Log:

```text
Postgres code 42P01
relation "background_jobs" does not exist
```

وهذا يعني أن الاتصال يعمل، لكن Schema القاعدة الحية ناقص migrations. وكانت رسالة `/offers` مضللة لأنها تعامل كل فشل بيانات كأنه انقطاع اتصال.

## ما تم تطويره

### 1) Database readiness service

أضيف:

```text
lib/database-readiness.ts
```

ويصنف الحالة إلى:

```text
ready
unconfigured
schema_incomplete
unavailable
unknown
```

يتحقق، بكاش قصير، من جداول التشغيل الأساسية مثل:

```text
__drizzle_migrations
users / roles / permissions
stores / wings / store_wings / products
background_jobs
store_offer_collections / store_offer_items / offer_campaigns
admin_promotional_offers
store_media / categories / announcements / news
product_variants / product_images
countries / governorates / cities
```

كما يصنف PostgreSQL errors بأمان:

```text
42P01 / 42703 / 42883 → schema_incomplete
28* / 3D000          → unavailable / permissions or database target
08* / timeout        → unavailable
```

### 2) Health Check صادق وآمن

تم تحديث:

```text
/api/health?deep=1
```

ليعرض:

```json
{
  "database": { "ok": true },
  "schema": { "ok": false, "state": "schema_incomplete" },
  "status": "degraded"
}
```

ولا يعرض الآن في public response:

```text
raw PostgreSQL error
SQL statement
relation names
connection string
credentials
```

### 3) رسائل عامة دقيقة

أضيف component مشترك:

```text
components/public/database-readiness-state.tsx
```

واستُخدم في:

```text
/offers
/wings
/wings/[slug]
/store/[slug]
```

بدلاً من عبارة «قاعدة البيانات غير متصلة» لكل الحالات، يظهر الآن أحد المعاني الصحيحة:

```text
بيانات العرض لم تُجهز بعد
إعداد قاعدة البيانات غير مكتمل
تعذر الوصول إلى بيانات العرض مؤقتاً
تعذر تحميل بيانات العرض
```

### 4) إزالة روابط الصفحة الرئيسية الوهمية

تمت إزالة fallback stores/wings التي كانت تولد Slugs غير موجودة مثل:

```text
tech-store
youth-fashion
luxury-style
fashion
electronics
```

لا تُعرض بطاقات متجر أو جناح قابلة للنقر الآن إلا إذا جاءت من السجلات المنشورة الحقيقية في قاعدة البيانات.

تم أيضاً استبدال خبر وهمي مثل:

```text
افتتاح 12 متجراً جديداً هذا الأسبوع
```

برسالة حيادية لا تدعي وجود بيانات غير حقيقية.

### 5) تشخيص للأدمن

تم تحديث:

```text
/admin/observability
```

ليعرض:

```text
Database schema state
قائمة الجداول التشغيلية الناقصة
```

ضمن صفحة مراقبة محمية بصلاحيات الأدمن، بينما Health العام لا يكشفها.

### 6) Security dependency refresh

ظهر أثناء التطوير advisory جديد عالي الخطورة في dependencies القديمة المرتبطة بـ:

```text
PostCSS
brace-expansion
archiver/readdir-glob
```

تم تحديث overrides بصورة متوافقة واختبرت مع المشروع:

```text
postcss          → 8.5.23
brace-expansion  → 5.0.8 في سلاسل minimatch المتأثرة
archiver         → 8.0.0
```

ولم يستخدم:

```text
npm audit fix --force
```

## ما لم يتغير فعلياً

```text
لم تُطبق migrations على قاعدة Vercel الحية.
لم يُنشر المصدر الجديد إلى Vercel.
لم تُربط Render أو Neon جديدة.
لم تُخلق بيانات متجر/جناح حية.
```

لذلك الموقع الحالي سيبقى يعرض الخطأ القديم إلى أن يرفع المصدر الجديد وتطبق migrations على قاعدة الاختبار المقصودة.

## الاختبارات

أضيف:

```text
tests/database-readiness-and-public-fallbacks.test.ts
```

ويتحقق من:

```text
تمييز missing migrations عن connection failures
عدم تسريب تفاصيل SQL في Health
استخدام صفحات البيانات لرسالة readiness المشتركة
إزالة slugs التجريبية القابلة للنقر
ظهور schema diagnostic للأدمن
```

## نتائج التحقق المحلي

```text
npm run release:verify:source                  ✅
Client/server boundary check                   ✅ 195 entries
Unit tests                                      ✅ 74 files / 206 tests
Migration journal                               ✅ 88 SQL / 88 journal entries
Drizzle schema check                            ✅
Security verification                           ✅
npm audit --audit-level=high                   ✅ 0 vulnerabilities
git diff --check                                ✅
```

## النتيجة

هذه الحزمة لا تعالج قاعدة Vercel القديمة تلقائياً، لكنها تجعل النسخة الجديدة:

```text
تقول السبب الصحيح للمستخدم
تكشف Schema readiness في Health/Admin بأمان
تمنع روابط demo المكسورة
تمنع عودة الاعتماديات عالية الخطورة المكتشفة
```
