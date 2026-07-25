# نموذج الإطلاق والـ Master Backlog

**تاريخ الاعتماد:** 12 يوليو 2026  
**مصدر القرارات:** مالك المنتج  
**الحالة:** وثيقة توجيهية قبل بدء Sprint التنفيذ التالي.

---

## 1) قرارات الإطلاق المعتمدة

| المجال | القرار |
|---|---|
| القطاعات | جميع القطاعات تعمل بالتوازي عبر قوالب تشغيل قابلة للتهيئة |
| الجغرافيا | كامل محافظات اليمن |
| الدفع الأول | نقدي فقط |
| تحصيل النقد | التاجر يستلم النقد من العميل |
| الشحن | التاجر يدير الشحن والتسليم |
| الربح | عقود إيجار هجينة: إيجار أساسي + إضافات مدفوعة |
| ERP | نظام محاسبي مستقل لكل تاجر |
| Multi-tenancy | ضمن الإطلاق: مشغل مول + تاجر white-label اختياري |
| KPI لأول 90 يومًا | عدد الطلبات المكتملة |

---

## 2) تعريف المنتج

المنتج المستهدف ليس سوقًا تقليديًا فقط. هو:

> **Mall Operating System for Yemen**  
> منصة تجمع storefront متعدد المتاجر، تشغيل التاجر، عقود إيجار، شحن يديره التاجر، وربط محاسبي مستقل لكل تاجر، مع إمكانية white-label لمشغلي المولات والتجار.

### المبادئ الحاكمة

1. العميل يشتري نقدًا؛ المنصة لا تمسك النقد في الإصدار الأول.
2. التاجر مسؤول عن قبول الطلب، الشحن، التسليم، وتحديث الحالة.
3. دخل المنصة يبدأ من الإيجارات والإضافات، لا من عمولة الطلب.
4. محاسبي يبقى مصدر الحقيقة المالي/المخزني للتاجر عند الربط.
5. جميع القطاعات تستخدم محرك منتجات موحدًا، مع sector capabilities/template بدل forks في الكود.
6. اليمن كلها مدعومة في البيانات، لكن التاجر يعلن مناطق تغطيته فعليًا.
7. Multi-tenancy يطبق بعزل حقيقي، لا بمجرد جداول إضافية غير مستخدمة.

---

# 3) النموذج المالي: عقود إيجار هجينة

## 3.1 مصادر الدخل

### الإيجار الأساسي

- عقد لكل متجر رئيسي.
- عقد منفصل أو إضافة للفروع.
- دورة شهرية/ربع سنوية/سنوية.
- حالة العقد تؤثر على تشغيل المتجر، لا على ملكية بياناته.

### الإضافات المدفوعة

- فرع إضافي.
- مزايا إعلان مدفوعة.
- باقة منتجات/موظفين أكبر.
- ربط محاسبي/Agent أو دعم متميز.
- دومين white-label للتاجر أو Tenant.
- تقارير متقدمة أو API access.

## 3.2 ما لا يدخل الإصدار الأول

- عمولة نسبية من كل طلب.
- احتجاز أموال العملاء.
- payout للتاجر من المنصة في سيناريو COD الذي يستلمه التاجر.

## 3.3 ما يجب بناؤه أو إكماله

1. Rent Plan Catalog:
   - base rent.
   - branch rent.
   - add-on price.
   - grace period.
   - late fee policy.
2. Rent Invoice Lifecycle:
   - draft → issued → pending → paid → overdue → disputed → cancelled.
3. Merchant/Branch Entitlement Engine:
   - عند انتهاء العقد: وضع محدود أو إيقاف ظهور، لا حذف بيانات.
   - عند عدم دفع إضافة: إيقاف الإضافة فقط.
4. Admin Collections Queue:
   - عقود قريبة الانتهاء.
   - فواتير overdue.
   - طلبات grace/reactivation.
5. Merchant Billing Center:
   - العقد القادم.
   - الفواتير.
   - الإضافات.
   - إثبات التحويل/الدفع.

---

# 4) الدفع النقدي والشحن الذي يديره التاجر

