# Code Audit — Next.js + TypeScript + Tailwind + Drizzle ORM

تاريخ إعادة الفحص: 2026-06-17

## 1) ملخص تنفيذي

تمت إعادة الفحص بعد تجهيز المشروع للنشر على GitHub و Vercel، وتم تنفيذ تحسينات أمنية وفنية قبل إعادة الاختبار:

- ترقية Next.js من 14 إلى `15.5.18`.
- ترقية `drizzle-orm` إلى `0.45.2`.
- ترقية `drizzle-kit` إلى `0.31.10`.
- ترقية `postcss` المباشر إلى `8.5.10`.
- تحديث كود `cookies()` و `headers()` ليتوافق مع Next 15.
- تحديث dynamic route handlers لتوافق Next 15 حيث أصبحت `params` Promise.
- تقييد `next.config.mjs` وإزالة wildcard image hosts.
- إضافة security headers.
- حماية Contract API باستخدام token hash أو ملكية المستخدم أو صلاحية الأدمن.
- إصلاح Media Assets API حتى لا يعرض كل الوسائط لأي مستخدم مسجل.
- إضافة GitHub Actions CI.
- إضافة `vercel.json` ودليل نشر Vercel/GitHub.

## 2) أوامر الفحص التي تم تشغيلها

```bash
npm run lint
npm run typecheck
npx drizzle-kit check --config=drizzle.config.ts
npm run build
npm audit --audit-level=high
```

## 3) نتائج الفحص الحالية

### ESLint

```txt
Passed — no warnings or errors
```

### TypeScript

```txt
Passed — tsc --noEmit completed successfully
```

### Next.js Build

```txt
Passed — Next.js 15.5.18 build completed successfully
```

### Drizzle Check

```txt
Everything's fine
```

### npm audit

```txt
npm audit --audit-level=high: Passed
```

الفحص الكامل ما زال يعرض تحذيرين `moderate` مرتبطين بـ `next/node_modules/postcss` حسب npm audit. لا توجد حالياً ثغرات high أو critical بعد التحديث.

## 4) فحص ملفات API الخاصة بـ Next.js

عدد API routes الحالي:

```txt
49
```

لا توجد Route conflicts ظاهرة، وكل routes تم بناؤها بنجاح ضمن `next build`.

### إصلاحات تمت

#### Contract API

الملف:

```txt
app/api/merchant-applications/[id]/contract/route.ts
```

تمت حمايته عبر:

- token عشوائي يتم إنشاؤه عند تقديم الطلب.
- تخزين hash فقط في قاعدة البيانات.
- قبول الوصول إذا كان المستخدم صاحب الطلب أو Super Admin أو يحمل token صحيحاً.

#### Media Assets API

الملف:

```txt
app/api/media/assets/route.ts
```

تم منع المستخدم غير الأدمن من عرض كل الوسائط. الآن يجب تحديد `storeId` والتحقق من صلاحية الوصول للمتجر.

#### Next 15 Route Handler Params

تم تحديث dynamic route handlers لتستخدم:

```ts
context: { params: Promise<...> }
```

بدلاً من النمط القديم.

## 5) فحص Drizzle ORM وقاعدة البيانات

### الحالة

- Drizzle schema صالح.
- migrations متولدة وموجودة.
- `drizzle-kit check` ناجح.

الجداول الحالية:

```txt
44 tables
```

migrations:

```txt
drizzle/0000_blushing_green_goblin.sql
drizzle/0001_short_azazel.sql
drizzle/0002_massive_thunderbolt_ross.sql
drizzle/0003_cool_sersi.sql
```

### ملاحظات متبقية على قاعدة البيانات

#### 1. `user_roles` مع `storeId = null`

PostgreSQL يسمح بتكرار unique rows عندما يوجد `NULL` ضمن الأعمدة.

الموقع:

```txt
lib/db/schema.ts
```

الفهرس:

```ts
uniqueIndex("user_roles_assignment_unique").on(table.userId, table.roleId, table.storeId)
```

التوصية المستقبلية:

- استخدام partial unique indexes.
- أو فصل system roles عن store-scoped roles.

#### 2. `createdStoreId` ليس FK

الحقل موجود داخل `merchant_applications` لكنه ليس foreign key إلى `stores.id`.

التوصية:

- جعله FK إذا لم توجد مشكلة circular dependency.

#### 3. `categories.parentId` ليس FK ذاتي

التوصية:

- إضافة self-referencing FK عند تثبيت بنية التصنيفات.

#### 4. `product_variants.sku` فريد global

قد يتعارض تاجران إذا استخدما نفس SKU.

