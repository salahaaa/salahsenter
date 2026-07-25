# فحص متعمق لمنصة الإعلانات

**التاريخ:** 2026-07-16  
**نوع العمل:** مراجعة static/code audit، بلا تعديل أو تشغيل على بيانات حية  
**النطاق:** التاجر → اعتماد الأدمن → التوزيع → القياس → منع الاحتيال → الفوترة → التحليلات

## الحكم التنفيذي

منصة الإعلانات تمتلك **بنية متقدمة وقوية** مقارنةً بنظام إعلانات أولي:

- حملات CPC وCPM.
- مواضع محددة للحملات وليس خلطاً مع الترتيب العضوي.
- وسم مرئي «إعلان ممول».
- تدقيق، مراجعة أدمن، ميزانية كلية ويومية، ledger وفواتير مستقلة للتاجر.
- إسناد تحويلات الطلبات، تقارير CTR/CVR/ROAS، توصيات AI غير ذاتية التنفيذ.
- hash لمعرف الزائر وIP، dedupe للأحداث، pace locks، وحماية أولية للنقرات الآلية.
- مسار مستقل لطلبات الظهور في الرئيسية مع checkpoint مالي يدوي.

**لكنها ليست مكتملة أو جاهزة بعد لوصفها بأنها منصة إعلانات احترافية للإطلاق المالي واسع النطاق.** توجد فجوات حرجة في تطابق موضع الحملة مع التوزيع والتتبع، وحدود الظهور، والاحتيال/الفوترة، وبعض إدارة دورة حياة الحملة.

لا ينبغي إعلان CPM/CPC أو تحصيل رسوم حقيقية على نطاق واسع قبل معالجة عناصر P0 أدناه واختبارها على Staging حقيقي.

---

## ما يعمل بصورة جيدة

### التاجر

- ينشئ حملات لأنواع محددة:
  ```text
  sponsored_products
  featured_products
  homepage_banner
  category_banner
  ```
- يتحقق الخادم من نوع الحملة والموضع والمنتجات التابعة للمتجر والميزانية والتواريخ.
- محتوى البنر يحتاج صورة قبل الإرسال.
- AI يقترح نصاً وتكوينات إبداعية فقط؛ لا ينشر أو يغير السعر/المال تلقائياً.
- يدعم A/B للبانر بتوزيع cohort ثابت في العميل وتسجيل معرف النسخة.
- لوحة التاجر تعرض spend وCTR وCPC وCVR وROAS وفواتير وتوصيات.

### الأدمن والمالية

- مراجعة واعتماد وإيقاف ورفض الحملات محكومة بصلاحيات تشغيلية.
- فواتير CPC/CPM تُنشأ من ledger يومي idempotent، ولا يساوي الحجز التشغيلي تحصيلاً مالياً.
- تسوية الفاتورة تدقيق إداري، لا تلتقط المنصة أموال العميل.
- توجد reservations تشغيلية وحماية من تجاوز الميزانية اليومية والإجمالية، وCron كـ backstop.
- banner رئيسي يمكن ربطه بالحملة والإيقاف معه.

### القياس والحماية

- أحداث الظهور والنقر تحمل event key، وتستخدم transaction/advisory lock قبل charge.
- CTR/CVR/ROAS تعتمد على تحويلات طلبات تم تسليمها.
- النقرات الآلية أو السريعة تسجل كإشارات ولا تصبح قابلة للفوترة عند `suspected` أو `invalid`.
- hash للمعرفات يمنع حفظ visitorId وIP الخام في الجداول.

---

## مسارات التوزيع التي تم التحقق منها

| الموضع | حالة التنفيذ الحالية |
|---|---|
| `homepage_sponsored_products` | موجود ومربوط ببطاقات معلنة ومتتبع أحداث. |
| `homepage_featured_products` | موجود عبر محرك sponsored products. |
| `search_results` | موجود ومربوط بنتائج البحث المعلنة. |
| `homepage_marketplace_ads` | موجود لحملات homepage banner عبر MerchantSponsoredBanner. |
| `homepage_exposure` | موجود كمسار مستقل بطلب/مراجعة/جدولة/checkpoint مالي. |
| `category_listing` | يمكن إنشاؤه في الحملة، لكن لم يثبت renderer فعلي له في الواجهة. |
| `storefront` | يمكن إنشاؤه في الحملة، لكن لم يثبت renderer فعلي له في واجهة المتجر. |

---

# فجوات حرجة P0

## P0-1 — مواضع قابلة للإنشاء بلا renderer فعلي

الخادم يسمح بموضعي:

```text
category_listing
storefront
```

لكن مراجعة الاستدعاءات الفعلية لـ `getSponsoredProductsForPlacement` تثبت استخدامه للرئيسية والبحث فقط، وليس لقائمة قسم أو واجهة متجر.

