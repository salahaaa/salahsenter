# Enterprise Multi-Vendor Marketplace MVP

منصة مول إلكتروني متعددة المتاجر مبنية كهيكل MVP قابل للتوسع، وفق المواصفات العربية المرسلة:

- Next.js App Router + TypeScript
- Tailwind CSS + مكونات Shadcn-style محلية
- Next.js API Routes REST
- PostgreSQL + Drizzle ORM
- JWT + Session Cookie
- RBAC أدوار وصلاحيات
- لوحات: أدمن / تاجر / واجهة مول / صفحة متجر
- طلب فتح متجر واعتماد تلقائي ينشئ المتجر ويربط التاجر
- منتجات بسيطة ومتعددة المتغيرات + مخزون + حركات مخزون
- إعلانات المول منفصلة عن إعلانات المتاجر
- الصفحة الرئيسية تعتمد على بيانات قابلة للإدارة من لوحة الأدمن

## 1) التشغيل والتحديث الرسمي

### المتطلبات المعتمدة

```text
Node.js 22.19.0
npm 10 أو أحدث
PostgreSQL/Neon للتشغيل الحقيقي
```

الإصدار المعتمد موجود في:

```text
.nvmrc
package.json → engines.node
```

### Development فقط

```bash
nvm use
npm ci
cp .env.example .env
# عدّل DATABASE_URL وJWT_SECRET في بيئتك المحلية فقط
npm run db:push     # Development فقط، ليس Staging أو Production
npm run db:seed     # مرجعيات فقط، لا ينشئ مستخدمين
npm run dev
```

### التحقق قبل رفع أي تحديث

```bash
npm ci
npm run release:verify:source
npm run build
npm run performance:bundle
```

> `npm run release:verify` يجمع كل الفحوصات، بما فيها build، ويشغّل في GitHub CI على Node 22.19.0. لا يعد فشل build محلي في Arena دليلاً على خلل المصدر بسبب حدود الذاكرة؛ GitHub CI/Vercel هما بوابة البناء النهائية.

### تحديثات Windows بخطوة واحدة

بعد الإعداد الأول لـ Git وbranch `staging`، استخدم:

```text
tools\Apply-Mall-Update.cmd
```

لتحديث المصدر من ZIP موثق ببصمة SHA-256، مع backup branch وفحص تلقائي ثم Push إلى `staging` فقط عند التأكيد. راجع:

```text
docs/ONE_COMMAND_UPDATE_CHANNEL_2026-07-25_AR.md
```

### تجربة متجر حقيقية ببيانات اختبار

بعد migrations وseed في Local/Staging فقط، يمكن إنشاء تاجر اختبار ومتجر وجناح حقيقيين ومنتج مسودة عبر:

```text
npm run test:experience:bootstrap
```

يتطلب متغيرات `TEST_EXPERIENCE_*` وتأكيداً صريحاً، ويرفض Production. المنتج الناتج يبدأ دائماً:

```text
status=draft
price=0
stock=0
```

راجع:

```text
docs/SAFE_TEST_EXPERIENCE_BOOTSTRAP_2026-07-25_AR.md
```

### قاعدة البيانات وأول مسؤول

```text
Development: db:push وdb:seed مسموحان محلياً فقط.
Staging/Production: db:migrate عبر GitHub Workflow المعتمد فقط.
```

لا توجد حسابات أدمن أو كلمات مرور افتراضية في المصدر. أول مسؤول ينشأ مرة واحدة فقط عبر:

```text
npm run admin:bootstrap
```

أو من GitHub Actions وفق البيئة المقصودة. راجع:

```text
docs/GITHUB_ACTIONS_FIRST_ADMIN_BOOTSTRAP_FROM_PHONE_2026-07-20_AR.md
docs/RELEASE_WORKFLOW_CATALOG_2026-07-23_AR.md
```

### دلائل التشغيل الرسمية

```text
docs/UPGRADE_GUIDE_2026-07-23_AR.md
docs/DEPLOYMENT_VERCEL_GITHUB.md
docs/GITHUB_VERCEL_READY_CHECKLIST.md
docs/RELEASE_WORKFLOW_CATALOG_2026-07-23_AR.md
docs/ENVIRONMENT_COMPLETION_SOURCE_IMPLEMENTATION_2026-07-23_AR.md
docs/STAGING_R2_BACKUP_RECOVERY_DRILL_IMPLEMENTATION_2026-07-23_AR.md
```

