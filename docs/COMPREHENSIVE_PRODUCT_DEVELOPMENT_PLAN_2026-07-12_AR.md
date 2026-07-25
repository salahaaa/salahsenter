# خطة التطوير الشاملة للمنصة

**تاريخ المراجعة:** 12 يوليو 2026  
**نطاق المراجعة:** النسخة الحالية في مساحة العمل، وتشمل الواجهة العامة، العميل، التاجر، الأدمن، المنتجات والمتغيرات، العروض والإعلانات، الماليات، ERP، التشغيل والجودة.  
**الهدف:** الانتقال من مشروع واسع الوظائف إلى منتج متماسك، واضح التجربة، قابل للنمو والإطلاق المرحلي.

---

## 1) الملخص التنفيذي

المنصة ليست مجرد MVP بسيط؛ هي قاعدة قوية لسوق متعدد المتاجر مع امتداد مالي وERP وSaaS. لديها **222 route handlers**، أكثر من **100 جدول/نموذج بيانات**، لوحات واسعة للأدمن والتاجر، منتجات ومتغيرات ومخزون وطلبات وعروض وإعلانات وماليات ومراقبة.

### الحكم الأساسي

**نقطة القوة:** اتساع وظيفي ممتاز وبنية تشغيلية/أمنية أصبحت جيدة.  
**الخطر الحالي:** تعدد المزايا أسرع من توحيد التجربة والجودة؛ بعض الوحدات مكتملة في schema وAPI لكن غير مكتملة كرحلة مستخدم أو غير ظاهرة للعامة.

لذلك لا أوصي بالبدء الآن بمزيد من وحدات Enterprise جديدة. الأولوية يجب أن تكون:

1. تحديد نطاق الإطلاق التجاري الحقيقي.
2. إتقان دورة العميل ← الطلب ← التاجر ← التسليم/الدفع.
3. تبسيط لوحة التاجر والأدمن وتحويلهما إلى قوائم عمل واضحة.
4. إكمال الميزات التي لها جداول وواجهات جزئية فقط.
5. توحيد API وتجارب الواجهة والاختبارات قبل التوسع الأفقي.

---

## 2) لقطة الوضع الحالي

| المجال | الوضع الحالي | التقييم |
|---|---|---|
| نطاق البيانات | واسع جدًا: مستخدمون، متاجر، منتجات، متغيرات، مخزون، طلبات، عروض، ماليات، ERP، Tenants | قوي لكن يحتاج ضبط نطاق |
| الأدمن | نحو 43 صفحة إدارية | غني لكن يحتاج Work Queue وتجربة موحدة |
| التاجر | نحو 26 صفحة | قوي لكن متشعب ويحتاج onboarding وتشغيل مبسط |
| الواجهة والعميل | متجر، بحث، سلة، Checkout، طلبات، Wishlist، Wallet | جيد كأساس لكن تجربة ما بعد الطلب ودعم العميل تحتاج تطوير |
| API | 222 route handlers | واسع؛ يحتاج توحيد validation/pagination/error contract |
| مكونات الواجهة | 130 client components من 264 TSX | يحتاج ضبط bundle وتقليل منطق الواجهة المتكرر |
| الاختبارات | 46 اختبارًا؛ coverage تقريبي 26.9% statements و17.6% branches للكود المحمل | غير كافٍ لمساحة المشروع |
| التشغيل | مراقبة، Queue، DLQ، Audit، Backups، Reconciliation موجودة | جاهز كإطار؛ يحتاج تشغيل حي على البنية الحقيقية |

---

## 3) ما يعمل جيدًا ويجب الحفاظ عليه

### أ) محرك التجارة الأساسي

- Multi-store checkout مع إنشاء طلب مستقل لكل متجر.
- Idempotency للطلبات.
- Atomic inventory reservation ومنع oversell.
- Reservation expiry وrelease للمخزون.
- Store operation status وshowcase-only commerce.
- منتجات بسيطة ومتعددة المتغيرات.
- عروض bundles مع حجز/تفكيك مخزون.

### ب) إدارة المنصة

- دورة فتح المتجر والعقد والمراجعة النهائية.
- RBAC على مستوى المنصة والمتجر.
- إدارة المتاجر والموظفين والعقود والأجنحة والمناطق.
- مراقبة وAudit Logs وSecurity Center.
- Reconciliation للـ ERP والمخزون.

### ج) جاهزية التوسع

