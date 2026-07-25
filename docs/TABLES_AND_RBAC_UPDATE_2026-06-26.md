# تقرير تعميم الجداول وتطوير نظام الموظفين والصلاحيات — 2026-06-26

## تم تنفيذ تعميم الجداول والفلترة

تم تحويل القوائم التالية إلى جداول أخف مع بحث وفلترة وصفحات:

```txt
/admin/stores
/admin/products
/admin/users
/admin/merchant-applications
/merchant/products
/merchant/orders
/merchant/inventory
/merchant/offers
```

### التحسينات العامة

- حذف البطاقات الطويلة في القوائم ذات النمو المتوقع.
- اعتماد جداول سريعة بدلاً من عرض بيانات كثيرة مرة واحدة.
- إضافة بحث وفلترة.
- إضافة Pagination بحد 50 نتيجة في الصفحة.
- إزالة الصور غير الضرورية من صفحات الإدارة.

---

## نظام موظفي المنصة

تمت إضافة شاشة جديدة:

```txt
/admin/employees
```

وتشمل:

- اسم الموظف.
- البريد/بيانات الدخول.
- الهاتف.
- الرقم الوظيفي.
- الوظيفة.
- المجموعة/الإدارة مثل المبيعات أو التسويق أو الحسابات.
- الحالة: مفعل / قيد الانتظار / موقوف / محذوف.
- مجموعة صلاحيات يرث منها الموظف.
- صلاحيات مباشرة قابلة للإضافة والحذف.
- زر إيقاف يعطل صلاحيات الموظف وبيانات دخوله.

### API جديدة لموظفي المنصة

```txt
/api/admin/employees
/api/admin/employees/[id]
```

كلها محمية بـ:

```txt
requireAuth
assertAdmin
```

---

## نظام موظفي المتجر

تم تطوير شاشة:

```txt
/merchant/employees
```

لتشمل:

- موظفو المتجر في جدول سريع.
- الرقم الوظيفي.
- الوظيفة.
- البريد/بيانات الدخول.
- المجموعة.
- الصلاحيات المباشرة.
- تعديل الصلاحيات للموظف مباشرة.
- إيقاف الموظف يعطل صلاحياته.

### مجموعات صلاحيات المتجر

تمت إضافة مجموعات صلاحيات داخل شاشة موظفي المتجر:

- يستطيع التاجر إنشاء مجموعة مثل:
  - مجموعة المبيعات.
  - مجموعة التسويق.
  - مجموعة الحسابات.
- يستطيع تحديد صلاحيات المجموعة.
- عند إضافة موظف يمكن اختيار المجموعة فيرث صلاحياتها.
- يمكن إضافة صلاحيات مباشرة للموظف فوق صلاحيات المجموعة.

### APIs جديدة لمجموعات موظفي المتجر

```txt
/api/merchant/employees/groups
/api/merchant/employees/groups/[id]
```

---

## تعديل قاعدة البيانات

تمت إضافة migration جديدة:

```txt
0017_lethal_morbius.sql
```

وتضيف:

```txt
platform_employees
store_employees.group_role_id
```

الهدف:

- تخزين بيانات موظفي المنصة بشكل احترافي.
- ربط موظف المنصة بمجموعة صلاحيات ودور مباشر.
- ربط موظف المتجر بمجموعة صلاحيات.

---

## فحوصات الحماية

بعد الإضافة:

```txt
Admin API routes: 67
كلها تحتوي assertAdmin
Merchant API routes: 38
كلها تحتوي requireAuth
```

---

## أوامر الفحص المنفذة

```bash
npm run typecheck
npm run lint
npm run build
npm run test
npm run check:paths
npx drizzle-kit check --config=drizzle.config.ts
npm audit --audit-level=high
```

النتيجة:

```txt
TypeScript: ناجح
Lint: ناجح
Build: ناجح
Tests: ناجحة 6/6
Drizzle check: ناجح
Path check: ناجح
```

ملاحظة:

```txt
npm audit
```

لا توجد High/Critical. توجد Moderate في exceljs/uuid ولم يتم استخدام --force حتى لا يكسر exceljs.

---

## ملاحظات تشغيل مهمة

بعد النشر يجب تشغيل migration على قاعدة البيانات:

```bash
npm run db:migrate
```

أو إذا كنت تستخدم Vercel/Render حسب إعداداتك، شغّل migration من بيئة متصلة بنفس DATABASE_URL.

بدون migration ستفشل صفحات الموظفين الجديدة لأن جدول platform_employees وعمود group_role_id غير موجودين بعد.