## 3) أهم الملفات

```text
app/                         صفحات Next.js و REST API
app/page.tsx                 الصفحة الرئيسية للمول
app/admin/page.tsx           لوحة الأدمن
app/merchant/page.tsx        لوحة التاجر
app/store/[slug]/page.tsx    صفحة المتجر العامة
app/api/**/route.ts          REST API
lib/db/schema.ts             مخطط PostgreSQL/Drizzle
lib/auth.ts                  JWT + Session Management
lib/rbac.ts                  صلاحيات RBAC
lib/db/queries.ts            استعلامات الواجهة الرئيسية والمتجر
scripts/seed.ts              Seed للأدوار والصلاحيات والإعدادات
components/**                مكونات UI ونماذج ولوحات
```

## 4) ما تم تضمينه في MVP

### الواجهة الرئيسية

- شريط بحث بصري.
- شريط أخبار المول من `news` مستوى `marketplace`.
- بانرات رئيسية من جدول `banners`.
- أجنحة بصور وأيقونات قابلة للإدارة.
- أحدث المتاجر والمنضمين.
- إعلانات المول العامة فقط.
- المنتجات والمتاجر الرائجة.
- دعوة فتح متجر.

### لوحة الأدمن

- Dashboard إحصائي.
- مداخل أقسام الإدارة الأساسية.
- طلبات فتح المتاجر مع اعتماد/رفض.
- إعدادات هوية المنصة.
- منشئ أولي لأقسام الصفحة الرئيسية.
- API لإدارة الأجنحة والإعدادات والأقسام.

### لوحة التاجر

- Dashboard للمتجر.
- منتجات.
- وسائط المتجر: غلاف، شعار، صورة تعريفية، معرض حتى 20 صورة، فيديو.
- إعلانات المتجر عبر API منفصلة عن الصفحة الرئيسية.
- معاينة المتجر مباشرة دون تسجيل خروج.

### Backend / Database

- Users / Roles / Permissions / User Roles.
- Merchant Applications.
- Stores / Store Wings / Coverage / Media / Employees.
- Wings + Default Activity Media.
- Geography: Countries / Governorates / Cities / Districts.
- Store settings: Categories / Units / Sizes / Colors.
- Products / Product Variants.
- Inventory Movements.
- Orders / Order Items / Dynamic Order Status Definitions.
- Reviews.
- Announcements / News / Banners.
- Home Sections.
- Subscriptions.
- Featured Rules.
- System Settings.
- Notifications.
- Audit Logs.

## 5) مبدأ الإعلانات المطبق

- إعلانات المول: `announcements.level = marketplace` وتظهر في الصفحة الرئيسية فقط.
- إعلانات المتجر: `announcements.level = store` وتظهر داخل صفحة المتجر فقط.
- حقول الترويج المستقبلي موجودة من الآن:
  - `is_promoted`
  - `promotion_start`
  - `promotion_end`
  - `promotion_package`

## 6) النشر

### Vercel للواجهة و API

أضف متغيرات البيئة في Vercel:

```text
DATABASE_URL
JWT_SECRET
SESSION_COOKIE_NAME
NEXT_PUBLIC_APP_URL
```

### Render لقاعدة PostgreSQL

أنشئ PostgreSQL على Render ثم استخدم External Database URL في `DATABASE_URL`.

بعد النشر شغّل migration history فقط من workflow/بيئة إدارية آمنة ومقفلة:

```bash
npm run db:migrate
```

> لا تستخدم `db:push` أو `db:seed` في production؛ كلاهما ليسا مسار إطلاق إنتاجي. لا تشغّل `admin:bootstrap` إلا عند تهيئة قاعدة جديدة لا تحتوي مسؤولاً نشطًا، وبقيم سرية غير محفوظة في المستودع.

## 7) المرحلة المستكملة في هذه النسخة

تمت إضافة وحدات تشغيلية إضافية فوق الـ MVP الأولي:

- إدارة البانرات وإعلانات المول من لوحة الأدمن.
- إدارة أخبار المول وشريط الأخبار.
- إدارة المناطق الجغرافية: دول، محافظات، مدن، مناطق.
- إدارة باقات الاشتراك.
- إدارة الصور الافتراضية للأنشطة حسب الجناح.
- إدارة المتاجر: تفعيل، تعطيل، إخفاء ومعاينة.
- شاشة سجل العمليات Audit Log.
- شاشات مراقبة المستخدمين والمنتجات والصلاحيات.
- إعدادات المتجر للتاجر: الأقسام، الوحدات، المقاسات، الألوان.
- عروض وأخبار المتجر، مع الفصل عن الصفحة الرئيسية.
- إدارة المخزون وحركات الإضافة والخصم والجرد.
- إدارة الطلبات وتحديث حالاتها حسب جدول حالات قابل للإدارة.
- تقارير تاجر أولية: المنتجات، الطلبات، المبيعات، قرب النفاد.


## 9) مرحلة Enterprise المتقدمة المضافة

تم استكمال المرحلة التالية المقترحة بإضافات عملية:

- رفع ملفات فعلي عبر `MEDIA_PROVIDER`: local أو Cloudinary أو S3/R2.
- جدول `media_assets` ومكتبة وسائط API.
- CRUD API للتعديل والحذف لعناصر رئيسية في الأدمن والتاجر.
- موظفو المتجر مع RBAC مخصص لكل موظف وصلاحيات مختارة.
- وسائل الدفع والشحن وجداول `payment_methods`, `shipping_methods`, `order_payments`, `order_shipments`.
- منشئ صفحة رئيسية Drag & Drop حقيقي لحفظ ترتيب الأقسام وإظهارها/إخفائها.
- نسخ احتياطي واستعادة JSON للبيانات التشغيلية.
- تقارير ورسوم بيانية SVG للأدمن والتاجر.

### إعداد رفع الملفات

```env
MEDIA_PROVIDER=local # local | cloudinary | s3 | r2
MEDIA_MAX_SIZE_MB=8

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# S3/R2
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=
```

## 10) ملاحظات مهمة للمرحلة التالية

هذا المشروع هو MVP Scaffold قابل للبناء عليه، وليس نسخة Enterprise مكتملة 100%. المرحلة التالية المقترحة:

1. إضافة Upload فعلي للصور وربطه بـ S3/R2/Cloudinary/CDN.
2. إكمال CRUD لكل أقسام الأدمن والتاجر.
3. بناء محرر Drag & Drop حقيقي للصفحة الرئيسية.
4. إكمال RBAC على مستوى الصلاحيات الدقيقة داخل كل API.
5. إضافة نظام دفع وشحن قابل للإدارة.
6. إضافة تقارير ورسوم بيانية.
7. إضافة Backup/Restore من لوحة الأدمن.
8. إضافة Optimistic Updates وDebounced Search في الجداول الكبيرة.

## 11) دورة العقد الإلكتروني والموافقة النهائية

تم تحديث دورة فتح المتجر لتصبح:

1. تقديم طلب فتح متجر.
2. عرض عقد إلكتروني للطالب عبر `/apply-store/{id}/contract`.
3. توقيع العقد داخل مربع توقيع إلكتروني.
4. انتقال الطلب إلى `waiting_final_approval`.
5. مراجعة الأدمن للعقد والتوقيع والبيانات داخل `/admin/merchant-applications/{id}`.
6. الموافقة النهائية فقط هي التي تنشئ سجل التاجر والمتجر وتفعّل المتجر.
7. توليد رقم متجر فريد `store_number`.
8. إنشاء بيانات دخول مؤقتة وإرسال إشعار داخلي.
9. تسجيل دخول التاجر بالبريد أو رقم المتجر.

تمت إضافة جدول `merchants` وحقول العقد داخل `merchant_applications` وحقل `store_number` داخل `stores`.

راجع اختبار القبول الكامل في:

```txt
docs/ACCEPTANCE_TESTS.md
```


## 12) Enterprise Master Administration System

تمت إضافة نظام إدارة مركزي متقدم يجعل لوحة الأدمن العقل التشغيلي للمنصة:

- `/admin/master` لإدارة إعدادات المنصة والمول والمتاجر والعقود والعمولات والطلبات والشحن والدفع والضرائب والإشعارات والأمان والتقارير.
- `/admin/theme-builder` لإدارة الهوية البصرية: الخطوط، الألوان، الأزرار، البطاقات، الجداول، التنبيهات، الـ radius والظلال.
- `/admin/cms` لإدارة الصفحات والمقالات والأسئلة الشائعة والشروط وسياسة الخصوصية بدون تعديل الكود.
- `/admin/contracts` لإدارة قوالب العقود والتوقيعات والأرشفة.
- `/admin/commissions-taxes` لإدارة العمولات والضرائب.
- `/admin/notifications-center` لإدارة قوالب Notification/Email/SMS/Push ومراجعة آخر الإشعارات.
- `/admin/rbac-builder` لإدارة Role Templates وCustom Permissions وInheritance.

تمت إضافة الجداول:

```txt
cms_pages
menu_items
notification_templates
contract_templates
commission_rules
tax_rules
role_templates
```

وتم توليد migration:

```txt
drizzle/0004_majestic_natasha_romanoff.sql
```

## 13) Professional Product Engine

تم تطوير نظام المنتجات ليصبح محرك منتجات ومتغيرات ديناميكي:

- `/merchant/product-taxonomy` لإدارة شجرة الأصناف والخصائص وقيم المتغيرات.
- `/merchant/products` لإضافة منتجات بسيطة أو متعددة المتغيرات وتوليد كل التركيبات تلقائياً.
- `/store/[slug]/products/[productSlug]` لعرض المنتج بتصميم احترافي ومعرض صور واختيار متغيرات.

جداول جديدة:

```txt
product_attributes
product_attribute_values
product_variant_attribute_values
product_images
product_specifications
product_questions
product_answers
```

راجع:

```txt
docs/PRODUCT_ENGINE_AUDIT.md
```

## 14) Multi-Level Ads & News System

تم تنفيذ نظام إعلانات وأخبار متعدد المستويات:

- إعلانات وأخبار المول تظهر في الصفحة الرئيسية فقط وتدار من الأدمن.
- إعلانات وأخبار المتاجر تظهر داخل صفحة المتجر فقط.
- تمت إضافة شريط أخبار متجر مستقل وبطاقات عروض احترافية.
- تمت إضافة إعدادات حدود الإعلانات في `/admin/ads`.
- تمت إضافة API `/api/admin/advertising-settings`.
- تمت إضافة قسم `عروض مميزة` في الصفحة الرئيسية للمنتجات المروجة مستقبلاً.

راجع:

```txt
docs/ADS_NEWS_SYSTEM.md
```

## 15) Merchant Onboarding & Contract Lifecycle E2E Update

تم توسيع دورة فتح المتجر لتدعم:

- منع فتح متجر بدون حساب.
- حالات طلب احترافية: pending, under_review, documents_required, pre_approved, contract_created, contract_signed, active.
- رفع مستندات الطلب عبر `merchant_application_documents`.
- مراجعة إدارية بأفعال محددة ومنع القفز بين الحالات.
- إنشاء عقد قبل التوقيع مع رقم عقد ومدة وعمولة ورسوم.
- توقيع إلكتروني يحول الطلب إلى `contract_signed`.
- موافقة نهائية تنشئ التاجر والمتجر والعقد الفعال وتفعل المتجر.
- صفحة تاجر لمتابعة حالة الطلب والعقد: `/merchant/onboarding`.

راجع:

```txt
docs/ONBOARDING_CONTRACT_E2E_AUDIT.md
```

## 17) Store-level Payment, Shipping & Order Settings

تم نقل إعدادات الدفع والشحن والطلبات إلى لوحة التاجر بدلاً من لوحة الأدمن:

```txt
/merchant/operations-settings
```

وتشمل:

- وسائل الدفع الخاصة بالمتجر.
- وسائل الشحن الخاصة بالمتجر.
- إعدادات الطلبات: القبول التلقائي، مهلة الإلغاء، أقل مبلغ طلب، وقت التجهيز، سياسة الشحن، سياسة الإرجاع.

تمت إضافة APIs:

```txt
/api/merchant/payment-methods
/api/merchant/payment-methods/[id]
/api/merchant/shipping-methods
/api/merchant/shipping-methods/[id]
/api/merchant/order-settings
```

وتمت إزالة رابط الدفع والشحن من لوحة الأدمن الرئيسية.