- طبقات cache وRedis وQueue وSentry/Prometheus hooks.
- Financial providers وpayouts وledger foundations.
- ERP integration clients/mapping/events/sync runs.
- Tenant foundations جاهزة للمستقبل.

---

# 4) الفجوات وفرص التطوير حسب المجال

## 4.1 تجربة العميل والواجهة العامة

### الفجوات

1. **Discovery يحتاج أن يصبح رحلة وليس صفحات منفصلة**
   - البحث الذكي جيد، لكن يحتاج صفحة نتائج موحدة ذات فلاتر دائمة، sorting واضح، URL state، وحفظ البحث.
   - لا توجد رحلة واضحة: بحث → مقارنة → قرار → شراء.

2. **صفحة المنتج تحتاج طبقة ثقة وتحويل أعلى**
   - توجد تفاصيل ومتغيرات، لكن الأولوية لإضافة:
     - أسئلة وأجوبة المنتج.
     - تبويب مواصفات منظم.
     - سياسة الشحن والإرجاع الخاصة بالمتجر/المنتج.
     - منتجات مشابهة وبدائل ومتجر آخر يبيع المنتج.
     - حالة التوفر ووقت التجهيز والتسليم المتوقع.

3. **جداول Q&A موجودة لكن غير مستخدمة فعليًا**
   - `product_questions` و`product_answers` بلا references خارج schema.
   - هذه فرصة مباشرة لبناء ثقة العميل وتقليل الاستفسارات اليدوية.

4. **Checkout يحتاج تجربة احترافية متعددة الخطوات**
   - اختيار عنوان محفوظ بدل إعادة كتابة العنوان كل مرة.
   - حساب شحن حسب الموقع/التغطية/طريقة الشحن.
   - ملخص ضريبة/عمولة/خصم واضح لكل متجر.
   - صفحة نجاح موحدة لعدة طلبات بدل تحويل عام إلى الطلبات.
   - منع partial-order confusion: إذا نجح طلب متجر وفشل آخر يجب إظهار حالة دقيقة وخيار متابعة.

5. **ما بعد الطلب**
   - Tracking timeline أقوى.
   - فتح نزاع/إرجاع من العميل بطريقة مرئية ومتدرجة.
   - مركز إشعارات مع preferences.
   - مركز دعم/تذاكر أو محادثة مرتبطة بطلب.
   - فواتير قابلة للتحميل ومشاركة آمنة.

6. **CMS موجود إداريًا لكنه غير مكتمل كواجهة عامة**
   - `cms_pages` و`menu_items` يديران المحتوى، لكن لا توجد public dynamic CMS route ظاهرة.
   - ينبغي إضافة صفحات: الشروط، الخصوصية، الأسئلة الشائعة، من نحن، سياسات الإرجاع والتوصيل.

### الأولوية

**P0 Product Core:** Checkout، العنوان، الشحن، صفحة المنتج، order tracking، الدعم.  
**P1 Growth:** saved search، comparison، recommendations، loyalty/cashback UI.

---

## 4.2 لوحة التاجر

### الوضع

اللوحة غنية جدًا: المنتجات، المخزون، العروض، الإعلانات، الموظفون، الفروع، الماليات، التكامل، الوسائط، smart setup، التقارير.

### التحدي

التاجر الجديد قد يضيع بين نحو 26 صفحة. المطلوب هو تحويل اللوحة من قائمة وظائف إلى **نظام تشغيل متجر يومي**.

### التطوير المقترح

1. **Merchant Launch Checklist موحد**
   - هوية المتجر.
   - عقد/حالة اعتماد.
   - العنوان والتغطية.
   - طريقة دفع.
   - طريقة شحن.
   - أول قسم/وحدة/صفة.
   - أول منتج نشط.
   - سياسة إرجاع.
   - اختبار طلب.
   - نتيجة readiness قابلة للقياس: 0–100%.

2. **Merchant Daily Work Queue**
   بدل التنقل بين الصفحات، تظهر في الصفحة الرئيسية:
   - طلبات تحتاج قبولًا.
   - إثباتات دفع تنتظر مراجعة.
   - مخزون منخفض.
   - منتجات draft/incomplete.
   - عروض تنتظر اعتمادًا.
   - عقد قريب الانتهاء.
   - حملات إعلانية تحتاج صورة أو ميزانية.

3. **نظام منتجات موحد واضح**
   يوجد أكثر من نموذج كبير للمنتج وملفات ضخمة. ينصح ببناء Product Workspace مقسم إلى خطوات:
   - الأساسيات.
   - السعر والمخزون.
   - المتغيرات والخصائص.
   - الوسائط.
   - المواصفات وSEO.
   - النشر والمعاينة.

