# تقرير تنفيذ: ربط قطاع الطلب بقوالب التاجر ونوع منتجات البداية

**التاريخ:** 2026-07-16  
**الحالة:** هذا التقرير يصف النسخة الأولى من الربط. تم استبدال اختيار القطاع المنفصل لاحقاً بربط الجناح مباشرةً بقالب واحد؛ راجع تقرير `WING_AS_SINGLE_ACTIVITY_SECTOR_IMPLEMENTATION_REPORT_2026-07-16_AR.md`. لم يُنشر أي منهما ولم تُطبق migrations على Staging أو Production.

## ما تم تنفيذه

### 1) اختيار قطاع النشاط في طلب فتح المتجر

- أضيف حقل **«قطاع النشاط لإعداد الكتالوج»** إلى:
  - طلب فتح المتجر الأول `/apply-store`.
  - طلب إضافة متجر/نشاط مستقل `/merchant/add-store`.
  - نموذج إعادة إرسال الطلب عند طلب تعديل من الإدارة.
- مصدر القائمة موحد: القوالب النظامية + القطاعات الإدارية النشطة فقط.
- أبقي حقل النشاط النصي باسم أوضح **«وصف النشاط التجاري»** لتسجيل تفاصيل التاجر، بينما القطاع المختار هو المرجع المنظم للقوالب.
- يتحقق الخادم من أن المفتاح المختار متاح ونشط؛ لا يكفي ما يصل من واجهة المتصفح.

### 2) حفظ القطاع ونقله إلى المتجر

- أضيفت migration `0080_onboarding_activity_template_scope`.
- تحفظ `merchant_applications.activity_template_key` اختيار الطلب.
- عند الاعتماد النهائي، ينسخ النظام الاختيار إلى `stores.activity_template_key` داخل transaction إنشاء المتجر.
- أضيفت فهارس مناسبة للحقول الجديدة.
- الحقول nullable لحماية التوافق: لم يُعد تصنيف أي متجر أو طلب قديم تلقائياً.

### 3) تقييد شاشة اقتراحات القطاع

- `GET /api/merchant/activity-templates` يعيد القالب المختار للمتجر فقط حين يكون المفتاح محفوظاً.
- الواجهة تعرض رسالة صريحة أن القطاع مرتبط بطلب فتح المتجر، ولا تعرض بقية القطاعات.
- `POST /api/merchant/activity-templates` يرفض على الخادم محاولة تطبيق قالب مختلف، حتى لو تم استدعاء API مباشرة.
- للمتاجر القديمة بلا مفتاح محفوظ: بقي السلوك القديم دون تغيير، لحين بناء مسار تعيين/تحويل مدقق مستقل.

### 4) تحديد نوع كل منتج بداية

عند تفعيل خيار «إضافة منتجات بداية Draft»، تظهر لكل منتج قائمة واضحة:

| الاختيار | الأثر عند إنشائه | الأثر عند النشر لاحقاً |
|---|---|---|
| للبيع الإلكتروني | مسودة بسعر 0 ومخزون 0 | يمكن أن تستخدم السلة والشراء بعد أن يضبط التاجر السعر/المخزون وينشره وفق الحواجز الحالية |
| للعرض والتواصل فقط | مسودة بسعر 0 ومخزون 0 | تبقى بلا سلة أو شراء إلكتروني وتستخدم واجهة التواصل الحالية |

- توجد أداة لتعيين نوع واحد لكل منتجات البداية ثم يمكن تعديل كل منتج منفرداً.
- حُفظ النوع الحقيقي في `products.product_commerce_type` خلال الإنشاء (`ONLINE_SALES` أو `SHOWCASE_ONLY`).
- لم يتغير أي سعر أو مخزون أو نشر تلقائياً، ولم تنشأ أي فاتورة أو قيد مالي.
- علامة منع التكرار تسجل نتيجة الإنشاء وأنماط المنتجات المختارة لأغراض التدقيق.

## ملفات رئيسية

```text
lib/merchant/activity-template-selection.ts
lib/merchant/activity-template-policy.ts
components/forms/store-application-form.tsx
components/applications/merchant-application-revision-form.tsx
components/merchant/activity-template-smart-panel.tsx
app/api/merchant-applications/route.ts
app/api/merchant-applications/[id]/route.ts
app/api/admin/merchant-applications/[id]/approve/route.ts
app/api/merchant/activity-templates/route.ts
lib/enterprise/product-intake.ts
lib/db/schema.ts
drizzle/0080_onboarding_activity_template_scope.sql
drizzle/meta/_journal.json
tests/activity-templates.test.ts
```

## التحقق المنفذ

| الفحص | النتيجة |
|---|---|
| `npm run lint` | ناجح |
| `NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck` | ناجح |
| `npm test` | ناجح: 60 ملفاً / 163 اختباراً |
| `npm run migrations:verify` | ناجح: 81 SQL / 81 journal entries |
| `npx drizzle-kit check --config=drizzle.config.ts` | ناجح |
| `npm run security:verify` | ناجح: فحص الأسرار وحراس مسارات الأدمن و`npm audit` بلا ثغرات عالية |
| `git diff --check` | ناجح |

## حدود متعمدة ومتابعة لاحقة

1. لم تُطبق migration على Staging أو Production، ولم يُختبر PostgreSQL حقيقي أو نشر.
2. لا يعيد التغيير تصنيف المتاجر القديمة. أي تحويل لها يحتاج wizard مدقق يختار القطاع ويشرح أثره ولا يغير كتالوجها تلقائياً.
3. تعطيل قطاع إداري يمنع اختياره في الطلبات الجديدة. إذا كان متجر قائم مرتبطاً بقطاع إداري معطل فستظهر له حالة عدم وجود قالب نشط؛ يلزم الأدمن إعادة التفعيل أو تنفيذ تحويل مدقق لاحقاً.
4. لم يغير هذا التغيير حواجز السلة/الطلب نفسها؛ استخدم نموذج `SHOWCASE_ONLY` والحواجز القائمة التي تمنع الشراء الإلكتروني لهذا النوع.
