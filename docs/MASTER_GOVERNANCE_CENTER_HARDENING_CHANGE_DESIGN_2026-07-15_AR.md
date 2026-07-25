# تصميم تغيير: تحويل Enterprise Master Administration إلى Master Governance Center

**التاريخ:** 2026-07-15  
**الهدف:** إلغاء JSON الحر غير الفعال، منع تداخل الصلاحيات، وتحويل النافذة إلى مركز حوكمة فعلي مع مسارات متخصصة ومراجعة/تراجع غير معرقلين.

## المشكلة
- GET في Master API يعيد كل `systemSettings`، لا مجموعة `master` فقط.
- PATCH يقبل `group` حراً، ما يسمح لصلاحية `master.manage` بمحاولة تغيير domains أخرى.
- البطاقات وصفية وغير قابلة للتنقل.
- قيم JSON لا تكون بالضرورة المصدر الفعال لإعدادات العقود/الأمن/المالية، فتنتج وهم تغيير تشغيلي.

## الأولوية 1: حدود أمنية
- Master API يقرأ ويكتب فقط `group=master`.
- Zod schema strict/whitelist لـ Master settings.
- لا توجد أسرار أو إعدادات مزودين أو security guard أو financial terms داخل Master.
- كل تغيير له audit وsnapshot version.

## الأولوية 2: واجهة حوكمة مفيدة
- سجل domain registry يوضح: المالك، الرابط المتخصص، وما إذا كانت القيمة في Master فعالة أو مرجعية فقط.
- أقسام عربية منظمة: Governance Defaults، Onboarding Defaults، Feature Flags، Data Governance.
- الروابط للـ source-of-truth المتخصص: settings, platform revenue, commissions, security, providers, etc.

## الأولوية 3: Lifecycle غير معرقل
- Draft: يحفظ snapshot فقط ولا يؤثر على التطبيق.
- Publish: يكتب whitelist تحت `master` ويصبح current version.
- Rollback: ينشئ published version جديداً من snapshot سابق؛ لا يحذف السجل.
- السبب اختياري، لا MFA ولا approval ثانٍ ولا حظر للأدمن.

## قيم فعالة في هذه الدفعة
Feature flags المحددة والآمنة:
- `allowIndependentStores`: يسمح/يوقف تقديم متجر أو نشاط مستقل.
- `allowCommercialExposureRequests`: يسمح/يوقف طلبات الظهور التجاري من التاجر.

تطبق على server routes، بينما الإعدادات المالية والأمنية تبقى في لوحاتها المتخصصة منعاً لتضارب مصدر الحقيقة.

## التوسع والصيانة
- `master_settings_versions` append-only history بترتيب إصدار وفهارس حالة/تاريخ.
- library واحدة `lib/master-settings.ts` للتطبيع والـ registry والـ feature flags.
- لا queue أو secrets أو migration بيانات حساسة.