4. **استيراد وتصدير المنتج**
   - CSV/XLSX template رسمي.
   - Preview أخطاء قبل الحفظ.
   - تقرير صفوف ناجح/فاشل.
   - rollback للاستيراد.
   - export حسب الفلاتر.

5. **تحسين إدارة المتغيرات**
   - Matrix bulk editor (لون × مقاس × سعر × SKU × مخزون).
   - صور خاصة بكل لون.
   - clone variant.
   - barcode/serial number rules.
   - منع SKU duplicate برسالة واجهة فورية.
   - سجل تغيرات السعر والمخزون لكل variant.

6. **Merchant analytics قابلة للقرار**
   - conversion funnel: views → cart → checkout → paid.
   - منتجات بلا مبيعات.
   - منتجات out of stock أثرت على المبيعات.
   - أداء العروض والكوبونات.
   - أداء الإعلان مقابل الإنفاق.

---

## 4.3 المنتجات والمتغيرات والمخزون

### ما هو موجود

- Attributes، values، sizes، colors، units، variants، specifications، inventory movements، reservations.

### ما ينقص أو يحتاج تطويرًا

1. **Product Q&A**: الجداول موجودة وغير مفعلة.
2. **Review moderation**: مراجعات موجودة لكن تحتاج سياسة moderation، صور مراجعات، تقارير إساءة، ورد التاجر.
3. **Catalog quality score**
   - صور كافية.
   - سعر/مخزون صحيح.
   - مواصفات مكتملة.
   - عنوان ووصف جيد.
   - SKU/Barcode.
   - ربط category صحيح.

4. **Product lifecycle**
   - Draft → review → active → paused → archived.
   - سبب الرفض والمراجعة والتعديل وإعادة الإرسال.
   - scheduling للنشر/إيقاف البيع.

5. **Advanced inventory**
   - جرد دوري Stock Count.
   - Reasons موحدة للحركات.
   - موردون وتكلفة شراء وAverage Cost إن كان ERP ليس المصدر الوحيد.
   - transfer بين الفروع.
   - batch/expiry للغذاء/الصيدلية عند تفعيل هذه القطاعات.

6. **إدارة النوع التجاري لكل صنف**
   - `ONLINE_SALES` و`SHOWCASE_ONLY` موجودان، لكن الواجهة تحتاج شرحًا وتجربة واضحة تمنع التاجر من توقع checkout لمنتج عرض فقط.

---

## 4.4 العروض والكوبونات

### ما هو موجود

- عروض متجر، عروض إدارة، حملات، bundles، مخزون مخصص، تفكيك bundle، كوبونات.

### فجوات يجب ترتيبها

1. **Offer Rules Engine واضح للتاجر**
   - من المستهدف؟
   - شرط حد أدنى للسلة.
   - منتجات/تصنيفات مشمولة أو مستثناة.
   - حد الاستخدام per customer / per day / total.
   - stackability بين الكوبون والعرض والإعلان.
   - الأولوية عند تداخل الخصومات.

2. **Calendar / campaign planning**
   - تقويم رمضان/العيد/نهاية الأسبوع/مواسم محلية.
   - schedule ونشر تلقائي وانتهاء تلقائي.
   - template للعروض المتكررة.

3. **Offer performance**
   - قبل/بعد العرض.
   - revenue، margin، units sold، inventory consumed، conversion.
   - تنبيه إذا العرض يسبب margin سلبي أو مخزون غير كافٍ.

4. **Customer-facing clarity**
   - شروط العرض.
   - العد التنازلي.
   - التوفر المتبقي للباقات.
   - سبب عدم أهلية الكوبون بدل رسالة عامة فقط.

---

## 4.5 الإعلانات والمنصة الإعلانية

### ما هو موجود

- Campaigns، bid، budget، impressions/clicks tables، approval، homepage banner publishing، AI banner suggestion.

### الفجوة الكبرى

جداول `ad_billing` و`ad_reports` موجودة لكن غير مستخدمة، كما لا يظهر ingestion فعلي لـ clicks/impressions في مسارات الواجهة. النتيجة: الإعلانات موجودة كإدارة وحالة، لكنها ليست منصة Ads مكتملة ماليًا وتحليليًا بعد.

### خطة الإعلانات

1. **المرحلة الأولى: Sponsored visibility**
   - impression tracking موثق وغير مكرر.
   - click tracking مع attribution.
   - frequency cap.
   - placement IDs واضحة.
   - budget pacing يومي.

