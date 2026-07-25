# تقرير استكمال الصلاحيات الدقيقة لموظفي المتاجر والمنصة — 2026-07-02

## الهدف
استكمال فصل صلاحيات الإدارة عن صلاحيات التاجر/المتجر، وتوسيع صلاحيات موظفي المتجر بحيث يستطيع التاجر منح كل موظف صلاحيات حسب الإدارة/القسم بدل صلاحيات عامة قليلة.

## ما تم تنفيذه

### 1) فصل صارم بين صلاحيات المنصة وصلاحيات المتجر
- تم تحديث مصدر الحقيقة `lib/permission-scopes.ts` بحيث يمنع ظهور/منح صلاحيات المتجر داخل لوحة موظفي الإدارة.
- تم إضافة فلاتر آمنة:
  - `filterPlatformPermissionCodes`
  - `filterStorePermissionCodes`
- أي محاولة API لإرسال صلاحيات متجر لموظف منصة يتم تجاهلها/تنقيتها قبل الحفظ.
- أي محاولة API لإرسال صلاحيات منصة لموظف متجر يتم تجاهلها/تنقيتها قبل الحفظ.

### 2) منع إدارة أدوار المتاجر من لوحة الإدارة
- تم تشديد `/api/admin/rbac/roles` و`/api/admin/rbac/roles/[id]`:
  - لوحة الإدارة تنشئ وتعدل أدوار `system` فقط.
  - أدوار وصلاحيات المتاجر تدار من لوحة التاجر فقط.

### 3) توسيع صلاحيات موظفي المتجر حسب الإدارات
أُضيفت صلاحيات Store-scoped جديدة:

| الكود | الوصف | المجموعة |
|---|---|---|
| `product_taxonomy.manage` | إدارة أصناف ومتغيرات المنتجات | الكتالوج |
| `store_offers.manage` | إدارة عروض المتجر | التسويق |
| `store_coupons.manage` | إدارة كوبونات المتجر | التسويق |
| `store_ads.manage` | إدارة طلبات إعلانات المتجر | التسويق |
| `store_finance.view` | عرض مالية المتجر والتسويات | المالية |
| `store_payment_receipts.manage` | مراجعة إثباتات الدفع | المالية |
| `store_returns.manage` | إدارة المرتجعات والاسترداد | الطلبات |
| `store_shipping.manage` | إدارة شحن المتجر | التشغيل |
| `store_payments.manage` | إدارة وسائل دفع المتجر | التشغيل |

### 4) حماية APIs بالصلاحيات الجديدة مع توافق خلفي
تم تحديث عدة APIs لتقبل الصلاحيات الجديدة، مع إبقاء الصلاحيات القديمة كبديل حتى لا تتعطل الأدوار الحالية قبل تطبيق Migration:

- عروض المتجر:
  - `store_offers.manage` أو `announcements.manage`
- الكوبونات:
  - `store_coupons.manage` أو `announcements.manage`
- الإعلانات:
  - `store_ads.manage` أو صلاحيات تسويق/وسائط/إعدادات قائمة
- مالية المتجر:
  - `store_finance.view` أو `store_settings.manage`
- إثباتات الدفع:
  - `store_payment_receipts.manage` أو `orders.manage`
- المرتجعات:
  - `store_returns.manage` أو `orders.manage`
- الشحن:
  - `store_shipping.manage` أو `store_settings.manage`
- وسائل الدفع:
  - `store_payments.manage` أو `store_settings.manage`
- أصناف ومتغيرات المنتجات:
  - `product_taxonomy.manage` أو `store_settings.manage`

### 5) منع ربط مجموعة صلاحيات متجر خاطئة
- تم منع التاجر من ربط موظف بمجموعة صلاحيات لا تتبع متجره.
- كل مجموعة متجر يجب أن تحمل prefix خاص بالمتجر نفسه.

### 6) Migration جديد
تمت إضافة:

```txt
drizzle/0031_fine_grained_store_employee_permissions.sql
```

وظيفة Migration:
- إدخال الصلاحيات الجديدة داخل جدول `permissions`.
- منح دور `merchant` الأساسي الصلاحيات الجديدة حتى لا يفقد مالك المتجر صلاحياته.

> ملاحظة: لم يتم تشغيل seed. Migration فقط جاهز للتطبيق على قاعدة التجربة/النشر عند الحاجة.

## الاختبارات والفحص
تم تنفيذ الفحوصات التالية بنجاح:

```bash
npm run typecheck
npm run lint
npm test
NEXT_TELEMETRY_DISABLED=1 npm run build
```

النتيجة:
- TypeScript: ناجح.
- ESLint: ناجح.
- Vitest: 8 اختبارات ناجحة.
- Build إنتاجي: ناجح.

## ملفات مهمة تم تعديلها/إضافتها

```txt
lib/permission-scopes.ts
lib/rbac.ts
scripts/seed.ts
drizzle/0031_fine_grained_store_employee_permissions.sql
drizzle/meta/_journal.json
tests/permission-scopes.test.ts
app/api/admin/rbac/roles/route.ts
app/api/admin/rbac/roles/[id]/route.ts
app/api/admin/employees/route.ts
app/api/admin/employees/[id]/route.ts
app/api/merchant/employees/route.ts
app/api/merchant/employees/[id]/route.ts
app/api/merchant/employees/groups/route.ts
app/api/merchant/employees/groups/[id]/route.ts
components/merchant/employee-management-panel.tsx
```

## الحالة
النظام الآن أوضح وأكثر احترافية:
- الإدارة لا تمنح صلاحيات المتاجر.
- التاجر يدير موظفيه وصلاحياتهم من لوحة التاجر.
- صلاحيات المتجر صارت مقسمة إلى إدارات أكثر تفصيلاً.
- الحماية موجودة على مستوى الواجهة وAPI وليس الواجهة فقط.
