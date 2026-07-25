# تصميم تغيير: Platform Experience Studio ومنشئ أقسام رئيسية فعلي

**التاريخ:** 2026-07-15  
**الهدف:** تمكين الأدمن من تغيير الهوية البصرية وواجهة المنصة بصورة فعلية ومنظمة، وإصلاح إنشاء الأقسام الجديدة وربطه بالواجهة العامة والـ cache.

## المشكلة الحالية
- نموذج هوية المنصة فارغ ولا يقرأ الإعدادات المحفوظة، ولا تتغذى منه Header/metadata بصورة موحدة.
- Theme Builder يحفظ مفاتيح عديدة لكن ThemeStyle يطبق subset صغيراً فقط.
- منشئ الأقسام يسمح بقالب/قسم مخصص لكنه لا يوفر config مناسباً، يتأثر بـ cache، وقد يفشل عند duplicate code من دون تفسير أو upsert.
- القسم المخصص الحالي يعرض نصاً عاماً فقط ولا يدعم CTA/banner/links بشكل منظّم.

## النطاق
1. `platform.identity` typed settings فعالة في header/footer/metadata.
2. Experience controls: top bar, header CTA, footer trust/contact، مع source-of-truth واضح.
3. Theme tokens موسعة وتطبق CSS variables آمنة فقط.
4. Section templates مدعومة: custom banner, CTA, rich text, link grid؛ بدون HTML/JS حر.
5. منشئ أقسام يحفظ config، يعاين النوع، يعدل/يخفي/يرتب، ويعمل upsert للقوالب بدل duplicate failure.
6. كل تعديل يعطل Public Home Cache ويعمل revalidate للمسارات العامة.

## الأمن والصيانة
- لا HTML خام، لا scripts، لا embeds، لا CSS غير متحقق منه.
- URLs/الألوان/المقاسات/microcopy تتحقق server-side بـ Zod.
- identity/theme/home sections لها APIs متخصصة وصلاحيات منفصلة (`system.settings.edit`, `theme.manage`, `home.manage`).
- لا migration مطلوبة؛ home_sections/config وsystem_settings موجودة.

## حدود واعية
- لا تحول هذه الدفعة كل صفحة داخل المنصة إلى Page Builder؛ تركز على الوجهة العامة المشتركة.
- لا تغير tenant white-label override؛ tenant يبقى قادراً على override theme حسب البنية الحالية.
- لا تدّعي معاينة Production؛ تحتاج Staging visual QA بعد التنفيذ.