2. **المرحلة الثانية: Billing**
   - CPC أو CPM محدد لكل placement.
   - hold/reserve للميزانية.
   - ledger للحملة.
   - auto-pause عند نفاد الميزانية.
   - invoices للتاجر.

3. **المرحلة الثالثة: Performance**
   - CTR، CVR، ROAS، attributed revenue.
   - cohort وA/B creative.
   - recommended bid/budget.
   - fraud/bot click detection.

4. **المرحلة الرابعة: Ads marketplace rules**
   - ranking = bid + relevance + quality + store health + product availability.
   - لا يظهر إعلان لمنتج out of stock أو متجر موقوف.
   - فصل organic ranking عن sponsored ranking بوضوح للمستخدم.

---

## 4.6 لوحة الأدمن

### ما هو موجود

لوحة واسعة جدًا تشمل المتاجر، العقود، الموظفين، المنتجات، الإعلانات، العروض، الماليات، RBAC، المحتوى، الجغرافيا، التكامل، الأمن، المراقبة والنسخ.

### التطوير المطلوب

1. **Unified Admin Work Queue**
   أهم تحسين للأدمن. واجهة واحدة تجمع:
   - طلبات فتح متجر.
   - مستندات ناقصة.
   - عقود قريبة الانتهاء.
   - عروض وإعلانات بانتظار اعتماد.
   - متاجر موقوفة أو ناقصة البيانات.
   - إثباتات دفع وpayouts.
   - DLQ وERP failed syncs.
   - security alerts.

2. **Role-specific Admin Home**
   لا يحتاج كل موظف 43 صفحة. يبنى home بحسب permissions وwork queue.

3. **تجربة إدارة المحتوى**
   - CMS preview قبل النشر.
   - versioning وdraft/publish/rollback.
   - public routing للصفحات.
   - menu builder مستخدم فعليًا في الواجهة.

4. **إدارة العملاء**
   - customer profile 360: الطلبات، المرتجعات، العناوين، wallet، المخالفات، sessions، support history.
   - segmentation وexport مع موافقة/سياسة خصوصية.

5. **Audit Logs**
   - filters حسب category/actor/date/entity/store.
   - export CSV.
   - correlation ID وربط العملية بالطلب/المتجر/الحملة.
   - immutable retention policy.

6. **التقارير**
   - التقارير الإدارية الحالية تحتاج export، date range، drill-down، schedules وemail delivery.

---

## 4.7 الماليات وERP

### ما هو قوي

- settlement، payout، ledger، financial providers، payment receipts، reconciliation، integration events، failed syncs.

### ما يجب حسمه قبل التوسع

1. من هو **source of truth** لكل مجال؟
   - المخزون: المنصة أم ERP؟
   - الفاتورة: المنصة أم ERP؟
   - الرصيد/التسوية: المنصة أم النظام المحاسبي؟
   - السعر: التاجر أم ERP؟

2. **Financial close procedure**
   - تسوية يومية/أسبوعية.
   - reconciliation report.
   - approvals قبل payout.
   - refund/reversal procedure.
   - lock periods ومراجعة التعديلات.

3. **ERP integration maturity**
   - mapping UI versioned.
   - replay من failed sync دون تكرار effect.
   - idempotency keys مع external IDs.
   - conflict resolution policies واضحة لكل entity.
   - sandbox connector certification قبل أي تاجر.

4. **Local sync agent**
   - architecture موجودة، لكن يجب عدم توسيعها قبل اختبار deployment/update/logging/support لتاجر تجريبي واحد.

---

## 4.8 Multi-tenancy وSaaS

هناك foundation جيد (`tenants`, `tenant_users`, `tenant_stores`, `tenant_domains`, `tenant_settings`, `tenant_themes`) لكن معظمها غير مستخدم خارج schema/admin foundation.

### القرار المطلوب

لا تفعّل Multi-tenancy/white-label كمنتج حي الآن إلا إذا كان جزءًا من نموذج الربح الأول. لأنه يحتاج:

- tenant context في كل query.
- RLS أو repository layer.
- custom domains / SSL / routing.
- billing منفصل.
- isolation testing.
- support/ops model مختلف.

**التوصية:** أبقه كـ Phase 5 بعد تثبيت marketplace core.

---

## 4.9 جودة الواجهة وتجربة الاستخدام

### ملاحظات واضحة

