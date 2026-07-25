# تقرير تنفيذ نموذج إيرادات المنصة الموحد

**التاريخ:** 14 يوليو 2026  
**الحالة:** تم تنفيذ النموذج محلياً في المصدر، ولم تطبق migrations أو تنشر المسارات على Staging/Production.  
**قاعدة الحوكمة:** **لا إضافة بدون حساب التوسع، ولا إضافة بدون حساب الصيانة.**

## القرار التجاري الذي نُفذ

```text
أموال العميل → التاجر مباشرة
إيرادات المنصة → إيجار + عمولة مبيعات + إعلانات/ظهور مميز + إضافات
```

المنصة لا تنشئ رصيداً للتاجر ولا طلب سحب في نموذج الإطلاق الافتراضي. تغير البيئة الجديد الآمن:

```text
PLATFORM_CUSTOMER_MONEY_MODE="merchant_collects"
```

ولا يمكن تفعيل مسار settlement/payout القديم إلا بقيمة بيئية صريحة ومراجعة حوكمة منفصلة.

## ما تم بناؤه

### 1. تحديد نموذج التعامل المالي لكل تاجر من الأدمن

أضيفت شروط مستقلة لكل متجر في جدول:

```text
merchant_revenue_terms
```

ويختار الأدمن أحد النماذج التالية:

| القيمة | المعنى |
|---|---|
| `monthly_rent` | إيجار شهري فقط |
| `sales_commission` | عمولة مبيعات فقط |
| `hybrid` | إيجار شهري + عمولة مبيعات |

وتشمل الشروط:

- قيمة الإيجار الشهري.
- نسبة العمولة.
- العملة.
- أيام الاستحقاق.
- أيام السماح قبل التعليق.
- فترة الفعالية والإصدار/version.
- رابط اختياري للعقد القانوني مع snapshot للشروط داخل metadata العقد.

عند تفعيلها، تمنع تلقائياً إصدار فاتورة إيجار legacy منفصلة لنفس المتجر، حتى لا يحدث ازدواج في الإيجار.

### 2. اتفاق الترويج منفصل عن عقد الإيجار

أضيف:

```text
merchant_promotion_agreements
```

وهو اتفاق مستقل تماماً عن شروط الإيجار/العمولة، ويحدد:

- رسوم بنر الصفحة الرئيسية.
- رسوم المنتج المميز في الواجهة.
- رسوم المتجر المميز.
- فترة وشروط الاتفاق والإصدار.

عند اعتماد الحملة المؤهلة، يسجل رسم ظهور ثابت idempotent في `ad_billing` بمفتاح حدث فريد. لا يُخلط هذا الرسم بعقد الإيجار، لكنه يدخل لاحقاً كسطر مستقل في الكشف الموحد.

### 3. تقرير مبيعات شهري للتاجر أو ERP/API

أضيف:

```text
merchant_sales_reports
```

تدفق التقرير:

```text
التاجر / ERP API
  → تقرير مبيعات لفترة محددة
  → submitted
  → مراجعة أدمن: approved أو rejected
  → العمولة لا تحسب قبل approved
```

المسارات:

```text
POST /api/merchant/platform-revenue/sales-reports
POST /api/integrations/sales-reports
PATCH /api/admin/platform-revenue/sales-reports/{id}
```

مسار ERP/API يتطلب scope جديداً:

```text
sales_reports:write
```

ولا يصدر التقرير الخارجي فاتورة مباشرة؛ يبقى اعتماد الأدمن إلزامياً قبل العمولة.

### 4. كشف شهري موحد واحد للتاجر

أضيف:

```text
merchant_platform_statements
merchant_platform_statement_lines
```

ويُنشأ كشف واحد فقط لكل:

```text
store + calendar month
```

بواسطة `source_key` وPostgreSQL advisory lock، لمنع تكرار cron أو إعادة الإرسال.

يجمع الكشف البنود التالية بوضوح:

```text
rent          → الإيجار الشهري بحسب الشروط
commission    → تقرير مبيعات معتمد × نسبة العمولة
advertising   → فواتير حملات وإعلانات الظهور
addon         → الإضافات المستحقة في دورة الشهر
adjustment    → مهيأ للتسوية المستقبلية
```

ويظهر كل بند ومصدره داخل تفاصيل الكشف للتاجر والأدمن.

### 5. سداد إيرادات المنصة فقط

أضيفت دورة إثبات سداد لكشف المنصة:

```text
issued / overdue
  → payment_submitted
  → approve_proof أو mark_paid
```

ويتحقق النظام من ملف إثبات مرفوع في المسار المخصص:

```text
platform-revenue-payment-proofs/
```

هذا السداد يخص الإيجار/العمولة/الإعلان للمنصة فقط، ولا يرتبط بأي طلب عميل أو مبيعات متجر.

### 6. التأخر والسماح وتعليق المتجر

cron يومي:

```text
GET /api/cron/platform-revenue/run?limit=250
30 7 * * *
```

ينفذ:

```text
issued بعد تاريخ الاستحقاق → overdue
overdue بعد graceEndsAt → freeze store + pause active/approved ad campaigns
```

ولا يعيد تفعيل المتجر عند السداد إلا إذا:

- لم تعد هناك كشوف overdue أخرى للمتجر.
- كان التعليق مسجلاً من نظام إيرادات المنصة نفسه.

وهذا يمنع إلغاء تعليق أمني أو إداري مختلف بطريق الخطأ.

### 7. منع المنصة من العمل كوسيط مالي للمبيعات

تم تعديل النموذج الافتراضي بحيث:

- تسويات الطلبات المدفوعة لا تنشئ merchant ledger أو رصيداً قابلاً للسحب في وضع `merchant_collects`.
- صفحة مالية التاجر تشرح الدفع المباشر للتاجر وتوجهه إلى وسائل دفع المتجر أو إيرادات المنصة.
- API طلب السحب يرفض الطلب في نموذج `merchant_collects`.
- API اعتماد طلبات payout للأدمن يرفض العملية في النموذج نفسه.
- واجهة أدمن المالية لا تعرض مسار payouts في الوضع الافتراضي، وتوجه إلى `/admin/platform-revenue`.
- سياسة ERP source-of-truth أصبحت:

```text
settlements = merchant
```

مع بقاء inventory/invoice authority حسب وضع ERP المعتمد.

### 8. واجهات وصلاحيات

واجهات جديدة:

```text
/admin/platform-revenue
/merchant/platform-revenue
```

الصلاحيات الجديدة:

```text
platform_revenue.terms.manage
platform_revenue.promotions.manage
platform_revenue.sales_reports.review
platform_revenue.statements.view
platform_revenue.statements.issue
platform_revenue.statements.settle
store.platform_revenue.view
store.platform_revenue.sales_report.submit
```

كما أضيفت تقارير المبيعات والكشوف المتأخرة إلى Unified Admin Work Queue.

## Migration

أضيفت migration:

```text
drizzle/0066_platform_revenue_terms_sales_reports_consolidated_statements.sql
```

وتتضمن:

- `store_rental_agreements.consolidated_billing`.
- شروط إيراد المنصة.
- اتفاقات الترويج المنفصلة.
- تقارير المبيعات.
- الكشوف الموحدة وبنودها.
- صلاحيات النظام الجديدة.

أضيفت فوراً إلى:

```text
drizzle/meta/_journal.json
```

## أثر التوسع Scalability

| المجال | القرار |
|---|---|
| منع الازدواج | `source_key` فريد للكشف حسب متجر/شهر، وفهارس خطوط المصدر. |
| التزامن | advisory lock لكل متجر وفترة؛ لا يوجد lock عام. |
| cron | تشغيل يومي idempotent: يبني الشهر السابق عند الحاجة ويراقب overdue/grace يومياً. |
| التقارير | تفاصيل البنود تستعلم بأثر واحد مجمع حسب statement IDs، لا N+1 لكل كشف. |
| الإعلانات | رسوم الواجهة تسجل مرة واحدة بـevent key يضم campaign + fee type + agreement version. |
| ERP/API | تقرير API محمي بـintegration scope ومتجر مسموح، ويبقى بانتظار اعتماد أدمن. |

## خطة الصيانة والمراقبة

