# تصميم تغيير: معاينة تعديلات الأدمن والتحكم الكامل بتخطيط الرئيسية

**التاريخ:** 2026-07-15

## الهدف
- أي تعديل واجهة من الأدمن يمكن معاينته عبر token خاص قبل النشر العام.
- الواجهة العامة لا ترى Draft preview.
- يصبح تخطيط الرئيسية managed بصورة صريحة: بعد اعتماد layout لا تظهر أقسام fallback خارج قائمة الأدمن.

## Preview mode
- جدول `experience_preview_sessions` يخزن hash token وscope/payload/owner/expiry.
- token صالح للأدمن فقط؛ الصفحة العامة لا تطبق preview لمن لا يحمل صلاحية إدارة الواجهة.
- scopes: platform identity, theme, home content, welcome popup, home sections.
- preview يطبق override في request فقط ولا يكتب systemSettings/homeSections أو يغير cache.
- publish يبقى قرار الأدمن المباشر الموجود؛ Preview ليس approval workflow معرقل.

## Layout control
- `homepage.layout_mode = managed` في systemSettings بعد أول حفظ layout كامل من builder.
- builder يعرض effective layout (القوالب الافتراضية + overrides DB) قبل الإدارة.
- أول حفظ يثبت كل الأقسام كصفوف DB ثم يصبح managed.
- في managed mode، renderer يقرأ DB sections فقط؛ إخفاء قسم يعني لا يظهر fallback له.
- custom section creation bootstraps defaults إذا كان layout غير managed حتى لا يخفي باقي الرئيسية بطريق الخطأ.

## الأمان
- preview payload validated per scope.
- لا raw HTML/JS/CSS في custom sections أو previews.
- preview token hashed، expires، ومقيد بـ admin home/theme/settings permissions.
- audit log عند إنشاء preview؛ لا يسجل token الخام.

## الصيانة
- Preview sessions قصيرة العمر (default 24 ساعة) ويمكن تنظيفها لاحقاً؛ لا queues مطلوبة.
- إعادة استخدام serializers/normalizers الحالية للهوية والثيم والمحتوى.
- لا migration data destructive.