**الأثر:** قد يدفع التاجر أو تعتمد الحملة لموضع لا يظهر فيه الإعلان فعلياً.

**الإصلاح:**

- إما بناء renderers متتبعة لهذين الموضعين مع اختبارات E2E.
- أو منع المواضع من نموذج التاجر وAPI حتى توجد واجهات العرض.

## P0-2 — تكرار بنر الرئيسية واختلاف مسار التتبع

عند اعتماد `homepage_banner`:

1. يظهر الإعلان عبر `MerchantSponsoredBanner` في `homepage_marketplace_ads` مع tracker.
2. وينشئ الأدمن في الوقت نفسه banner عاماً في موضع `homepage_promo`.

الـ banner العام لا يحمل علاقة campaign/creative tracker ظاهرة، ما قد ينتج عنه ظهور إضافي غير مقاس أو إعلان مزدوج.

**الأثر:** تضارب في التوزيع، انطباعات غير دقيقة، وصعوبة تقرير ما دفعه التاجر.

**الإصلاح:** اختيار مصدر عرض واحد للحملة:

```text
campaign delivery renderer + SponsoredAdTracker
```

ولا ينشأ banner عام إلا إذا حمل `campaignId` صريحاً ويستخدم نفس tracking/billing path.

## P0-3 — عدادات حدود الظهور للرئيسية لا تُحدّث

جدول:

```text
ad_campaign_delivery_counters
```

يُقرأ في بوابة `homepage_exposure` لإيقاف الحملة عند impression/click cap، لكن لا يوجد مسار كتابة ظاهر له من `/api/ads/events`.

**الأثر:** caps الخاصة بطلبات الظهور في الرئيسية قد لا تعمل مهما استمر وصول الأحداث.

**الإصلاح:** upsert ذري للعداد داخل transaction الحدث بعد dedupe الناجح، ثم اختبار:

```text
event → counter increment → cap reached → status paused → notification → cache invalidation
```

## P0-4 — frequency cap المعروض للتاجر غير مطابق للواقع

تسمح الحملة بقيمة `frequencyCap` من 1 إلى 20، لكن event key للظهور يُفرد مرة واحدة لكل:

```text
campaign + placement + visitor + UTC day
```

وبالتالي لا يمكن تسجيل أكثر من ظهور واحد يومياً للزائر، مهما كانت قيمة cap أكبر من 1.

**الأثر:** إعداد واجهة مضلل، وCPM تحت القياس/الفوترة، وعدم تطابق سياسة delivery مع المنتج المعروض للتاجر.

**الإصلاح:**

- إن كانت السياسة المقصودة مرة يومياً: إزالة الحقل أو تثبيته على 1.
- إن كانت السياسة المقصودة 1–20: جعل event key يتضمن impression bucket/sequence، مع حفظ cap ذري لكل زائر وحملة وموضع.

## P0-5 — CPM لا يملك طبقة جودة ظهور كافية

تقييم الاحتيال مطبق للنقرات فقط. ظهور CPM القابل للفوترة يعتمد على visitorId يرسله العميل، مع rate limit IP عام.

**الأثر:** عميل ضار يستطيع تغيير visitorId أو تدوير بصمات المتصفح لزيادة الظهور القابل للفوترة ضمن سقف الطلبات.

**الإصلاح:** قبل تفعيل CPM المالي:

- جودة ظهور: زمن ظهور أدنى، viewport ratio/مدة، referer/origin تحقق، velocity per IP hash وvisitor hash، كشف headless، session consistency.
- وضع `pending_quality` للظهور ثم billing بعد قبول الجودة أو قواعد موثقة.
- fraud signals ومراجعة/اعتراض/credit جزئي للـ ledger.

---

# فجوات مهمة P1

## P1-1 — visibility schedule غير موحد في serve/tracking

`visibilitySchedule` مخزن في الحملة ويستخدم في بعض مسارات الرئيسية، لكن:

- محرك sponsored products لا يطبقه صراحة عند الاختيار.
- `/api/ads/events` لا يتحقق منه قبل تسجيل/faturing charge.
- `isTrackableAdCampaign` يتحقق من start/end فقط.

**الإصلاح:** دالة eligibility موحدة واحدة تستخدمها:

```text
renderer
marketplace selection
tracking endpoint
billing eligibility
```

مع timezone محدد `Asia/Aden` حيث تكون سياسة الحملة يومية/أسبوعية.

## P1-2 — serve لا يحجب حملة مستنفدة قبل وصول حدث جديد

محرك العرض يختار الحملات المعتمدة ضمن الفترة، لكنه لا يتحقق بوضوح من:

```text
spentAmount < budget
dailySpend < dailyBudget
billingState serving-eligible
```

الحظر الحالي يحدث عند event/cron. قد يرى المستخدم إعلاناً مستنفداً قبل أن يوقفه أول event أو cron.

