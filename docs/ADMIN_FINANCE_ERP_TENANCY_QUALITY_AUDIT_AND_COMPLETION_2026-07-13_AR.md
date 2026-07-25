# تدقيق واستكمال: Admin Control، Finance/ERP/Tenant، Quality & Launch

**التاريخ:** 2026-07-13  
**منهج الحكم:** لا تصف هذه الوثيقة شيئاً بأنه حي أو مكتمل تشغيلياً بلا دليل Staging/مزود خارجي حقيقي.

## A. Admin Control & Content

| البند | الحالة | الدليل / الاستكمال |
|---|---|---|
| Unified Admin Work Queue | مكتمل برمجياً | مصادر متعددة، assignment، priority، dueAt/SLA، open/assigned/resolved/dismissed، Audit. |
| Customer 360 | مكتمل برمجياً | orders، addresses، returns، receipts، wallet، sessions، audit. |
| CMS public renderer/preview/versioning | مكتمل برمجياً | renderer عام، preview، snapshots/restore، وأضيف محرر صفحة وسجل نسخ واستعادة من `/admin/cms/{id}`. |
| Menu builder فعلي | مكتمل برمجياً | CRUD وظهور `main` menu في SiteHeader. |
| Audit filter/export/correlation | مكتمل برمجياً | filters/CSV موجودة؛ أضيف `audit_logs.correlation_id` وفلترة/CSV بواسطة correlation ID. Migration `0063`. |
| CSV/PDF + schedule | مكتمل كطبقة برمجية | CSV/JSON schedule موجود؛ أضيف PDF renderer webhook adapter. PDF حي يتطلب `PDF_RENDER_WEBHOOK_URL` ومزوداً خارجياً. |
| approval SLA/assignment | مكتمل برمجياً | assignment وdueAt وSLA badge في work queue. |

## B. Finance, ERP & Multi-tenant

| البند | الحالة | الدليل / القيد |
|---|---|---|
| Financial close/reconciliation | مكتمل برمجياً | draft→reviewed→closed/reopen، cron مسودة، reconciliation dashboard. لا يوجد external accounting close proof في Arena. |
| payout approval workflow | مكتمل برمجياً | requested→approved→paid، يمنع requested→paid. |
| ERP certification | مكتمل برمجياً | client/scopes/agent/mappings/conflict policy/successful sync checklist. |
| conflict policies per entity | مكتمل برمجياً | mapping profile typed؛ أضيف `erp_conflict_cases` وواجهة/API قرارات لكل كيان. Migration `0064`. |
| durable sync/replay | مكتمل برمجياً | integration retry/DLQ/reconciliation + durable Agent inbox/outbox. Agent لم يـ compile هنا بسبب غياب dotnet. |
| Multi-tenant white-label | مكتمل تطبيقياً | host→verified domain→tenant stores guard، theme، DNS TXT verifier. لا RLS كامل حالياً. |

## C. Quality, Scale & Launch

### ما استكمل

- API client typed: `lib/client/api-client.ts`، request/correlation IDs، error mapping، retry GET، cache invalidation event، hook mutation.
- OpenAPI baseline: `/api/openapi`.
- Rate policy مركزي: `lib/rate-limit-policy.ts` وربط مساعد المحادثة؛ المسارات الحساسة القديمة لديها limits منفصلة قائمة.
- Dynamic imports للمحررات وAI والمقارنة والتكامل وسلة المتجر.
- استخراج `StoreCartDrawer` من Storefront.
- Dialog موحد accessible وترحيل عمليات المتجر/المنتج/DLQ/sessions/orders الأساسية.
- Metadata + structured data: Store/Product/Wing/Offers/CMS.
- Accessibility audit: `npm run a11y:audit`.
- Playwright config + public UX smoke + Staging CI workflow.
- Bundle budget script + CI bundle report بعد build.
- Coverage ratchet plan موثق.

### قياس حقيقي لا يجوز تجاهله

```text
Vitest V8 statements: 31.97%
branches: 22.59%
functions: 30.23%
lines: 33.66%
```

إذن تغطية 50% العامة و70–85% للـ core **غير محققة بعد**. تمت إضافة خطة Ratchet بدل رفع threshold شكلي يكسر CI بلا اختبارات نافعة.

### نتيجة accessibility audit

```text
ملفات مفحوصة: 582
Client components: 157
fetch calls: 237
native confirm/prompt/alert: 57
img بلا alt: 0
inputs تحتاج مراجعة identity: 41
```

- لا يوجد img بلا alt حسب الفحص النصي.
- ما زالت 57 عملية native dialog تحتاج هجرة منظمة.
- 41 حقل تشمل checkboxes داخل label (بعضها false positive) وتحتاج مراجعة يدوية/ID صريح.

## عناصر لا تكتمل محلياً

1. Route integration tests مع PostgreSQL مؤقت حقيقي: scripts موجودة، لكن لا DB مؤقت متاح في Arena.
2. Playwright: config/workflow موجودان، لكن Chromium/Staging URL لم يشغلا هنا.
3. Lighthouse/axe حقيقي: يتطلب URL Staging.
4. PDF حي: يتطلب renderer webhook مع دعم خطوط عربية.
5. RLS: يتطلب قرار عزل DB ومهاجرة شاملة؛ لا يجوز تطبيقه جزئياً على جداول قليلة.
6. ERP Pilot: يتطلب اختيار ERP وSandbox/Windows Agent حقيقي.

## Migrations الجديدة في هذه الحزمة

```text
0063_audit_log_correlation_id
0064_erp_conflict_case_management
```

## تحقق التنفيذ

```text
npm run lint                                      PASS
NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck   PASS
npm test                                          PASS — 41 files / 112 tests
npm run migrations:verify                         PASS — 65 SQL / 65 journal entries
npx drizzle-kit check                             PASS
npm run security:verify                           PASS
git diff --check                                  PASS
npm run a11y:audit                                baseline generated
```
