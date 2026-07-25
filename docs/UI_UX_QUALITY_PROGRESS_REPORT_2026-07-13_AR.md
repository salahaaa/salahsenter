# تقرير تقدّم مرحلة جودة الواجهة وتجربة الاستخدام

**الحالة:** قيد التنفيذ — تم إنجاز الأساسات عالية الأثر، والتدقيق كشف الأعمال المتبقية بدقة.

## المنجز

### 1. API Client موحد

أضيف:

```text
lib/client/api-client.ts
components/api/use-api-mutation.ts
```

القدرات:

- typed API envelope.
- `ApiClientError`: status، details، retryable، وrequest ID.
- correlation/request ID في كل طلب عميل.
- retry محدود وآمن لطلبات GET فقط.
- سياسة cache واضحة (`authenticated = no-store`).
- events محلية لـ cache invalidation.
- hook موحد للـ loading/error/retry.

كما تم تمرير `x-request-id` من middleware إلى استجابات المنصة.

تم نقل عمليات حساسة كبداية إلى client الموحد:

```text
Store status actions
Product moderation
Ad campaign actions
DLQ requeue
Revoke user sessions
DeleteResourceButton
Order status actions
```

### 2. Dialog موحد للعمليات الحساسة

أضيف:

```text
components/ui/action-confirmation-dialog.tsx
```

يدعم:

- keyboard focus trap وEscape.
- سبب/ملاحظة مطلوب أو اختياري.
- typed confirmation للنشاطات عالية الخطورة.
- loading/error.
- audit context ظاهر للمشغل.
- RTL/mobile.

تم استبدال مجموعة من `window.confirm/prompt/alert` في مسارات حساسة أعلاه. لا تزال بقية الاستبدالات مدرجة في التدقيق أدناه.

### 3. Bundle Split وLazy Loading

تم تحويل مكونات ثقيلة إلى dynamic imports:

```text
ProductComparisonWorkspace
AiAssistantPanel
IntegrationManagementPanel
ProductEditForm
ProductEngineForm
ProductTaxonomyForm
SmartProductIntakePanel
ActivityTemplateSmartPanel
StoreCartDrawer
```

كما تم استخراج StoreCartDrawer من Storefront لتقليل حجم `storefront-experience.tsx` وعزل سلة المتجر في chunk مستقل.

### 4. SEO وStructured Data

أضيف:

```text
components/seo/structured-data.tsx
lib/seo.ts
```

تمت إضافة `generateMetadata` وcanonical/OpenGraph إلى:

```text
/store/[slug]
/store/[slug]/products/[productSlug]
/wings/[slug]
/offers
/[slug] CMS (كان موجوداً metadata وتمت إضافة JSON-LD)
```

Structured Data المضاف:

```text
Organization
Product
Offer
OfferCatalog
CollectionPage
Article/WebPage
BreadcrumbList
```

### 5. Accessibility

- focus-visible عالمي واضح.
- احترام `prefers-reduced-motion`.
- StoreCartDrawer أصبح `role=dialog` و`aria-modal`، وأزرار السلة لها labels.
- أداة audit جديدة:

```text
npm run a11y:audit
scripts/audit-ui-accessibility.mjs
```

## نتيجة التدقيق الحالية

```text
ملفات TS/TSX المفحوصة:          575
Client components:              155
استخدامات fetch المباشرة:       237
native confirm/alert/prompt:    57
صور بلا alt:                    0
حقول تحتاج مراجعة identity:     41
```

### قراءة صحيحة للنتيجة

- `0` صور بلا alt نتيجة إيجابية في الفحص النصي.
- جزء من 41 حقل هو checkbox داخل `<label>`، لكن يجب تثبيت `id/name/aria-label` صراحة في الحقول التفاعلية المعقدة.
- 57 native dialogs ليست مقبولة كحالة نهائية؛ تم بناء البديل الموحد وبدأت الهجرة في العمليات الأعلى خطورة، وتبقى هجرة منظمة حسب الخطورة.
- 237 fetch تشمل أيضاً fetch في طبقات النظام/المراقبة/الخادم؛ لا ينبغي استبدال fetch السيرفري أو Webhook fetch بنفس عميل المتصفح. هدف المرحلة هو إزالة fetch المباشر من client interaction layers تدريجياً.

## الملفات الكبيرة

تم تخفيف Storefront بإخراج Drawer. أما الملفات التالية تتطلب refactor مرحلياً لأنها مترابطة:

```text
lib/db/schema.ts
components/merchant/product-taxonomy-form.tsx
components/merchant/merchant-dashboard-pro.tsx
components/store/storefront-experience.tsx
components/search/smart-search-box.tsx
```

لم يتم تقسيم schema بشكل متسرع، لأن Drizzle references/migration snapshots تشكل نقطة حساسة. قبل التقسيم يلزم design migration يحافظ على schema export وDrizzle checks.

## التحقق المنفذ

```text
npm run lint                                      PASS
NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck   PASS
npm test                                          PASS — 39 ملفات / 109 اختبارات
npm run a11y:audit                                PASS (audit baseline generated)
```

## التالي في نفس المرحلة

1. ترحيل native dialogs المتبقية حسب مستوى الخطورة.
2. ترحيل client fetch المتبقي في admin/merchant forms إلى `apiClient`.
3. إصلاح الحقول الـ41 من audit، مع مراجعة يدوية للـ labels المضمنة.
4. تقسيم Storefront/Product Taxonomy/Dashboard إلى child modules.
5. تنفيذ Lighthouse/axe على URL Staging حقيقي وليس داخل Arena.