## 4.1 دورة الطلب الأساسية

```text
Customer creates order
→ Store receives order
→ Merchant accepts / rejects
→ Merchant prepares
→ Merchant assigns internal courier or shipping method
→ Merchant marks shipped
→ Customer receives goods
→ Merchant marks delivered / closed
→ Cash is collected directly by merchant
```

## 4.2 قواعد التشغيل

- لا يظهر في checkout إلا شحن التاجر المتاح لمنطقة العميل.
- لكل طريقة شحن:
  - المحافظات/المدن/المناطق المغطاة.
  - رسوم ثابتة أو قاعدة حسب المنطقة.
  - الحد الأدنى للطلب.
  - وقت التجهيز والتسليم المتوقع.
  - خيار pickup من المتجر.
- الدفع النقدي لا يصبح `paid` تلقائيًا عند إنشاء الطلب؛ يؤكد بعد التسليم وفق سياسة التاجر.
- العميل يرى timeline واضحًا: جديد، مؤكد، قيد التجهيز، تم الشحن، تم التسليم، مغلق/ملغي.

## 4.3 Backlog الشحن اليمني

1. Coverage Matrix للتاجر: محافظة → مدينة → مديرية/منطقة.
2. Shipping Rule Engine:
   - fixed fee.
   - zone fee.
   - free-shipping threshold.
   - pickup.
3. Delivery Promise:
   - preparation minutes.
   - delivery min/max days.
4. Merchant Courier Assignment:
   - اسم المندوب/هاتفه/رقم تتبع داخلي.
5. Customer tracking UX.
6. Delivery failure reasons:
   - customer unreachable.
   - address incomplete.
   - outside coverage.
   - refused delivery.

---

# 5) جميع القطاعات بالتوازي: Sector Capability Model

لا يجب بناء 20 نظامًا مختلفًا. يبنى محرك موحد مع profile لكل قطاع.

| capability | أزياء | سوبرماركت | مطاعم | إلكترونيات | صيدلية | خدمات |
|---|---:|---:|---:|---:|---:|---:|
| Variants color/size | ✓ | محدود | محدود | ✓ | محدود | ✗ |
| وزن/وحدة بيع | محدود | ✓ | ✓ | محدود | ✓ | وقت/جلسة |
| Expiry/Batch | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ |
| خيارات مخصصة | محدود | ✗ | ✓ | ✗ | ✗ | ✓ |
| Reservation time | عادي | عادي | قصير | عادي | حساس | حسب الموعد |
| Delivery promise | عادي | سريع | سريع | عادي | سريع | موعد |
| Required compliance | عام | جودة/صلاحية | سلامة غذاء | ضمان | وصفة/تحذير | شروط خدمة |

## التنفيذ المقترح

### المرحلة الأولى من القطاعات

- تجارة عامة / إلكترونيات / أزياء.
- سوبرماركت / مواد غذائية.
- مطاعم كـ catalog/order فقط، دون kitchen dispatcher متقدم في أول Sprint.

### المرحلة الثانية

- صيدليات: batch/expiry/compliance وربما وصفات حسب السياسة القانونية.
- خدمات وحجوزات: calendar/availability/appointment engine.
- wholesale/B2B: minimum quantities، أسعار جملة، credit terms.

### قاعدة مهمة

تظل `activity templates` و`product taxonomy` أدوات إعداد؛ لا تتحول إلى منطق if/else ثابت لكل قطاع في API core.

---

# 6) Multi-tenancy عند الإطلاق

## النموذج المعتمد: Both Tenants

```text
Platform Owner
  └─ Mall Operator Tenant
       └─ Stores / Merchants
            └─ Optional Merchant White-label Tenant
```

## 6.1 Mall Operator Tenant

يمتلك:

- الدومين والهوية والـ theme.
- المحافظات/الأجنحة المفعلة.
- عقود الإيجار والباقات.
- الموظفين والأدوار.
- قواعد الإعلانات والعروض.
- إعدادات الكاش/العملة/سياسات الطلب.

