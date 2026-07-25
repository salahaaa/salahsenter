# تقرير فحص شامل وعميق للمنصة — 2026-06-26

## نطاق الفحص

تم تنفيذ فحص شامل للمنصة عامة، مع تركيز خاص على التعديلات التي تمت خلال آخر 24 ساعة، خصوصاً:

- إعدادات إظهار/إخفاء أقسام الرئيسية.
- تهيئة المتجر قبل إضافة المنتجات.
- إعادة صياغة المتغيرات والوحدات في بطاقة المنتج.
- تحويل إدارة المتاجر والمنتجات إلى جداول سريعة مع بحث وفلترة.
- منع ظهور أرقام المتاجر في الواجهات العامة.
- صلاحيات API الخاصة بالأدمن والتاجر.
- جاهزية البناء والنشر.

---

## أوامر الفحص المنفذة

تم تنفيذ الأوامر التالية بنجاح:

```bash
npm install
npm run typecheck
npm run lint
npm run test
npm run check:paths
npx drizzle-kit check --config=drizzle.config.ts
npm run build
npm audit --audit-level=high
```

### النتيجة

- TypeScript: ناجح.
- ESLint: ناجح.
- Tests: ناجحة 6/6.
- Drizzle schema check: ناجح.
- Build production: ناجح.
- Path check: ناجح.
- npm audit high: لا توجد ثغرات High/Critical.
- توجد ثغرتان Moderate عبر `exceljs -> uuid`، وحلها المقترح من npm يتطلب `--force` وسيخفض/يكسر `exceljs`، لذلك لم يتم استخدامه.

---

## ملخص ملفات آخر 24 ساعة المهمة

أهم الملفات التي ظهرت ضمن التعديلات/الفحص خلال آخر 24 ساعة:

```txt
app/admin/products/page.tsx
app/admin/stores/page.tsx
app/api/admin/home-visibility/route.ts
app/api/auth/forgot-password/route.ts
app/api/auth/google/callback/route.ts
app/api/auth/google/route.ts
app/api/merchant/product-intake/bulk-save/route.ts
app/api/merchant/products/route.ts
app/api/merchant/store-settings/route.ts
app/merchant/product-taxonomy/page.tsx
app/merchant/products/page.tsx
app/merchant/settings/page.tsx
app/offers/page.tsx
app/api/search/home/route.ts
components/admin/home-visibility-form.tsx
components/admin/store-management-panel.tsx
components/auth/login-form.tsx
components/home/luxury-marketplace-home.tsx
components/home/store-marquee.tsx
components/merchant/merchant-setup-gate.tsx
components/merchant/product-engine-form.tsx
components/merchant/product-taxonomy-form.tsx
lib/enterprise/product-intake.ts
lib/home-visibility.ts
lib/merchant-readiness.ts
lib/validators.ts
package-lock.json
```

---

## فحص التعديلات الأخيرة

### 1. إدارة المتاجر في الأدمن

تم التأكد من أن صفحة:

```txt
/admin/stores
```

أصبحت:

- جدول سريع بدلاً من بطاقات طويلة.
- بدون تحميل شعار المتجر أو صورة الغلاف.
- تحتوي بحث باسم المتجر/التاجر/البريد/الهاتف/الرقم الداخلي.
- تحتوي فلترة بالحالة والجناح.
- تحتوي Pagination بحد 50 متجر للصفحة.
- تفاصيل المتجر لا تظهر إلا عند الضغط على زر تفاصيل/تعديل.

تم التأكد أيضاً بعد الفحص أن الملفات التالية لا تحتوي على تحميل صور في قائمة الإدارة:

```txt
app/admin/stores/page.tsx
components/admin/store-management-panel.tsx
```

### 2. قائمة منتجات التاجر

تم التأكد من أن صفحة:

```txt
/merchant/products
```

أصبحت:

- نموذج إضافة المنتج بالأعلى.
- قائمة المنتجات بالأسفل أصبحت جدولاً سريعاً.
- بدون صور منتجات في القائمة.
- بحث باسم الصنف/الكود/الباركود/الرابط.
- فلترة بالحالة والقسم.
- Pagination بحد 50 صنف للصفحة.

### 3. إدارة منتجات الأدمن

تم تحويل صفحة:

```txt
/admin/products
```

إلى جدول رقابي سريع بدون صور، مع:

- بحث باسم المنتج/الكود/الباركود/اسم المتجر.
- فلترة بالحالة.
- Pagination.
- زر معاينة.
- زر إيقاف مخالف + إنذار.

### 4. المتغيرات والوحدات في المنتج

تم التأكد أن بطاقة المنتج لم تعد تعرض كل المتغيرات مرة واحدة، بل تعمل بالطريقة الصحيحة:

1. اختيار المتغير من قائمة.
2. ظهور قيم المتغير المختار فقط.
3. إمكانية إضافة أكثر من متغير.
4. توليد التركيبات.
5. اختيار وحدة بيع لكل تركيبة.

كما تم التأكد أن الوحدات أصبحت واضحة مثل:

```txt
حبة
كيس
كرتون = 20 حبة
درزن = 12 حبة
```

### 5. منع حفظ منتج ناقص

تم فحص API:

```txt
app/api/merchant/products/route.ts
```

والتحقق من وجود قيود:

- لا حفظ بدون قسم.
- لا حفظ بدون متغيرات وقيمها.
- لا حفظ بدون وحدة بيع لكل تركيبة.
- لا قبول وحدة بيع غير تابعة للمتجر.
- لا قبول قيمة متغير غير تابعة للمتجر.
- لا قبول أكثر من قيمة لنفس المتغير داخل نفس التركيبة.

### 6. إخفاء رقم المتجر من الواجهات العامة

أثناء الفحص وُجد أن البحث السريع العام كان ما زال يستدعي رقم المتجر في:

```txt
app/api/search/home/route.ts
```

وتم إصلاحه أثناء الفحص:

- لم يعد البحث العام يبحث برقم المتجر.
- لم يعد يرجع رقم المتجر كـ badge أو subtitle.

كما تم إزالة رقم المتجر من بيانات الصفحة العامة للعروض والرئيسية:

```txt
app/offers/page.tsx
lib/home-visibility.ts
components/home/luxury-marketplace-home.tsx
components/home/store-marquee.tsx
```

> بقي رقم المتجر موجوداً في أماكن داخلية أو خاصة مثل الأدمن، لوحة التاجر، العقود، الفواتير، واستعادة كلمة المرور، وهذا طبيعي لأنه ليس واجهة عامة مفتوحة.

### 7. إعدادات إظهار/إخفاء الرئيسية

تم فحص ملفات:

```txt
lib/home-visibility.ts
app/api/admin/home-visibility/route.ts
components/admin/home-visibility-form.tsx
components/home/luxury-marketplace-home.tsx
```

والنتيجة:

- إعدادات sections مضافة.
- API يقبل sections.
- واجهة الأدمن تعرض مفاتيح إظهار/إخفاء أقسام الرئيسية.
- الواجهة الرئيسية تقرأ القيم وتخفي الأقسام حسب الإعداد.
- لا تحتاج Migration لأنها مخزنة في system_settings.

---

## فحص الصلاحيات والأمان

### Admin APIs

تم فحص مسارات الأدمن:

```txt
app/api/admin/**/route.ts
```

النتيجة:

- عدد routes: 65.
- كلها تحتوي `requireAuth`.
- كلها تحتوي `assertAdmin`.

### Merchant APIs

تم فحص مسارات التاجر:

```txt
app/api/merchant/**/route.ts
```

النتيجة:

- عدد routes: 36.
- كلها تحتوي `requireAuth`.
- 33 route تحتوي تحقق مباشر من المتجر/الصلاحية.
- 3 routes تعتمد على دوال داخلية تستقبل `session.userId` وتتحقق من ربط التاجر بمتاجره:
  - `app/api/merchant/ai-assistant/route.ts`
  - `app/api/merchant/branches/route.ts`
  - `app/api/merchant/branches/copy-settings/route.ts`

لا توجد Admin API مكشوفة بدون مصادقة حسب الفحص النصي.

---

## فحص الأداء والقوائم الثقيلة

تم تحسين القوائم التالية:

```txt
/admin/stores
/admin/products
/merchant/products
```

لكن الفحص الشامل وجد قوائم أخرى ما زالت تستخدم حد 100 أو 120 وبطاقات/قوائم طويلة وقد تحتاج نفس المعالجة لاحقاً:

```txt
app/admin/cms/page.tsx
app/admin/default-media/page.tsx
app/admin/merchant-applications/page.tsx
app/admin/news/page.tsx
app/admin/offers/page.tsx
app/admin/stores/frozen/page.tsx
app/admin/subscriptions/page.tsx
app/admin/users/page.tsx
app/merchant/inventory/page.tsx
app/merchant/offers/page.tsx
app/merchant/orders/page.tsx
app/orders/page.tsx
app/notifications/page.tsx
app/offers/page.tsx
```

هذه ليست أخطاء بناء، لكنها تحسينات أداء مطلوبة إذا كبر حجم البيانات.

---

## فحص النشر الحالي على Vercel

تم فحص صفحات عامة من المشروع الأساسي:

```txt
https://salahsentar22.vercel.app/
https://salahsentar22.vercel.app/wings
https://salahsentar22.vercel.app/offers
```

النتائج:

```txt
/       status 200 — bytes 199,531 — data:image = 0 — inline_media = 64 — النص الجديد موجود — النص القديم غير موجود
/wings  status 200 — bytes 54,549  — data:image = 0 — inline_media = 16
/offers status 200 — bytes 34,793  — data:image = 0 — inline_media = 0
```

هذا يؤكد أن المشروع المنشور الأساسي يعمل، وأن الصفحة الرئيسية لم تعد تحتوي `data:image` في HTML، والنص القديم تم استبداله في النشر الحالي.

---

## فحص البناء وحجم الصفحات المهمة

من نتيجة build:

```txt
/                                9.91 kB    First Load JS 134 kB
/admin/stores                    4.4 kB     First Load JS 126 kB
/admin/products                  4.11 kB    First Load JS 122 kB
/merchant/products               7.37 kB    First Load JS 129 kB
/merchant/product-taxonomy       8.74 kB    First Load JS 126 kB
/store/[slug]                    12.9 kB    First Load JS 131 kB
/store/[slug]/products/[slug]    9.68 kB    First Load JS 127 kB
```

النتيجة جيدة، ولا توجد مشكلة Build.

---

## فحص النص القديم في الرئيسية

تم التأكد أن النص القديم غير موجود:

```txt
الخريطة والبحث بالصور بدون استهلاك مساحة الواجهة
```

والنص الجديد موجود:

```txt
أدوات سريعة للوصول والتسوق الذكي
```

في:

```txt
components/home/smart-mall-experience.tsx
```

---

## ملاحظات مهمة قبل النشر

1. لا تستخدم:

```bash
npm audit fix --force
```

لأنه سيغير `exceljs` بشكل قد يكسر التصدير/الاستيراد.

2. بعد حذف `node_modules` يجب استخدام:

```bash
npm install
```

3. تأكد أن Vercel مربوط بالمشروع الصحيح:

```txt
https://salahsentar22.vercel.app/
```

وليس المشروع الآخر.

---

## المتبقي المقترح للمرحلة التالية

الأولوية القادمة المقترحة:

1. تحويل القوائم الثقيلة المتبقية إلى جداول مع بحث وفلترة وصفحات:
   - المستخدمون.
   - الطلبات.
   - الإشعارات.
   - العروض.
   - طلبات فتح المتاجر.
   - المخزون.

2. إضافة فحص E2E عملي على بيئة Vercel بعد النشر:
   - تسجيل دخول أدمن.
   - حفظ إعدادات إظهار/إخفاء الرئيسية.
   - إنشاء تاجر/متجر تجريبي.
   - تهيئة العملة والوحدات والمتغيرات.
   - إنشاء منتج متغير.
   - التأكد من ظهور المنتج للعميل.

3. تحسين نظام الوحدات في مرحلة لاحقة بإضافة تحويل كمي رسمي:

```txt
1 كرتون = 20 حبة
1 درزن = 12 حبة
```

حتى يخدم المخزون والحسابات تلقائياً.

---

## الحكم العام

حالة المشروع الحالية بعد الفحص:

```txt
جاهز للبناء والنشر من ناحية TypeScript/Lint/Build/Drizzle/Tests.
التعديلات الأخيرة سليمة تقنياً.
تحسينات الأداء الأخيرة في إدارة المتاجر والمنتجات صحيحة.
لا توجد أخطاء Build.
لا توجد Admin APIs مكشوفة بدون حماية حسب الفحص النصي.
توجد تحسينات أداء متبقية في صفحات قوائم أخرى قبل التوسع الكبير.
```
