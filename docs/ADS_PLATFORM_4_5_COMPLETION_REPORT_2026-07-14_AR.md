# تقرير تطوير 4.5 — الإعلانات والمنصة الإعلانية

**التاريخ:** 14 يوليو 2026  
**الحالة:** تم استكمال حزمة تشغيلية/مالية/تحليلية للإعلانات داخل المشروع محلياً، مع توثيق القيود الخارجية بوضوح.  
**قاعدة الحوكمة المطبقة:** **لا إضافة بدون حساب التوسع، ولا إضافة بدون حساب الصيانة.**

> هذا التقرير لا يعني نشر التغييرات أو تطبيق migration على Staging/Production، ولا يعني وجود تحصيل مالي أو مزود دفع حي.

## 1) ما كان موجوداً فعلياً قبل الحزمة

كانت هناك حملات ومزايدات وميزانيات وجداول أحداث، وموافقة أدمن، وبنر رئيسي، ومساعد تصميم بالذكاء. كما كان هناك أساس جيد من deduplication وpacing وattribution و`ad_reports`.

الفجوة المتبقية كانت تحويل ذلك إلى منصة Ads مترابطة: مواضع عرض معيارية، Sponsored Products فعلية لا بنرات فقط، نموذجا CPC/CPM، دفتر وفاتورة صريحان، fraud policy، وعرض أداء creative/recommendations قابل للتفسير.

## 2) المنفذ

### أ. Sponsored visibility، المواضع، والسلامة

- أضيفت `placement_id` معيارية للحملات، مع backfill آمن للحملات القديمة:
  - `homepage_sponsored_products`
  - `homepage_featured_products`
  - `homepage_marketplace_ads`
  - `search_results`
  - `category_listing`
  - `storefront`
- أصبحت واجهة إنشاء الحملة تختار موضع العرض ولا تسمح بموضع لا يطابق نوع الحملة.
- حملة Sponsored/Featured تتطلب منتجاً واحداً على الأقل.
- أضيفت خدمة `lib/ads/marketplace.ts` للترتيب الممول بوضوح:
  - `bid + relevance + quality + store health + availability`
  - حد أقصى منتجان لكل متجر في مجموعة الإعلان لتجنب الاحتكار.
  - تستبعد المنتج غير النشط/المباع/عديم المخزون والمتجر المعلق أو غير النشط.
- أضيفت منتجات ممولة فعلية إلى الصفحة الرئيسية، بوسم **إعلان ممول** منفصل تماماً عن المنتجات العضوية.
- أضيفت منتجات ممولة إلى البحث الذكي (`search_results`) وبوسم واضح منفصل عن النتائج العضوية.
- impression لا يسجل إلا بعد ظهور 50% من الإعلان في الشاشة، مع `event_key` حتمي وfrequency cap يومي على مستوى الخادم.
- لا تُخزن معرفات المتصفح أو IP الخام؛ تستخدم Hash أحادي الاتجاه فقط.

### ب. CPC/CPM، الميزانية والدفتر والفواتير

- أضيف `billing_model` للحملة:
  - **CPC:** تسعير النقرة النظيفة.
  - **CPM:** تسعير الألف ظهور، وتسجل تكلفة الظهور (`bid / 1000`).
- أضيف `frequency_cap` قابل للضبط لكل حملة ضمن 1–20.
- أضيفت `ad_budget_reservations` كـ**حجز تشغيلي** للحد المسموح صرفه، مع قيم reserved/consumed/released/status.
  - ليس رصيداً مالياً، ولا خصماً من حساب أو دليلاً على أن التاجر دفع.
- أضيفت أقفال PostgreSQL لكل حملة في الحدث المالي، لتفادي تجاوز الميزانية مع الزيارات المتزامنة.
- `ad_billing` أصبح دفتر تكلفة مربوطاً بـ`event_key`، ويحفظ تكلفة CPC أو CPM مرة واحدة فقط.
- الإيقاف التلقائي عند استهلاك الحد اليومي أو الكلي بقي مفعلاً، ويوقف بنر الحملة المشتق عند اللزوم.
- أضيفت:
  - `ad_invoices`
  - `ad_invoice_lines`
  - ربط `ad_billing.invoice_id`
- يتم إصدار فواتير القيود المستحقة لليوم UTC السابق بشكل idempotent عبر `source_key`:
  - cron: `/api/cron/ads/billing?limit=100` الساعة 08:20 UTC.
  - تشغيل أدمن يدوي محمي من صفحة `/admin/ads-platform/billing`.
