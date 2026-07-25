# تقرير تطوير Home Visibility Rules Engine — 2026-07-08

## الهدف
تطوير نافذة **قواعد الظهور في الصفحة الرئيسية** لتصبح محركاً منظماً وذكياً يتحكم في ظهور المتاجر والمنتجات والعروض والأجنحة/القاعات، مع منع الاحتكار وإتاحة سيطرة كاملة للأدمن بدون تعديل الكود.

## ما تم تنفيذه

### 1) الصفحة المستقلة موجودة ومطوّرة
الصفحة موجودة داخل لوحة الأدمن:

```txt
/admin/home-visibility
```

وتم توسيعها لتشمل قواعد متقدمة، وليست مجرد تفعيل/تعطيل بسيط.

---

### 2) قواعد ظهور مستقلة
تم توسيع نموذج القواعد في:

```txt
lib/home-visibility.ts
```

ليدعم أهداف ظهور مستقلة لـ:

- المتاجر.
- المنتجات.
- العروض.
- الأقسام.
- القاعات/الأجنحة.

وذلك عبر:

```txt
appearanceTypes
fairness
rankingWeights
seasonalRules
timeRules
pinnedContent
```

---

### 3) أنواع الظهور المدعومة
تمت إضافة دعم قابل للتفعيل/الإيقاف لكل نوع:

- الأكثر مبيعاً.
- الأعلى تقييماً.
- الأحدث إضافة.
- الأكثر مشاهدة.
- العروض النشطة.
- المنتجات الموسمية.
- المنتجات المدعومة إعلانياً.
- الاختيارات اليدوية للأدمن.
- التوصيات الذكية.

داخل واجهة الأدمن تظهر في قسم:

```txt
أنواع الظهور المدعومة
```

---

### 4) منع احتكار الصفحة الرئيسية
تمت إضافة قواعد:

```txt
maxProductsPerStore
maxOffersPerStore
maxStoresPerHall
```

وتُطبق عملياً في:

- `getHomepagePromotedProducts`
- `getHomepageSeasonalOffers`
- `getHomepageFeaturedStores`

الهدف:

- لا يظهر عدد مبالغ فيه من منتجات متجر واحد.
- لا تظهر عروض كثيرة من متجر واحد.
- لا تسيطر قاعة/جناح واحد على متاجر الواجهة.

---

### 5) توزيع عادل للظهور
تمت إضافة إعدادات:

```txt
newStoreBoostDays
avoidProductRepeatDays
activeStoreMinimumCompleteness
```

وتدخل في ranking/fairness logic.

المتاجر الجديدة تحصل على boost حسب عدد الأيام المحدد.

---

### 6) نظام Ranking Score
تمت إضافة Ranking Score يعتمد على أوزان قابلة للتعديل:

```txt
sales
ratings
preparationSpeed
activity
dataQuality
cancellationRate
complaints
freshness
views
promoted
```

وتستخدم فعلياً في ترتيب:

- المتاجر.
- المنتجات.

داخل:

```txt
rankingScoreSql()
```

---

### 7) أوزان الترتيب من لوحة الأدمن
تمت إضافة قسم:

```txt
أوزان Ranking Score
```

ومن خلاله يستطيع الأدمن تعديل الأوزان بدون كود.

مثلاً:

```txt
المبيعات
التقييمات
النشاط
جودة البيانات
الحداثة
الإعلانات
```

---

### 8) القواعد الموسمية والزمنية
تمت إضافة:

```txt
seasonalRules
timeRules
```

وتشمل:

- رمضان.
- الأعياد.
- العودة إلى المدارس.
- الشتاء.
- الصيف.
- عروض نهاية الأسبوع.
- عروض المساء.
- المناسبات الخاصة.

الواجهة تعرضها الآن في قسم:

```txt
القواعد الموسمية والزمنية
```

---

### 9) المحتوى المثبت
تمت إضافة:

```txt
pinnedContent
```

يدعم تثبيت:

```txt
store
product
offer
wing
```

بصيغة:

```txt
type:id:priority:startAt:endAt:on/off
```

ويتم تطبيقه في:

- المتاجر المميزة.
- المنتجات المميزة.
- العروض الموسمية.

---

### 10) محاكي الواجهة الرئيسية
تم إنشاء محاكي:

```txt
lib/home-visibility-simulator.ts
```

وAPI:

```txt
/api/admin/home-visibility/simulate
```

ومن داخل الصفحة يستطيع الأدمن إدخال:

- نوع العنصر.
- ID العنصر.

ليعرف:

- هل سيظهر؟
- لماذا ظهر؟
- لماذا تم إخفاؤه؟
- ما القواعد التي أثرت عليه؟

---

### 11) سجل التدقيق Audit Log
الحفظ كان يسجل سابقاً في Audit Log، واستمر مدعوماً.

كما تمت إضافة تدقيق عند إعادة الحساب:

```txt
homepage_visibility_recalculate
```

---

### 12) زر إعادة حساب ترتيب الصفحة الرئيسية
تمت إضافة زر:

```txt
إعادة حساب ترتيب الصفحة الرئيسية
```

ويستدعي:

```txt
/api/admin/home-visibility/recalculate
```

يقوم بـ:

- حساب عينات المتاجر/المنتجات/العروض/الأجنحة.
- مسح كاش الصفحة الرئيسية.
- revalidate للصفحات:

```txt
/
/wings
/offers
```

---

### 13) Cache refresh
عند حفظ القواعد أو إعادة الحساب يتم:

- تحديث `system_settings`.
- تسجيل audit.
- revalidate.
- invalidate public cache tags.

---

## الملفات المعدلة/المضافة

### معدلة

```txt
lib/home-visibility.ts
components/admin/home-visibility-form.tsx
app/api/admin/home-visibility/route.ts
```

### جديدة

```txt
lib/home-visibility-simulator.ts
app/api/admin/home-visibility/simulate/route.ts
app/api/admin/home-visibility/recalculate/route.ts
docs/HOME_VISIBILITY_RULES_ENGINE_UPGRADE_2026-07-08.md
```

---

## الفحوصات

تم تشغيل:

```bash
NODE_OPTIONS=--max_old_space_size=4096 npm run typecheck
npm run lint
npm test
```

النتيجة:

```txt
typecheck: PASS
lint: PASS
tests: PASS
9 test files passed
23 tests passed
```

محاولة build داخل Arena:

```txt
SIGKILL
```

وهو نفس قيد الذاكرة المعروف في بيئة Arena.

---

## ملاحظات مهمة

- لم تتم إضافة migration جديدة؛ القواعد محفوظة كـ JSON داخل `system_settings` كما كان التصميم السابق.
- كل القواعد قابلة للتفعيل/الإيقاف من لوحة الأدمن.
- تم الحفاظ على backward compatibility؛ القواعد القديمة يتم تطبيعها وإكمال الحقول الجديدة تلقائياً عبر `normalizeHomeVisibilityRules`.

---

## النتيجة
أصبحت نافذة قواعد الظهور أقرب إلى محرك Enterprise منظم:

```txt
Home Visibility Rules Engine
```

يدعم:

- عدالة الظهور.
- منع الاحتكار.
- ranking score.
- أوزان قابلة للتعديل.
- محتوى مثبت.
- موسمية وزمنية.
- محاكي تفسير الظهور.
- إعادة حساب وتحديث كاش.

وبهذا تصبح الصفحة الرئيسية أكثر توازناً وذكاءً، مع سيطرة كاملة للأدمن دون تعديل الكود.
