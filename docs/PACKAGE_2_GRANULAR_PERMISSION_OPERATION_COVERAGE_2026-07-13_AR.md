# تقرير الحزمة 2 — ربط الصلاحيات الدقيقة بالعمليات

**التاريخ:** 2026-07-13  
**الحالة:** منجزة للعمليات عالية الخطورة والأساسية، مع سجل صريح لباقي التحويلات التاريخية.

## ما تم تنفيذه

### Policy مركزي لقرارات العملية

تمت إضافة سياسات تشغيلية في:

```text
lib/rbac.ts
```

- `ADMIN_OPERATION_PERMISSIONS`
- `STORE_OPERATION_PERMISSIONS`
- `assertAdminOperation()`
- `userHasStoreOperation()`

كل عملية تملك:

```text
صلاحية دقيقة جديدة
+ fallback لصلاحية الدور القديمة
```

مثال:

```text
ads.approve        → ads.approve + ads.manage
stores.suspend     → stores.suspend + stores.manage
store.orders.shipment.manage + orders.manage
```

الـ fallback مقصود ومؤقت: يمنع انقطاع الأدوار الموجودة، لكن أي موظف جديد يعتمد على الصلاحية الدقيقة فقط.

### توسيع الكتالوج وMigration

تمت إضافة migration:

```text
drizzle/0058_permission_operation_coverage.sql
```

وتشمل الصلاحيات الناقصة التي اكتشفها تدقيق المسارات، منها:

```text
providers.view
store.products.export
store.products.lifecycle.manage
store.products.showcase.manage
store.orders.shipment.manage
store.orders.payment.manage
store.finance.withdrawals.manage
store.returns.manage
store.payments.view
store.shipping.view
```

### APIs تم تحويلها

#### الأدمن

- الحملات الإعلانية: عرض، اعتماد، رفض، إيقاف، تمييز البنر، وتحليل AI.
- الإعلانات والبانرات: عرض، إنشاء، تعديل وحذف.
- المتاجر: عرض، إنشاء/اعتماد، تعديل، تفعيل، إيقاف وإغلاق.
- مزودو الخدمات المالية: عرض، إضافة، تعديل، إيقاف وحذف.
- المالية: عرض، تصدير، سحوبات، والإقفال المالي.
- إعدادات النظام.
- عمليات Product Moderation وProduct Lifecycle في لوحة الأدمن.
- إدارة التكاملات وERP: العملاء، المفاتيح، mappings، الشهادات، reconciliation وERP mode.

#### التاجر

- تصدير المنتجات، lifecycle، حالة منتجات العرض، وأسئلة المنتج.
- الجرد الدوري وتطبيق تسويات المخزون.
- شحن الطلبات وحالة الدفع وإثباتات الدفع والمرتجعات.
- مالية المتجر وطلبات السحب.
- عرض/إدارة وسائل الدفع والشحن.
- مساعد الإعلان الذكي.

### إخفاء الأزرار غير المصرح بها

تمت إضافة:

```text
app/api/auth/permissions/route.ts
components/permissions/permission-gate.tsx
```

- الواجهة تقرأ الصلاحيات الفعالة الحديثة من DB.
- `PermissionGate` يخفي أزرار لا يملك المستخدم صلاحيتها، مع بقاء API هو الحارس النهائي.
- رُبطت كبداية بأزرار اعتماد/رفض/إيقاف الإعلانات وبأزرار تفعيل/إيقاف المتاجر، إضافة إلى عمليات المزودين الماليين.

## ما تم تدقيقه ولم يُدعَ اكتماله بعد

ما زالت بعض المسارات التاريخية تستخدم صلاحيات module عامة أثناء مرحلة التوافق، وأهمها:

```text
الكوبونات والعروض
التصنيف والخصائص product taxonomy
الأخبار والإعلانات الداخلية للمتجر
إعدادات تشغيل المتجر وبعض قوالب النشاط
بعض صفحات observability والأمان غير المرتبطة مباشرة بمصفوفة الموظفين
```

هذه ليست ثغرة لتجاوز نطاق المتجر؛ ما زالت محمية بصلاحيات عامة و`storeId`، لكنها لا تحقق بعد مستوى زر/عملية المطلوب. ستنقل ضمن مسار التحويل المتبقي قبل إزالة fallback القديم.

## الاختبارات

اختبار جديد:

```text
tests/operation-permission-policy.test.ts
```

يغطي خرائط الاعتماد الأساسية للأدمن والتاجر.

```text
npm run lint                                      PASS
NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck   PASS
npm test                                          PASS — 34 ملفات / 98 اختباراً
npm run migrations:verify                         PASS — 59 SQL / 59 journal entries
npx drizzle-kit check                             PASS
npm run security:verify                           PASS
git diff --check                                  PASS
```

## شرط النشر

يجب تطبيق migration `0058_permission_operation_coverage.sql` قبل منح الصلاحيات الجديدة من واجهة الإدارة. لم تُطبق أي migration على Production في هذه البيئة.