- **المالك:** فريق Finance/Collections مع صلاحيات منفصلة للشروط، اعتماد تقرير المبيعات، إصدار الكشف، وتسوية السداد.
- **Audit:** شروط الإيراد، اتفاق الترويج، تقرير المبيعات، إصدار كشف، التسوية والإلغاء تسجل في Audit Log.
- **إشعارات/طابور:** إشعار الأدمن عند رفع تقرير أو إثبات سداد؛ Work Queue يجمع التقارير والكشوف المتأخرة.
- **Retry:** إنشاء البيان وcron قابلان للإعادة بلا ازدواج عبر source key/fk indexes.
- **DLQ:** لا يوجد اتصال خارجي داخل الحساب. تكامل ERP يمر عبر client scope؛ عند تشغيل Agent الحقيقي يلزم queue/DLQ كما هو موثق في بنية ERP.
- **Rollback:** لا تُحذف فواتير أو قيود. يمكن إيقاف terms لتجنب إنشاء كشوف جديدة بعد مراجعة مالية، مع بقاء legacy invoices قابلة للقراءة.

## التوافق

- لم تُهجر فواتير الإيجار أو الإعلانات القديمة.
- الانتقال **opt-in لكل متجر**: يبدأ فقط حين يحفظ الأدمن `merchant_revenue_terms`.
- حينها يصير `consolidated_billing=true` ويمنع cron الإيجار القديم لهذا المتجر من إنشاء فاتورة rent مستقلة.
- الكشوف القديمة أو فواتير الإعلانات غير المسددة تبقى مصادر قابلة للعرض؛ الكشف الموحد يضم فقط فواتير الإعلان المؤهلة غير المسددة ويحولها إلى `consolidated` عند الإصدار.

## التحقق المحلي

| الفحص | النتيجة |
|---|---|
| `npm run lint` | ناجح |
| `NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck` | ناجح |
| `npm test` | **44 ملفاً / 124 اختباراً ناجحاً** |
| اختبار policy الجديد | `tests/platform-revenue-policy.test.ts` — 5 اختبارات ناجحة |
| اختبار direct customer money | `tests/customer-money-policy.test.ts` — ناجح |
| `npm run migrations:verify` | ناجح — **67 SQL / 67 journal entries** |
| `npx drizzle-kit check --config=drizzle.config.ts` | `Everything's fine` |
| `npm run security:verify` | ناجح؛ لا أسرار معروفة و`npm audit --omit=dev` = 0 vulnerabilities |
| `git diff --check` | ناجح |

## قيود واعتمادات متبقية

1. لم تطبق migration `0066` على Staging أو Production، ولم ينشر cron أو الصفحات.
2. لا يوجد مزود دفع/تحويل حي لإيرادات المنصة؛ الدورة الحالية تدعم إثبات تحويل ومراجعة أدمن فقط.
3. لا توجد فاتورة ضريبية قانونية أو اتصال مصرفي مباشر حتى يتم اعتماد مزود مالي وسياسة ضريبية وقانونية.
4. لم يتم اختبار transaction الحية مع PostgreSQL مؤقتة أو سيناريو cron على Staging؛ الاختبارات الحالية unit/policy/type/static checks.
5. تسعير الإيجار v1 ثابت لكل شهر عندما تكون الشروط فعالة داخل الفترة؛ لا توجد prorating تلقائية للأشهر الجزئية حتى تعتمد سياسة تجارية لها.
6. مسار `platform_settlement` التاريخي بقي في المصدر لتوافق البيانات فقط، لكنه غير مفعل افتراضياً ولا ينبغي تشغيله دون قرار مالي وقانوني مستقل.
7. لم يُشغّل `next build` في Arena بسبب قيد الذاكرة المعروف؛ يؤكد في GitHub Actions/Vercel.

## نظافة التسليم

بعد تنفيذ الفحوصات أعيد حذف `node_modules/` وcoverage و`tsconfig.tsbuildinfo` لأنها ملفات مولدة فقط. إعادة بيئة التطوير تتم بصورة قابلة للتكرار عبر:

```bash
npm ci
```

## خطوات تشغيل آمنة قبل الإطلاق

1. تطبيق migrations حتى `0066` على Staging فقط أولاً.
2. للأولوية، اضبط شروط إيراد تجريبية لمتجر واحد فقط.
3. أنشئ اتفاق ترويج منفصل، واعتمد حملة Homepage تجريبية للتأكد من رسم placement.
4. أرسل تقرير مبيعات للشهر السابق، راجعه كأدمن، ثم تحقق من الكشف الموحد وبنوده.
5. اختبر إثبات السداد وoverdue/grace مع تواريخ Staging، ثم راجع pause ads/freeze store وإعادة التفعيل.
6. قبل الإنتاج، اختر مزود تحصيل خاصاً بإيرادات المنصة فقط ولا تخلطه بوسائل دفع العميل للتاجر.
