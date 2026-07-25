# تصميم تغيير: كتالوج قطاعات إداري قابل للتخصيص للتاجر

**التاريخ:** 2026-07-15

## الهدف
تمكين الأدمن من إنشاء قطاع كامل بلا برمجة: تصنيفات ووحدات وخصائص وقيم ومقاسات وألوان ومنتجات بداية، ثم إتاحته للتاجر ضمن قائمة القوالب.

## نموذج البيانات
جدول `merchant_activity_template_catalog`:
- code/name/description/sector/status/version.
- config JSONB typed يشمل categories, units, attributes, sizes, colors, starterProducts.
- audit/version fields.

اختيار JSONB هنا مقصود لأنه catalog قابل للتوسع، مع Zod schema صارم على server ولا HTML/JS حر.

## Starter Products
- المنتجات اختيارية.
- عند تطبيق التاجر للقالب، ينشئها كـ Draft فقط.
- السعر والمخزون صفر، لا نشر، لا طلب، لا تكلفة، لا فاتورة.
- marker داخل store settings يمنع تكرار starter products عند إعادة تطبيق نفس version، فيما تبقى taxonomy idempotent.

## إدارة الأدمن
صفحة `admin/activity-templates`:
- إضافة/تعديل/تعطيل قطاع.
- حقول بشرية مبسطة عبر أسطر: categories, units, attributes, colors, starter products.
- preview ملخص config، وversion management.

## الصلاحيات
صلاحية `activity_templates.manage` مع fallback `products.manage` و`master.manage` لتوافق الأدوار الحالية.

## الصيانة والتوسع
- حدود: 100 category, 50 units, 100 attributes, 500 attribute values, 50 starter products per template.
- لا migration للمنتجات عند تعديل template؛ النسخ الجديدة تؤثر على تطبيقات مستقبلية فقط.
- لا automation للنشر أو stock/price.
