# تقرير تنفيذ محرك جدولة الظهور للعروض والإعلانات

التاريخ: 2026-07-02

## الهدف

تمكين الأدمن من التحكم الاحترافي في أوقات ظهور العروض والإعلانات والبانرات، مثل:

- ظهور دائم.
- نطاق تاريخ.
- ساعتين يومياً.
- 4 ساعات يومياً.
- يومين في الأسبوع.
- فتحات مخصصة.

## ما تم تنفيذه

### 1. محرك جدولة موحد

تمت إضافة:

```txt
lib/visibility-schedule.ts
```

يدعم:

```txt
always
date_range
daily_window
weekly_window
custom_slots
```

مع timezone افتراضي:

```txt
Asia/Aden
```

### 2. محرر جدولة reusable

تمت إضافة:

```txt
components/admin/visibility-schedule-editor.tsx
```

يستخدم في:

- بانرات الرئيسية.
- إعلانات المول.
- عروض الإدارة.
- عروض التجار من لوحة الأدمن.

### 3. تحديث قاعدة البيانات

تمت إضافة migration:

```txt
drizzle/0030_visibility_schedule.sql
```

وتم تطبيقها بنجاح على الجداول:

```txt
banners
announcements
news
store_offer_collections
admin_promotional_offers
ad_campaigns
```

### 4. تطبيق الجدولة على الواجهة العامة

تم تعديل:

```txt
lib/cache/public-offers-cache.ts
lib/cache/public-offer-detail-cache.ts
lib/db/queries.ts
lib/home-visibility.ts
```

بحيث لا يظهر العرض/الإعلان/البانر إلا إذا كان نشطاً حسب جدول الظهور.

### 5. إدارة الأدمن

#### العروض

في:

```txt
/admin/offers
```

أصبح الأدمن يستطيع:

- قبول/رفض/إيقاف/حذف.
- تعديل بداية ونهاية العرض.
- ضبط جدول ظهور يومي/أسبوعي/مخصص.

#### إعلانات وبانرات الرئيسية

في:

```txt
/admin/ads
```

أصبح الأدمن يستطيع:

- إنشاء بانر أو إعلان بجدولة ظهور متقدمة.
- تعديل حالة وجدولة الإعلانات والبانرات الموجودة.
- تعطيل أو حذف.

## أمثلة مدعومة

### ساعتين يومياً

```txt
mode = daily_window
startTime = 16:00
endTime = 18:00
```

### يومين في الأسبوع

```txt
mode = weekly_window
weekDays = الإثنين والخميس
startTime = 10:00
endTime = 14:00
```

### لمدة أسبوعين

```txt
mode = date_range
startDate = 2026-07-01
endDate = 2026-07-14
```

### فتحات مخصصة

```txt
2026-07-05 09:00-12:00
weekday:1 16:00-18:00
```

## الفحص

تم تشغيل:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

النتيجة: PASS.

## ملاحظات

- لم يتم تشغيل db:seed.
- تم حذف node_modules و .next بعد الفحص.
- حجم المشروع حوالي 11MB.