1. توجد 116 استخدامات `fetch()` مباشرة؛ ينبغي بناء API client موحد:
   - typed request/response.
   - error mapping.
   - loading/retry.
   - correlation/request ID.
   - cache invalidation policy.

2. توجد قرابة 130 client components من 264 TSX.
   - راجع bundle split.
   - انقل القراءة غير التفاعلية إلى server components.
   - استخدم lazy loading للرسوم وAI وeditors الثقيلة.

3. توجد ملفات كبيرة جدًا:
   - schema: 3261 سطرًا.
   - merchant dashboard: 737.
   - product taxonomy: 656.
   - storefront: 666.
   - smart search: 662.
   - product forms: 365–398.

4. توجد `window.confirm` و`alert` كثيرة في عمليات حساسة.
   - استبدلها بـ Dialog موحد يدعم السبب، التأكيد النصي، loading، error، audit context.

5. SEO/metadata غير كافٍ.
   - signal static يبين metadata في ملف واحد فقط تقريبًا.
   - أضف `generateMetadata` للمتجر والمنتج والجناح والعرض وCMS.
   - structured data: Product / Offer / Organization / BreadcrumbList.

6. accessibility تحتاج audit حقيقي:
   - alt text meaningful للصور المحتوية على معنى.
   - keyboard/focus states للـ dialogs والفلاتر.
   - labels مرتبطة بكل الحقول.
   - contrast ومراعاة RTL/mobile.

---

# 5) خطة تطوير مرحلية مقترحة

## المرحلة 0 — قرارات المنتج والنطاق (أسبوع واحد)

### لا تبدأ برمجة قبل حسم هذه القرارات

1. سوق الإطلاق الأول: مدينة/محافظة/الدولة المستهدفة.
2. القطاعات الأولى: هل هي سوبرماركت/إلكترونيات/أزياء/خدمات أم كلها؟
3. الدفع الفعلي عند الإطلاق: COD فقط؟ حوالة؟ محفظة؟ Stripe؟
4. الشحن: شحن التاجر، أسطول المنصة، شركات شحن، أم pickup؟
5. source of truth للـ ERP والمخزون والفواتير.
6. نموذج الربح الأول: اشتراك، عمولة، إعلان، أو مزيج.
7. سياسة المنتجات الممنوعة والمرتجعات والنزاعات.

### المخرج

وثيقة Launch Scope من صفحة واحدة فيها:

```text
Persona + Jobs To Be Done + Features In/Out + KPIs + Payment/Shipping model + Launch geography
```

---

## المرحلة 1 — Product Core Experience (3–4 أسابيع)

### العميل

- Checkout متعدد المتاجر على خطوات واضحة.
- اختيار عنوان محفوظ.
- شحن محسوب وقواعد تغطية.
- صفحة نجاح وفشل للطلبات المتعددة.
- order tracking timeline.
- return/dispute flow مفهوم للعميل.
- صفحة المنتج: سياسة الشحن/الإرجاع، Q&A، تقييمات محسنة، availability/ETA.

### التاجر

- Merchant Launch Checklist.
- Daily Work Queue.
- Product Workspace بخطوات بدل النماذج الثقيلة المتعددة.
- product quality score.

### معايير الإغلاق

- عميل جديد يستطيع إنشاء طلب كامل دون تدخل بشري.
- تاجر جديد يستطيع فتح متجر وإضافة منتج وقبول طلب خلال أقل من 20 دقيقة.
- لا توجد خطوات تعتمد على بيانات demo أو إدخال يدوي غير واضح.

---

## المرحلة 2 — Catalog, Variants & Inventory Excellence (3 أسابيع)

- Variant matrix editor.
- صور حسب اللون/المتغير.
- import/export CSV/XLSX مع preview/errors.
- Q&A للمنتج.
- review moderation ورد التاجر.
- lifecycle للنشر والمراجعة والأرشفة.
- low stock forecast وتنبيهات قابلة للتنفيذ.
- branch stock transfer إذا كانت الفروع ضمن نطاق الإطلاق.

### معايير الإغلاق

- 1000 منتج/متغير قابل للإدارة دون بطء واضح.
- لا تكرار SKU.
- كل حركة مخزون قابلة للتتبع والشرح.

---

## المرحلة 3 — Offers, Coupons & Ads Monetization (3–4 أسابيع)

- Rules engine للعروض والكوبونات.
- offer calendar/scheduling.
- rule precedence وstackability.
- customer eligibility explanation.
- impression/click/conversion tracking.
- campaign budgets/pacing.
- ad billing/ledger/invoice.
- reporting: CTR/CPC/ROAS/conversion.

