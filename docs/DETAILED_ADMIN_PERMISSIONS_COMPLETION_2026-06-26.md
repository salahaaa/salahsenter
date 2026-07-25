# تقرير استكمال تعميم الصلاحيات التفصيلية على وحدات الأدمن — 2026-06-26

## الهدف

استكمال ما تبقى من نظام الصلاحيات بحيث لا تبقى وحدات الأدمن تعتمد على دخول عام فقط، بل على صلاحيات تفصيلية حسب كل وحدة.

---

## ما تم تنفيذه

### 1. تعميم الصلاحيات التفصيلية على جميع API الخاصة بالأدمن

تم فحص جميع مسارات:

```txt
app/api/admin/**/route.ts
```

وتم التأكد أن كل مسار أصبح يستخدم:

```ts
await assertAdmin(session, "permission.code")
```

بدلاً من:

```ts
await assertAdmin(session)
```

### 2. تعميم الحماية التفصيلية على صفحات الأدمن

تم فحص جميع صفحات:

```txt
app/admin/**/page.tsx
```

وتم إضافة فحص صلاحيات تفصيلي لكل صفحة، مثل:

```ts
await assertAdmin(session, "cms.manage")
await assertAdmin(session, "ads.manage")
await assertAdmin(session, "contracts.manage")
await assertAdmin(session, "security.manage")
```

### 3. فلترة كروت لوحة الأدمن الرئيسية

تم تحديث:

```txt
app/admin/page.tsx
```

حتى لا تظهر كل الوحدات لأي موظف منصة، بل تظهر له فقط الوحدات التي يملك صلاحيتها.

الـ super_admin يرى كل شيء.

موظف المنصة يرى الوحدات حسب صلاحياته الفعلية.

---

## الصلاحيات الجديدة المضافة

تمت إضافة صلاحيات تفصيلية جديدة لدعم كل الوحدات:

```txt
home.manage
branches.manage
ads.manage
offers.manage
notifications.manage
security.manage
users.manage
subscriptions.manage
tenants.manage
default_media.manage
```

وتمت إضافتها إلى:

```txt
lib/rbac.ts
scripts/seed.ts
drizzle/0018_precise_admin_permissions.sql
```

---

## Migration جديدة

تم إنشاء migration لإضافة الصلاحيات الجديدة إلى قواعد البيانات الموجودة:

```txt
drizzle/0018_precise_admin_permissions.sql
```

هذه migration تضيف الصلاحيات الجديدة إلى جدول:

```txt
permissions
```

بدون تغيير بنية الجداول.

---

## خريطة الصلاحيات التفصيلية

```txt
/admin/master                  -> master.manage
/admin/theme-builder           -> theme.manage
/admin/home-builder            -> home.manage
/admin/home-visibility         -> home.manage
/admin/cms                     -> cms.manage
/admin/contracts               -> contracts.manage
/admin/commissions-taxes       -> commissions.manage
/admin/notifications-center    -> notifications.manage
/admin/rbac-builder            -> roles.manage
/admin/roles                   -> roles.manage
/admin/employees               -> roles.manage
/admin/wings                   -> wings.manage
/admin/merchant-applications   -> merchant_applications.manage
/admin/stores                  -> stores.manage
/admin/settings                -> admin.settings.manage
/admin/ads                     -> ads.manage
/admin/ads-platform            -> ads.manage
/admin/offers                  -> offers.manage
/admin/news                    -> news.manage
/admin/geography               -> geography.manage
/admin/users                   -> users.manage
/admin/products                -> products.manage
/admin/audit-log               -> security.manage
/admin/default-media           -> default_media.manage
/admin/subscriptions           -> subscriptions.manage
/admin/backups                 -> backups.manage
/admin/reports                 -> reports.view
/admin/security                -> security.manage
/admin/tenants                 -> tenants.manage
/admin/branches                -> branches.manage
```

---

## فحص النتائج

تم تنفيذ:

```bash
npm run typecheck
npm run lint
npm run test
npm run check:paths
npx drizzle-kit check --config=drizzle.config.ts
npm run build
npm audit --audit-level=high
```

النتائج:

```txt
TypeScript: ناجح
Lint: ناجح
Tests: ناجحة 6/6
Path check: ناجح
Drizzle check: ناجح
Production build: ناجح
```

فحص الصلاحيات:

```txt
Admin API routes: 67
كلها تستخدم assertAdmin بصلاحية تفصيلية

Admin pages:
كلها تحتوي فحص assertAdmin
```

---

## ملاحظة audit

لا توجد High/Critical.

الموجود فقط:

```txt
2 moderate عبر exceljs -> uuid
```

ولم يتم استخدام:

```bash
npm audit fix --force
```

لأنه يكسر/يخفض exceljs.

---

## مهم قبل النشر

بسبب وجود migrations جديدة:

```txt
0017_lethal_morbius.sql
0018_precise_admin_permissions.sql
```

يجب تشغيل:

```bash
npm run db:migrate
```

بعد رفع الكود وقبل الاعتماد النهائي على الموقع.