## 6.2 Merchant White-label Tenant

اختياري ومدفوع:

- subdomain أو custom domain.
- theme محدود وقوالب صفحات.
- catalog/storefront مستقل.
- محاسبي connector مستقل.
- لا يرى بيانات مول أو تاجر آخر.

## 6.3 متطلبات هندسية غير قابلة للتجاوز

1. Tenant context في كل request إداري/عام.
2. Tenant repository layer قبل إضافة tenant_id عشوائيًا إلى كل مكان.
3. Migration plan للجداول عالية الحجم:
   - stores.
   - products.
   - orders.
   - payments.
   - ads.
   - media.
   - audit logs.
4. اختبار tenant isolation إلزامي.
5. Domain resolver + custom-domain verification + SSL strategy.
6. Feature flags وentitlements حسب خطة الإيجار.

## التوصية العملية

ابدأ عند الإطلاق بـ:

- Tenant واحد فعلي: صلاح سنتر.
- بني tenant context من الآن.
- فعّل white-label لمجموعة تجار تجريبية فقط بعد عزل البيانات واختبارات domain/billing.

هذا يحقق «ضمن الإطلاق» معماريًا دون تعريض الإطلاق الأساسي لتعقيد غير مختبر.

---

# 7) ERP محاسبي لكل تاجر

## المبدأ

لكل تاجر connector مستقل، وليس اتصال DB-to-DB مباشر من الإنترنت.

```text
Store → Integration Client → Local Sync Agent / API → Muhasabi
Muhasabi → Agent/API → Integration Events → Reconciliation
```

## Source of truth المقترح

| المجال | المصدر عند ربط ERP |
|---|---|
| المخزون الفعلي | محاسبي |
| تكلفة الشراء | محاسبي |
| الفاتورة المحاسبية | محاسبي |
| الطلب وتجربة العميل | المنصة |
| حجز المخزون | المنصة مع reconciliation |
| حالة الدفع النقدي | التاجر/المنصة ثم ترحيل محاسبي |
| التسويات الداخلية | محاسبي أو ledger المنصة حسب وضع التاجر |

## Roadmap محاسبي

### Sprint A — Connector Certification

- تعريف نسخة محاسبي المدعومة.
- تثبيت Agent على بيئة تاجر تجريبية.
- device registration/heartbeat.
- API key rotation.
- connection health dashboard.

### Sprint B — Master Data

- المنتجات، SKU، barcode، categories، units، variants.
- mapping profiles versioned.
- external IDs إلزامية.
- منع name-only matching.

### Sprint C — Inventory

- snapshot/incremental stock sync.
- reservation reconciliation.
- conflict workflow:
  - ERP wins.
  - event queued.
  - failed sync queue.
  - admin/merchant resolution.

### Sprint D — Sales & Accounting

- orders export.
- invoice status import.
- cancellation/credit note flow.
- cash order accounting status.

### Sprint E — Operational Guarantees

- idempotency per event.
- replay safe.
- daily reconciliation report.
- alert on stale sync / negative availability / orphan invoice.

## إطلاق ERP لكل التجار

المعنى الصحيح: **كل تاجر لديه إمكانية الربط**، وليس إجبار جميع التجار على الربط منذ اليوم الأول.

الحالات:

```text
STANDALONE: تاجر بلا محاسبي، المنصة تدير المخزون الأساسي.
ERP_CONNECTED: تاجر مربوط، محاسبي مصدر الحقيقة للمخزون/الفاتورة.
ERP_REQUIRED: قطاع/خطة تفرض الربط بعد نجاح certification.
```

---

# 8) KPI: عدد الطلبات

بما أن KPI الأول هو الطلبات، يجب بناء funnel واضح:

```text
Visit
→ Search
→ Product View
→ Add to Cart
→ Checkout Started
→ Order Created
→ Merchant Accepted
→ Shipped
→ Delivered
→ Closed
```

## Dashboard أسبوعي مطلوب

- Visits.
- Product views.
- Add-to-cart rate.
- Checkout start rate.
- Orders created.
- Merchant acceptance rate.
- Delivery success rate.
- Cancellation rate by reason.
- Average order value.
- Orders per governorate/city/wing/store.