- تسوية الفاتورة (`paid` أو `void`) تتطلب صلاحية أدمن دقيقة وتأكيداً بملاحظة وسجل Audit.
- التاجر يرى تاريخ فواتيره داخل `/merchant/ads`.

### ج. الأداء والتحليلات وA/B creative

- تم توسيع materialized `ad_reports` بـ:
  - `cvr`
  - `invalid_clicks`
- تستبعد مؤشرات CTR/CVR المدفوعة النقرات المصنفة `invalid` من النقرات النظيفة.
- أضيفت سياسة fraud أولية قابلة للتفسير:
  - User-Agent لأتمتة/Headless/crawler.
  - سرعة النقر للزائر داخل 15 دقيقة.
  - سرعة النقر للشبكة (Hash) داخل 15 دقيقة.
  - الحالات: `clean` / `suspected` / `invalid`.
  - النقرات suspected/invalid تحفظ للمراجعة لكنها لا تنشئ تكلفة في دفتر الحملة.
- أضيف جدول `ad_fraud_signals` بسجل الأدلة دون IP أو visitor ID خام.
- أصبحت حملة Banner تدعم نسخة B اختيارية من نموذج الإنشاء:
  - Cohort ثابت داخل المتصفح باستخدام مفتاح محلي غير معرف للخادم.
  - يرسل العميل `creativeVariantId` فقط مع حدث الإعلان؛ الخادم يحفظ Hash الزائر المعتاد ولا يحتفظ بالقيمة الخام.
  - تظهر إحصاءات النسخ المسجلة خلال آخر 7 أيام داخل صفحة التاجر.
  - لا يوجد اختيار فائز تلقائي أو تعديل ذاتي للحملة؛ ذلك قرار مراجعة صريح.
- أضيفت توصية explainable للـbid والميزانية لآخر 7 أيام:
  - حالات: بيانات غير كافية، حماية الجودة، فرصة توسع، تحسين الصلة، استمرار مراقب.
  - لا تغير الحملة تلقائياً ولا تعيد تفعيل حملة موقوفة.

### د. الصلاحيات والعقود

- أضيفت صلاحيات دقيقة:
  - `ads.billing.view`
  - `ads.billing.issue`
  - `ads.billing.settle`
  - `ads.fraud.view`
  - `store.ads.billing.view`
- أضيفت عقود OpenAPI لمسارات events، recommendations، فواتير التاجر، وإدارة فواتير الأدمن.
- تمت إضافة الحماية لحالات الحملة النهائية: الحملة `ended/rejected` لا يعاد تفعيلها؛ يجب إنشاء حملة جديدة ومراجعتها بدلاً من إعادة استخدام احتياطي قديم.

## 3) تغييرات البيانات والملفات الرئيسية

### Migration

`drizzle/0065_ads_financial_marketplace_completion.sql`

يشمل additions/backfill فقط، من دون حذف بيانات قائمة:

- حقول campaign: `placement_id`, `billing_model`, `billing_state`, `frequency_cap`.
- `ad_impressions.cost`, `ad_clicks.fraud_status` وفهارس جودة النقر.
- `ad_budget_reservations`, `ad_invoices`, `ad_invoice_lines`, `ad_fraud_signals`.
- `ad_billing.invoice_id`.
- `ad_reports.cvr`, `ad_reports.invalid_clicks`.
- صلاحيات Ads الجديدة.

تمت إضافته فوراً إلى `drizzle/meta/_journal.json`.

### منطق أساسي

```text
lib/ads/marketplace.ts
lib/ads/billing.ts
lib/ads/fraud.ts
lib/ads/creative-performance.ts
lib/ads/recommendations.ts
app/api/ads/events/route.ts
app/api/cron/ads/billing/route.ts
app/api/admin/ads/invoices/route.ts
app/api/merchant/ads/invoices/route.ts
```

### واجهات

```text
/merchant/ads
/admin/ads-platform
/admin/ads-platform/billing
components/ads/merchant-sponsored-banner.tsx
components/merchant/ad-creative-experiment-panel.tsx
components/merchant/ad-recommendations.tsx
components/admin/ad-invoice-management-panel.tsx
```

## 4) أثر التوسع Scalability

- لا يجري مسح شامل للأحداث في كل صفحة: التقارير اليومية materialized، والمرشحات العامة محدودة، مع فهارس campaign/store/time/status.
- في مسار الإعلان العام، القفل على **الحملة فقط** عند حدث قابل للفوترة؛ لا يوجد قفل عالمي.
- ترتيب Sponsored Products يجلب مجموعة مرشحين محدودة ثم يطبق eligibility/ranking وحد المتجر في الذاكرة، دون N+1 لكل بطاقة.
- الفواتير تعتمد `source_key` فريداً، لذلك إعادة cron لا تنشئ فاتورة مكررة.
- بيانات A/B تُستعلم ضمن 7 أيام وبفلتر store/time مفهرس؛ لا تستخدم معرفات زوار خام أو cohorts مشتركة بين متاجر.

