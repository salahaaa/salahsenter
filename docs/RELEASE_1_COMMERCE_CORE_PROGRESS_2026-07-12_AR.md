# Release 1 — Commerce Core Progress Report

**التاريخ:** 12 يوليو 2026  
**الحالة:** قيد التنفيذ — الحزم الثلاث الأولى مكتملة برمجيًا ومتحققة محليًا.

## الهدف

تحويل المنصة إلى Marketplace نقدي يعمل في اليمن، حيث يدير التاجر الشحن ويستلم النقد، ويستطيع العميل تتبع الطلب من المنتج حتى التسليم.

---

## الحزمة 1: العناوين والشحن النقدي

### المنفذ

- حفظ عناوين العميل مع `governorateId`.
- اختيار العنوان المحفوظ داخل Checkout.
- محرك تغطية شحن التاجر:
  - `all_yemen`.
  - `selected_governorates`.
  - `pickup_only`.
  - governorate fee overrides.
  - free shipping threshold.
  - courier/contact/customer instructions.
- Dashboard إعدادات التاجر يدعم تحديد المحافظات المشمولة والمندوب وتعليمات العميل.
- Checkout يعرض فقط وسائل الشحن المطابقة لمحافظة العميل.
- إنشاء الطلب يتحقق من التغطية على الخادم ويحسب رسوم الشحن من قواعد التاجر، فلا يمكن تجاوز التغطية من المتصفح.

## الحزمة 2: التاجر والمنتج وما بعد الطلب

### Merchant Daily Work Queue

قائمة يومية داخل Dashboard التاجر تجمع:

- طلبات جديدة.
- مدفوعات/طلبات نقدية معلقة.
- مخزون منخفض.
- منتجات مسودة.
- عروض بانتظار الاعتماد.
- إشعارات غير مقروءة.

### Product Q&A

- العميل يرسل سؤالاً من صفحة المنتج.
- السؤال ينتظر مراجعة التاجر.
- التاجر يعتمد أو يحذف أو ينشر ردًا.
- الأسئلة والأجوبة المعتمدة تظهر للعامة في تبويب المنتج.
- العمليات تسجل في Audit Logs.

### Order Tracking

- API tracking rate-limited.
- يعرض الحالة الحالية والخطوة التالية.
- يعرض طريقة الشحن، المندوب، رقم التتبع، الوقت المتوقع، تعليمات التاجر ووجهة التوصيل.
- يعرض Timeline للحالات.

### Public CMS

- Route ديناميكي `/{slug}` لصفحات CMS النشطة.
- SEO metadata أساسية من `cms_pages.seo`.
- مناسب للسياسات، الخصوصية، الشروط والأسئلة الشائعة.

## الحزمة 3: Funnel Analytics

### Funnel

```text
product_view → add_to_cart → checkout_started → order_created → order_delivered
```

- migration `0050_commerce_funnel_analytics`.
- visitor identity مخزن كـ SHA-256 فقط.
- client event API rate-limited.
- التقارير الإدارية وتقارير التاجر تعرض الأعداد ومعدلات التحويل لآخر 30 يومًا.

## التحقق

| الفحص | النتيجة |
|---|---|
| ESLint | ناجح |
| TypeScript | ناجح |
| Unit tests | 19 ملفات / 51 اختبارًا ناجحًا |
| Drizzle migration journal | 51 SQL / 51 entries |
| Drizzle schema check | ناجح |
| Security verification | ناجح |
| npm audit production dependencies | 0 vulnerabilities |

## الحزمة 4: Product Workspace ونتيجة Checkout

### Product Workspace

- محرك المنتج مقسم إلى أربع خطوات مرئية:
  1. أساسيات الصنف.
  2. الوسائط والمواصفات.
  3. المتغيرات والمخزون.
  4. مراجعة التركيبات والنشر.
- الحقول لا تفقد قيمها عند الانتقال بين الخطوات.
- Matrix المتغيرات يبقى generic بالكامل: خصائص وقيم التاجر هي مصدر التركيبات.
- كل تركيبة تدعم SKU وباركود وسعر ومخزون ووحدة وصورة مستقلة.

### نتيجة Checkout متعددة المتاجر

- صفحة `/checkout/result` تعرض نتيجة كل متجر منفصلًا.
- في حالة partial success، تبقى الطلبات التي نجحت ظاهرة وقابلة للفتح، مع توضيح فشل المتجر الآخر.
- العميل ينتقل مباشرة لتفاصيل الطلب أو قائمة طلباته.

## الحزمة التالية

1. Product quality score وpublish lifecycle.
2. City/district shipping coverage بدل المحافظة فقط.
3. تنبيه التاجر عند سؤال جديد وSLA للرد.
4. تحسين funnel إلى تقارير date range وconversion حسب محافظة/قطاع.