## KPI أول 90 يومًا

لا نضع رقمًا ثابتًا قبل baseline، لكن نقيس أسبوعيًا:

1. عدد الطلبات المنشأة.
2. نسبة قبول التاجر خلال SLA.
3. نسبة التسليم.
4. نسبة الإلغاء.
5. الزمن من الطلب إلى قبول التاجر.
6. الزمن من الشحن إلى التسليم.

---

# 9) Master Backlog مرتب بالأولوية

## Release 1 — اليمن النقدي والتاجر التشغيلي

**الهدف:** عميل يطلب، تاجر يسلم، نقد يستلمه التاجر، الطلب يغلق بنجاح.

- [ ] Saved addresses + geography selector.
- [ ] Merchant shipping coverage/rules engine.
- [ ] COD lifecycle واضح حتى التسليم.
- [ ] Checkout multi-store success/failure summary.
- [ ] Customer order timeline/tracking.
- [ ] Merchant daily queue.
- [ ] Merchant launch checklist.
- [ ] Product workspace simplification.
- [ ] Product Q&A.
- [ ] Public CMS/policies.
- [ ] Funnel analytics الأساسية.

## Release 2 — الإيجار والإدارة

**الهدف:** تشغيل دخل المنصة من عقود الإيجار والإضافات.

- [ ] Rent plans/add-on catalog.
- [ ] Invoice/overdue/grace workflow.
- [ ] Branch rent rules.
- [ ] Merchant billing center.
- [ ] Admin collections queue.
- [ ] Entitlement engine.
- [ ] Financial reporting/export.

## Release 3 — عروض وإعلانات قابلة للربح

**الهدف:** التاجر يبيع أكثر والمنصة تبيع إضافات مرئية قابلة للقياس.

- [ ] Offer/coupon rules engine.
- [ ] Offer calendar.
- [ ] Ad impression/click ingestion.
- [ ] Budget pacing.
- [ ] ad billing / campaign ledger.
- [ ] Performance reporting CTR/CPC/ROAS.

## Release 4 — محاسبي لكل تاجر

**الهدف:** ربط تاجر تجريبي ثم certification قابلة للتكرار.

- [ ] Agent installation/onboarding.
- [ ] Product/inventory mapping.
- [ ] Inventory snapshot + reservation reconciliation.
- [ ] Sales/invoice sync.
- [ ] Conflict resolution workflow.
- [ ] Daily reconciliation closure.

## Release 5 — Multi-tenant / White-label

**الهدف:** تشغيل Mall Operator جديد أو تاجر white-label مع عزل حقيقي.

- [ ] Tenant context + repository layer.
- [ ] tenant isolation test suite.
- [ ] Tenant theme/domain resolver.
- [ ] Tenant billing/entitlements.
- [ ] Custom domain verification.
- [ ] Pilot tenant launch.

---

# 10) Definition of Done لكل Release

لا يغلق أي Release إلا إذا تحقق الآتي:

1. UX acceptance tests للأدوار المعنية.
2. API integration tests مع Postgres حقيقية مؤقتة.
3. Audit events للعمليات الحساسة.
4. Dashboard/metrics لقياس النجاح.
5. rollback/runbook عند وجود migration أو workflow مالي.
6. Staging E2E ناجح.
7. لا توجد P1 security أو data consistency gaps.
8. تحديث docs والـ support procedure.

---

# 11) البدء المقترح

ابدأ بـ **Release 1** وليس بالإعلانات أو Multi-tenant أو ERP أولاً.

السبب: الطلب النقدي والشحن الذي يديره التاجر هو قلب النموذج. إذا لم تكن هذه الرحلة ممتازة، فلن تنجح الإيجارات أو الإعلانات أو الربط المحاسبي في خلق قيمة قابلة للقياس.

بعد إغلاق Release 1، يبدأ Release 2 وRelease 4 جزئيًا بالتوازي: عقود الإيجار + certification لتاجر محاسبي تجريبي.