**الإصلاح:** serve gate سريع ومدروس (counter/reservation أو cache minute bucket) قبل renderer، مع عدم جعل query لكل بطاقة مكلفاً.

## P1-3 — دورة التاجر غير مكتملة

لا يوجد endpoint ظاهر لتاجر كي:

```text
pause
resume
cancel pending campaign
clone/edit before approval
```

لوحة التاجر تعرض المقاييس فقط بصورة أساسية.

**الإصلاح:** أوامر نطاقية محددة مع audit:

```text
merchant.pause_campaign
merchant.resume_within_budget
merchant.cancel_pending
merchant.clone_campaign
```

ولا تسمح بتعديل creative/bid/placement لحملة معتمدة دون إعادة مراجعة عند الحاجة.

## P1-4 — رفض الحملة لا يطلب سبباً

حالة الرفض تقبل `adminNote` اختيارياً، وواجهة الأدمن لا تجمع سبب الرفض بصورة إلزامية.

**الإصلاح:** سبب رفض مطلوب، وقوالب أسباب، ورسالة واضحة للتاجر مع رابط تعديل/نسخ الحملة.

## P1-5 — لا توجد عملية مراجعة fraud أو credit للـ ledger

هناك جدول `ad_fraud_signals` وصلاحية `ads.fraud.view`، لكن لا توجد واجهة/API مراجعة متخصصة واضحة لتغيير القرار أو إصدار credit لحدث/سطر فاتورة.

**الإصلاح:** queue للـ fraud، قرار مدقق:

```text
confirm_clean | invalidate | credit
```

مع ledger عكسي idempotent، ولا حذف للأحداث أو الفواتير التاريخية.

## P1-6 — العملة وحدود اليوم

- Campaign وحدث delivery يستخدمان YER فعلياً.
- يوم الميزانية وتقارير الأداء مبنيان على UTC، بينما التشغيل المحلي يعتمد `Asia/Aden`.

**الإصلاح:** قرار عملة إعلان صريح (YER فقط في الإطلاق أو currency per campaign) وتوحيد دورة اليوم التشغيلي على timezone سياسة المنصة، مع حفظ timezone في الحملة أو سياسة الإعلانات.

---

# تحسينات P2

1. لوحة الأدمن بلا pagination/filters مفصلة حسب status/placement/store/fraud/budget.
2. لوحة التاجر تحتاج date range وbreakdown حسب الموضع والنسخة الإبداعية وحالة الفاتورة.
3. المنتج الممول لا يتحقق صراحة من `productCommerceType=ONLINE_SALES` أو publish window في محرك marketplace؛ قد يروّج صنف عرض فقط أو منتج انتهت نافذة نشره.
4. `category_banner` يحتاج creative/renderer مستقل لا مجرد قبول في schema.
5. لا يوجد تقرير reconciliation دوري بين:
   ```text
   adBilling
   adInvoiceLines
   adInvoices
   adBudgetReservations
   campaign.spentAmount
   ```
6. لا يوجد runbook كامل لانقطاع cron أو فشل invoice issuance أو double-delivery recovery.
7. يحتاج اختبار visual/a11y للوسم «إعلان ممول» في كل المواضع، لا الرئيسية والبحث فقط.

---

# متطلبات الإصلاح المقترحة

## المرحلة A — قبل أي تحصيل مالي واسع

1. توحيد campaign eligibility/visibility/schedule.
2. إصلاح counter writes وfrequency cap.
3. إيقاف المواضع غير المرسومة أو إضافة renderers لها.
4. إزالة ازدواج homepage banner وتوحيد التتبع.
5. إضافة quality gate لـ CPM ومنع billable impressions غير المكتملة الجودة.

## المرحلة B — الحوكمة والفوترة

1. سبب رفض إلزامي.
2. fraud review + credit ledger.
3. حماية serve عند budget exhaustion قبل العرض.
4. currency/timezone policy صريحة.
5. reconciliation job + alert + runbook.

## المرحلة C — تجربة التشغيل

1. أوامر التاجر لإيقاف/استئناف/إلغاء/نسخ حملة.
2. فلاتر وتقارير وexports للأدمن والتاجر.
3. اختبارات PostgreSQL integration وPlaywright للمواضع كلها.

---

# التحقق الذي لم يتم

هذه مراجعة شيفرة؛ لم يتم:

- تشغيل حملات على Staging أو Production.
- إدخال أحداث حقيقية أو تحصيل/فواتير حقيقية.
- تشغيل Redis/cron/Sentry حقيقية.
- اختبار Browser/E2E بصري للمواضع والحملات.

لذلك لا يصح وصف المنصة بأنها مراقبة إعلانياً في production قبل تنفيذ مراحل الإصلاح واختبار Staging.
