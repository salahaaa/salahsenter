# تقرير تطوير نظام العروض الذكي Smart Offers System

التاريخ: 2026-07-01

## ما تم تنفيذه

### 1) صفحة العروض العامة `/offers`

تم تحويل صفحة العروض إلى واجهة حديثة تشبه منصات التجارة العالمية:

- Hero احترافي.
- إحصائيات للعروض.
- تصنيفات: عروض اليوم، الحصرية، الرائجة، الجديدة، عروض المتاجر، عروض الإدارة.
- Rails أفقية للعروض السريعة.
- بطاقات حديثة مع hover وعداد أيام متبقية.
- عرض السعر قبل/بعد ونسبة التوفير.
- قسم AI Recommendation مبدئي يعتمد على العروض الحصرية والموسمية والرائجة.
- Lazy loading للصور.

### 2) صفحة تفاصيل العرض `/offers/[id]`

تم إنشاء صفحة تفاصيل للعرض:

- تعرض صورة العرض، المتجر، الموسم، مدة العرض.
- تعرض المنتجات المضمنة داخل العرض.
- تعرض السعر قبل وبعد.
- تسمح للعميل بتعديل كميات منتجات العرض.
- شراء العرض مباشرة عبر `POST /api/orders` مع `Idempotency-Key`.

### 3) عروض التجار Merchant Smart Offers

تم تطوير إنشاء العروض للتجار:

- اختيار أكثر من منتج.
- صورة العرض.
- سعر الباقة.
- نسبة الخصم.
- نوع العرض: باقة، تخفيض، حصري، تصريف، موسمي.
- مدة العرض.
- وضع النشر:
  - إرسال لموافقة الأدمن.
  - نشر مباشر مع حق الأدمن بالإيقاف.

تم تطوير إدارة التاجر لعروضه:

- إيقاف/إخفاء العرض.
- نشر مباشر.
- إعادة إرسال للمراجعة.
- حذف العرض.

الملفات:

```txt
components/merchant/store-offer-form.tsx
components/merchant/store-offer-actions.tsx
app/api/merchant/offers/route.ts
app/api/merchant/offers/[id]/route.ts
app/merchant/offers/page.tsx
```

### 4) تحكم الأدمن بعروض التجار

تم تطوير لوحة الأدمن للعروض:

- مراجعة عروض التجار.
- قبول.
- رفض.
- إيقاف/تعطيل.
- حذف.
- إدارة مواسم العروض.

الملفات:

```txt
app/admin/offers/page.tsx
components/admin/admin-offer-actions.tsx
app/api/admin/store-offers/[id]/status/route.ts
```

### 5) عروض الإدارة الترويجية Admin Promotional Offers

تم إضافة نوع عروض مستقل للإدارة، ليس بالضرورة مرتبطاً بالشراء:

- صورة.
- فيديو.
- وصف.
- رقم هاتف.
- واتساب.
- موقع/عنوان.
- رابط خارجي.
- مدة ظهور.
- تصنيف.
- تمييز.

تم إضافة API للإدارة:

```txt
app/api/admin/promotional-offers/route.ts
app/api/admin/promotional-offers/[id]/route.ts
```

وواجهة إنشاء:

```txt
components/admin/admin-promotional-offer-form.tsx
```

### 6) قاعدة البيانات

تم إضافة جدول جديد:

```txt
admin_promotional_offers
```

وملف migration:

```txt
drizzle/0022_admin_promotional_offers.sql
```

كما تم تعديل عمود:

```txt
store_offer_collections.promotion_package
```

من `varchar(80)` إلى `text` حتى يمكن تخزين metadata للعروض الذكية بأمان.

وملف migration:

```txt
drizzle/0023_offer_promotion_package_text.sql
```

> ملاحظة مهمة: يجب تطبيق هذين الملفين على قاعدة الإنتاج قبل نشر الكود الجديد.

### 7) Cache/Public loaders

تم تحديث:

```txt
lib/cache/public-offers-cache.ts
lib/cache/public-offer-detail-cache.ts
```

ليحمّل:

- عروض التجار المعتمدة.
- عروض الإدارة النشطة.
- تفاصيل العرض.

### 8) Inline media

تم تحديث:

```txt
app/api/media/inline/route.ts
```

ليدعم صور `admin_promotional_offers` إذا كانت محفوظة كـ inline legacy image.

## نتائج الفحص

تم تشغيل:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

النتائج:

```txt
lint: PASS
typecheck: PASS
tests: PASS
build: PASS
```

## المطلوب قبل الإنتاج

قبل نشر هذا الجزء يجب تطبيق migrations الجديدة فقط:

```txt
0022_admin_promotional_offers.sql
0023_offer_promotion_package_text.sql
```

ولا يتم تشغيل `db:seed`.