## 5) خطة الصيانة والمراقبة

| البند | الخطة |
|---|---|
| المالك | فريق Ads/Finance في الأدمن؛ فصل صلاحيات العرض والإصدار والتسوية. |
| سجلات التدقيق | اعتماد الحملة، إصدار الفواتير، التسوية والإلغاء تسجل في Audit Log. |
| المراقبة | cron pacing والتقارير قائم، وcron billing الجديد idempotent. يجب تنبيه التشغيل عند فشل cron أو ارتفاع `invalid` clicks. |
| Retry | إعادة تنفيذ cron الفواتير آمنة عبر `source_key` ومفاتيح invoice line الفريدة. |
| DLQ | لا يوجد مزود خارجي في مسار التحصيل الحالي. أي مزود مستقبل يجب أن يستخدم queue/DLQ وwebhook موثق. |
| التراجع | أوقف الحملة/الموضع أو ضع الفاتورة `void`؛ لا تحذف قيود ledger أو الفواتير. |

## 6) التوافق والأمان

- الحقول schema additive، والحملات القديمة تتلقى placement متوافقاً حسب نوعها ونموذج CPC افتراضي.
- الاحتياطي التشغيلي ينشأ lazy عند الاعتماد/الحدث ولا يزعم تحويل تاريخ الصرف إلى مدفوعات محصلة.
- لم تُخزن أسرار أو IPs أو visitor IDs الخام.
- حماية صلاحيات السيرفر هي المرجع؛ واجهات العميل ليست بديلاً عنها.

## 7) التحقق المنفذ محلياً

| الفحص | النتيجة |
|---|---|
| `npm run lint` | ناجح |
| `NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck` | ناجح |
| `npm test` | **42 ملفات / 118 اختباراً ناجحاً** |
| اختبارات Ads الجديدة | `tests/ad-platform-completion.test.ts` — 6 اختبارات ناجحة |
| `npm run migrations:verify` | ناجح — **66 SQL / 66 journal entries** |
| `npx drizzle-kit check --config=drizzle.config.ts` | `Everything's fine` |
| `npm run security:verify` | ناجح؛ لا أسرار معروفة و`npm audit --omit=dev` = 0 vulnerabilities |
| `git diff --check` | ناجح |

## 8) قيود واعتمادات خارجية متبقية

1. **لم تطبق migration 0065 على Staging أو Production** ولم ينشر أي مسار.
2. الحجز `ad_budget_reservations` تشغيلي؛ لا يوجد gateway/محفظة/رصيد تجاري فعلي لخصم أو تحصيل الفاتورة تلقائياً.
3. فواتير Ads تشغيلية داخل المنصة وليست شهادة ضريبية أو فاتورة قانونية حتى يعتمد نموذج التحصيل والضريبة والمزود المالي.
4. لم يتم تشغيل Playwright أو Route integration على PostgreSQL مؤقت حقيقي أو Staging من هذه البيئة.
5. كشف fraud هو طبقة قواعد أولية؛ لا يدعي ML، device fingerprinting، أو مزود مكافحة احتيال خارجي. يلزم قبل الإطلاق المالي مراجعة thresholds ومراقبة false positives على Staging.
6. A/B creative مقصور على Banner A/B (A وB/C حتى ثلاث نسخ) مع عرض الأداء؛ لا يوجد اختيار winner تلقائي أو multi-armed bandit، عمداً لتفادي تغيير إنفاق أو محتوى بلا مراجعة.
7. لم يُشغّل `next build` بسبب قيد ذاكرة بيئة Arena المعروف؛ يؤكد في GitHub Actions/Vercel.

## 9) خطوات التشغيل قبل الإطلاق

1. تطبيق migrations من `0057` حتى `0065` عبر workflow المعتمد على Staging أولاً، بلا seed إنتاجي.
2. إنشاء حملتين تجريبيتين فقط: CPC وCPM، وربط منتج ذي مخزون مؤكد ومتجر نشط.
3. اختبار: impression dedup، click attribution، cap، auto-pause، run cron للفواتير، ثم تسوية أدمن على Staging.
4. تهيئة تنبيه لفشل cron وارتفاع fraud signals ومراجعة مالية يومية للـledger مقابل invoices.
5. اختيار مزود تحصيل وسياسة قانونية/ضريبية قبل تفعيل دفع فواتير التاجر أو اعتبار `paid` آلياً.