التوصية:

- جعله unique على مستوى المتجر أو المنتج بدلاً من المنصة كلها.

## 6) فحص الحزم Dependencies

### الحزم المهمة الحالية

```txt
next: ^15.5.18
drizze-orm: ^0.45.2
drizzle-kit: ^0.31.10
react: ^18.3.1
react-dom: ^18.3.1
typescript: ^5.7.2
```

### نتيجة npm audit

- لا توجد high أو critical عند استخدام:

```bash
npm audit --audit-level=high
```

- يوجد تحذيران moderate مرتبطان بـ PostCSS داخل Next package حسب npm audit.

### ملاحظة

تمت إضافة overrides:

```json
"overrides": {
  "esbuild": "0.28.1",
  "next": {
    "postcss": "8.5.10"
  }
}
```

لكن npm audit ما زال يرصد نسخة PostCSS داخل حزمة Next. هذا تحذير transitive moderate، وليس high/critical حالياً.

## 7) تحسينات أمنية تمت

### 1. JWT Secret

تم تعديل `lib/auth.ts` و `middleware.ts` بحيث يتم رمي خطأ في production إذا لم يتم ضبط:

```env
JWT_SECRET
```

### 2. Image Remote Patterns

تم إزالة wildcard:

```ts
hostname: "**"
```

وأصبح الضبط عبر:

```env
NEXT_IMAGE_REMOTE_HOSTS=res.cloudinary.com,your-cdn.example.com
```

### 3. Security Headers

تمت إضافة headers في `next.config.mjs`:

- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`

### 4. Contract Token

تمت إضافة:

```txt
contract_access_token_hash
```

إلى جدول `merchant_applications` عبر migration:

```txt
drizzle/0003_cool_sersi.sql
```

## 8) GitHub/Vercel Readiness

تمت إضافة:

```txt
.github/workflows/ci.yml
vercel.json
docs/DEPLOYMENT_VERCEL_GITHUB.md
```

CI يقوم بتشغيل:

```bash
npm ci
npm run lint
npm run typecheck
npx drizzle-kit check --config=drizzle.config.ts
npm run build
npm audit --audit-level=high
```

## 9) ملاحظات متبقية قبل Production كامل

هذه ليست مانعة للبناء أو النشر التجريبي، لكنها مهمة للإنتاج:

1. إضافة Rate Limiting لمسارات login/register/upload/contract.
2. إضافة CSRF أو Origin validation للطلبات التي تعدل البيانات.
3. تطبيق RBAC permissions الدقيقة داخل كل API، وليس فقط `hasStoreAccess`.
4. عدم تخزين كلمة المرور المؤقتة داخل notifications لفترة طويلة أو تخزينها مشفرة.
5. إضافة magic bytes validation للملفات المرفوعة.
6. نقل backup storage إلى S3/R2 في الإنتاج بدلاً من local filesystem.
7. مراجعة FK/unique constraints المذكورة أعلاه.

## 10) قرار الجاهزية

المشروع الآن جاهز لـ:

```txt
GitHub upload
Vercel deployment staging/production candidate
```

بشرط ضبط متغيرات البيئة وقاعدة البيانات وتنفيذ migrations/seed.

للنشر اتبع:

```txt
docs/DEPLOYMENT_VERCEL_GITHUB.md
```

## 11) Enterprise Master Administration Update

تمت إضافة طبقة إدارة مركزية متقدمة بعد هذا الفحص:

### صفحات جديدة

```txt
/admin/master
/admin/theme-builder
/admin/cms
/admin/contracts
/admin/commissions-taxes
/admin/notifications-center
/admin/rbac-builder
```

### APIs جديدة

```txt
/api/admin/master-settings
/api/admin/theme
/api/admin/cms/pages
/api/admin/cms/pages/[id]
/api/admin/menu-items
/api/admin/notification-templates
/api/admin/contract-templates
/api/admin/commission-rules
/api/admin/tax-rules
/api/admin/rbac/role-templates
```

### جداول جديدة

```txt
cms_pages
menu_items
notification_templates
contract_templates
commission_rules
tax_rules
role_templates
```

بعد الإضافة أصبح المشروع يحتوي على:

```txt
51 tables
59 API routes
41 page files
```

وتم توليد migration:

```txt
drizzle/0004_majestic_natasha_romanoff.sql
```

### نتيجة الفحص بعد الإضافة

```bash
npm run lint
npm run typecheck
npx drizzle-kit check --config=drizzle.config.ts
npm run build
npm audit --audit-level=high
```

النتيجة:

```txt
Passed
No high or critical audit failures
```
