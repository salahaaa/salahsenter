# تقرير موحد — المرحلة 4 والمرحلة 5 ولوحة الأدمن والفحص الشامل

**التاريخ:** 12 يوليو 2026
**نطاق التقرير:** تنفيذ حزمة حوكمة الإدارة والمحتوى والماليات وERP وتهيئة Multi-tenant، ثم فحص شامل محلي لجميع التعديلات المتراكمة.

## ملخص صريح

تم تنفيذ **الأساس البرمجي والتشغيلي** لأهم عناصر المرحلتين 4 و5 داخل مساحة العمل، مع ربطها بلوحة الأدمن. لا يعني ذلك جاهزية نشر Multi-tenant/RLS أو شهادة ERP أو DNS/SSL على الإنتاج؛ تلك تتطلب بنية وإعدادات وخدمات خارجية حقيقية غير متاحة في هذه الجلسة.

## المرحلة 4 — Admin Control & Content

### 1) Unified Admin Work Queue

أضيف:

```text
/admin/work-queue
/api/admin/work-queue
lib/admin/work-queue.ts
admin_work_assignments
```

يجمع الطابور في مكان واحد:

- طلبات فتح المتاجر والمستندات/الاعتماد.
- عروض المتاجر والإعلانات المعلقة.
- فواتير الإيجار المتأخرة وإثباتات السداد.
- طلبات السحب.
- مزامنات ERP الفاشلة.
- التنبيهات الأمنية.
- العقود قريبة الانتهاء.
- شهادات موصلات ERP غير المكتملة.

ويدعم الإسناد لموظفي المنصة، الأولوية، حالة الإنجاز، وموعد SLA. تمت إضافة رابط مباشر له إلى لوحة الأدمن الرئيسية.

### 2) Customer 360

أضيف:

```text
/admin/customers/{id}
```

ويعرض، بصلاحية `users.manage` فقط:

```text
الملف الأساسي + الطلبات + العناوين + المرتجعات
إثباتات الدفع + المحفظة + الجلسات النشطة + آخر عمليات audit
```

وتم ربط اسم المستخدم في جدول `/admin/users` بملف 360.

### 3) CMS: preview + versioning + restore

أضيف:

```text
cms_page_versions
/admin/cms/preview/{id}
/api/admin/cms/pages/{id} GET
/api/admin/cms/pages/{id}/versions/{versionId}/restore
```

التدفق:

- إنشاء الصفحة ينشئ النسخة الأولى.
- كل تعديل يحفظ snapshot قبل التعديل.
- الاستعادة تحفظ نسخة حماية قبل تطبيق الإصدار القديم.
- المعاينة الداخلية لا تنشر المحتوى للعامة.

### 4) Menu Builder مستخدم فعليًا

أضيف:

```text
/admin/menu
components/admin/menu-builder-panel.tsx
lib/menu/public-menu.ts
```

ويتم الآن قراءة عناصر القائمة المرئية `main` في `SiteHeader` العام. أضيف أيضًا تعديل/إخفاء/حذف لواجهة API الخاصة بالقوائم مع audit logs.

### 5) Audit وReports

- صفحة سجل التدقيق أصبحت تدعم فلاتر التصنيف والفاعل والكيان والتاريخ.
- أضيف تصدير CSV:
  ```text
  /api/admin/audit-log?format=csv
  ```
- أضيف تصدير CSV للتقرير الإداري العام:
  ```text
  /api/admin/reports/export
  ```

## المرحلة 5 — Finance, ERP & Multi-tenant

### 1) Financial Close Governance

أضيف:

```text
financial_close_runs
/api/admin/finance/close
components/finance/financial-close-panel.tsx
lib/finance/close.ts
```

ينشئ الإقفال لقطة لفترة يوم UTC سابقة تشمل:

```text
المبيعات المدفوعة
الـ ledger credits/debits
السحوبات المدفوعة
المرتجعات المكتملة
إثباتات الدفع المعلقة
فواتير الإيجار المتأخرة/قيد المراجعة
مزامنات ERP الفاشلة
```

والتدفق محكوم:

```text
draft → reviewed → closed
closed → reopen
```

كما تم منع القفز من `requested` مباشرة إلى `paid` في payout؛ يجب الاعتماد أولًا ثم تسجيل التحويل.

### 2) ERP Connector Certification

أضيف:

```text
erp_connector_certifications
/admin/integrations/certification
/api/admin/integrations/certifications
lib/integrations/erp/certification.ts
```

يفحص readiness قبل sandbox certification:

- Client فعال والصلاحيات المطلوبة.
- Agent مرئي خلال آخر 24 ساعة.
- Mapping للمنتجات والمخزون والطلبات والفواتير.
- Conflict policy لكل مورد أساسي.
- مزامنة ناجحة موثقة.

لا يمكن اعتماد الشهادة قبل نجاح كل عناصر checklist.

### 3) Multi-tenant / White-label foundation

أضيف:

```text
lib/tenancy/context.ts
tenant_domains.verification_token
```

- resolver آمن للـ host لا يعترف إلا بـ domain `verified` وtenant نشط وwhite-label.
- ThemeStyle يستخدم theme tenant المفعّل عند حل نطاقه.
- عند إنشاء tenant يمكن ربط owner/store وتوليد TXT verification token للدومين.
- تعرض لوحة tenants رمز TXT التشغيلي ولا تدعي أن DNS تحقق فعليًا.

## Migration

أضيف migration واحد لهذه الحزمة:

```text
0055_admin_finance_cms_erp_tenant_governance
```

ويحتوي على:

```text
admin_work_assignments
cms_page_versions
financial_close_runs
erp_connector_certifications
tenant_domains.verification_token
```

## الفحص الشامل المنفذ

| الفحص | النتيجة |
|---|---|
| `npm run lint` | ناجح |
| `npm run typecheck` | ناجح |
| `npm test` | 29 ملف اختبار / 80 اختبارًا ناجحًا |
| `npm run migrations:verify` | 56 ملف SQL / 56 journal entries |
| `npx drizzle-kit check` | ناجح — `Everything's fine` |
| `npm run security:verify` | ناجح — فحص الأسرار سليم و0 vulnerabilities |
| `git diff --check` | ناجح |

أضيفت اختبارات حوكمة للـ CMS snapshot ونافذة الإقفال UTC وتطبيع tenant host.

## حدود لم تُدَّعَ

لم يتم من هذه الجلسة:

1. تطبيق migrations على قاعدة إنتاج.
2. نشر Vercel أو تشغيل cron حقيقي أو اختبار DNS/SSL.
3. ربط تاجر ERP حقيقي أو تنفيذ sandbox certification خارجي.
4. تفعيل RLS أو ادعاء tenant isolation كامل؛ الجداول الأساسية الحالية لا تحمل `tenant_id` على كل مصدر بيانات، ويلزم repository/query migration شاملة واختبارات عزل قبل الإطلاق.
5. التحقق الفعلي من DNS؛ الرمز يولّد فقط كتعليمات تشغيلية.
6. تنفيذ scheduled email/PDF reports؛ المتاح الآن CSV، ويحتاج جدولة البريد قرار مزود إرسال وسياسة موافقات.
7. تشغيل `next build` داخل Arena بسبب حد الذاكرة المعروف؛ يجب تأكيد build في GitHub Actions أو Vercel.

## حالة Git

لم يتم تنفيذ `git commit` أو `git push`.
