# تقرير تنفيذ: اعتماد الجناح كقطاع نشاط واحد

**التاريخ:** 2026-07-16  
**الحالة:** مكتمل محلياً — غير مطبق على Staging أو Production

## ما تغير

- أزيل اختيار «قطاع النشاط لإعداد الكتالوج» المستقل من طلب فتح المتجر ومن طلب النشاط المستقل ومن إعادة إرسال الطلب.
- أصبح الحقل الوحيد للتصنيف هو **«الجناح / قطاع النشاط»**.
- يربط الأدمن كل جناح بقالب تجهيز واحد من صفحة **إدارة الأجنحة**.
- الخادم يشتق `activityTemplateKey` من الجناح، بدلاً من قبوله من المتصفح.
- لا تظهر للتاجر إلا أجنحة نشطة مرتبطة بقالب نشط.
- ينسخ المفتاح المستخرج إلى طلب التاجر ثم إلى المتجر عند الاعتماد، فتظل شاشة قوالب التاجر مقيدة بقطاعه.

## طبقة الأدمن

أضيفت قائمة «قالب تجهيز الجناح (قطاع التاجر)» إلى إنشاء الجناح وتعديله.

- إنشاء الجناح يتطلب القالب.
- تعديل الجناح يتحقق من أن القالب ما زال نشطاً.
- لا يسمح بفصل القالب عن جناح قائم؛ تعطيل الجناح هو المسار الصحيح إن لم يعد صالحاً لتقديم الطلبات.

## Migration

```text
0081_wing_is_single_activity_sector
```

تضيف `wings.activity_template_key` وفهرسها، مع backfill محدود لأسماء أجنحة seed الأصلية فقط:

```text
السوبرات → grocery
الإلكترونيات → electronics
الأزياء → fashion
الصيدليات → pharmacy
المطاعم → restaurant
مواد البناء → hardware-building
```

لا تخمن migration علاقة أي جناح آخر ولا تعيد تصنيف متاجر قائمة.

## ملفات رئيسية

```text
lib/onboarding/wing-template-assignment.ts
lib/db/schema.ts
lib/validators.ts
components/forms/store-application-form.tsx
components/applications/merchant-application-revision-form.tsx
app/api/merchant-applications/route.ts
app/api/merchant-applications/[id]/route.ts
app/admin/wings/page.tsx
components/admin/wing-form.tsx
components/admin/wing-edit-form.tsx
app/api/admin/wings/route.ts
app/api/admin/wings/[id]/route.ts
drizzle/0081_wing_is_single_activity_sector.sql
scripts/seed.ts
```

## التحقق المنفذ

| الفحص | النتيجة |
|---|---|
| `npm run lint` | ناجح |
| `NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck` | ناجح |
| `npm test` | ناجح: 60 ملفاً / 163 اختباراً |
| `npm run migrations:verify` | ناجح: 82 SQL / 82 journal entries |
| `npx drizzle-kit check --config=drizzle.config.ts` | ناجح |
| `npm run security:verify` | ناجح: فحص الأسرار وحراس مسارات الأدمن و`npm audit` بلا ثغرات عالية |
| `git diff --check` | ناجح |

لا يوجد اختبار PostgreSQL حي أو Staging أو Production في هذه البيئة، ولم يتم تطبيق migration أو نشر أي تغيير.