### معايير الإغلاق

- التاجر يستطيع إنشاء عرض أو حملة، يعرف سبب قبول/رفضها، ويرى الأداء المالي الحقيقي.
- الأدمن يستطيع إيقاف إعلان أو عرض دون أثر مخزون/مالي غير محسوب.

---

## المرحلة 4 — Admin Control & Content (2–3 أسابيع)

- Unified Admin Work Queue.
- Customer 360 profile.
- CMS public renderer + preview/versioning.
- menu builder فعلي.
- Audit filtering/export/correlation.
- تقارير CSV/PDF وجدولة التقارير.
- approval SLA وassignment للموظفين.

---

## المرحلة 5 — Finance, ERP & Multi-tenant (4–6 أسابيع)

- Financial close/reconciliation runbook حي.
- payout approval workflow.
- ERP connector certification.
- conflict policies per entity.
- durable sync monitoring/replay.
- Multi-tenant context/RLS فقط إذا كان white-label ضمن خطة الربح.

---

## المرحلة 6 — Quality, Scale & Launch Readiness (بالتوازي)

- API client موحد وtyped contracts/OpenAPI.
- Pagination/filtering standard لكل القوائم الكبيرة.
- Rate limit policy حسب public/auth/search/upload/webhook.
- Route integration tests مع Postgres حقيقية مؤقتة.
- Playwright E2E في CI.
- Coverage targets:
  - 50% عام في البداية.
  - 70% للـ core.
  - 85%+ للمصادقة/الدفع/المخزون/الطلبات.
- performance budget وbundle analysis.
- metadata/SEO/accessibility audit.

---

# 6) ترتيب التنفيذ المقترح للأشهر الثلاثة الأولى

| الفترة | المخرج الرئيسي |
|---|---|
| الأسبوع 1 | Launch Scope + KPI + Payment/Shipping/ERP decision |
| الأسبوع 2–4 | Customer checkout + merchant onboarding + product workspace |
| الأسبوع 5–7 | Catalog/variants/import/Q&A/reviews/inventory UX |
| الأسبوع 8–10 | Offers/coupons + ad tracking/billing foundation |
| الأسبوع 11–12 | Admin work queue + CMS public + quality/SEO/tests |

الـ ERP المتقدم وMulti-tenancy لا يبدأان بالتوازي إلا إذا كانا مطلوبين تعاقديًا للإطلاق الأول.

---

# 7) مؤشرات نجاح المنتج المقترحة

## العميل

- نسبة تحويل البحث إلى صفحة المنتج.
- نسبة إضافة للسلة.
- checkout completion rate.
- order cancellation rate.
- return/dispute rate.
- متوسط زمن إكمال الطلب.

## التاجر

- زمن أول منتج نشط.
- نسبة المتاجر المكتملة readiness > 80%.
- نسبة الطلبات المقبولة خلال SLA.
- stockout rate.
- GMV لكل متجر.
- استخدام العروض والإعلانات.

## المنصة

- عدد المتاجر النشطة أسبوعيًا.
- GMV / orders / AOV.
- نسبة الطلبات المدفوعة/المسلمة.
- commission collected.
- ad revenue.
- ERP sync success rate.
- DLQ count ومدة معالجة الحوادث.

---

# 8) قرارات مطلوبة من مالك المنتج قبل البدء

اختر أو أجب عن التالي لنحوّل الخطة إلى backlog تنفيذي دقيق:

1. ما هو قطاع الإطلاق الأول؟
2. ما هي المدينة/المحافظة الأولى؟
3. ما هي طرق الدفع الفعلية في أول نسخة؟
4. من يدير الشحن؟
5. هل ERP مطلوب لتاجر واحد تجريبي أم لكل التجار من البداية؟
6. هل الإيراد الأول من عمولة، اشتراك، إعلانات، أم مزيج؟
7. هل Multi-tenancy/white-label جزء من الإطلاق أم مؤجل؟
8. ما أهم هدف لأول 90 يومًا: عدد المتاجر، GMV، الطلبات، أم الاشتراكات؟

---

## الخلاصة

المشروع لديه أساس تقني أكبر من نطاق الإطلاق المطلوب حاليًا. النجاح في المرحلة التالية يعتمد على **تقليل التشعب، إتقان الرحلات الأساسية، ثم قياس التحويل والتشغيل**، وليس على زيادة عدد الجداول أو صفحات الأدمن.
