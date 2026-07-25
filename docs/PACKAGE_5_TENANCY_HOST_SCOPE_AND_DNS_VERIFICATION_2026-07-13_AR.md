# تقرير الحزمة 5 — Multi-tenancy: نطاق المضيف، عزل المتجر وDNS

## المنجز

### نطاق Tenant فعلي في السياق

تم توسيع:

```text
lib/tenancy/context.ts
```

ليحمل:

```text
tenant
verified domain
theme
public settings
storeIds
```

وتصبح `storeIds` من جدول `tenant_stores` هي القائمة الوحيدة التي يسمح بعرضها على host مستأجر White Label موثوق.

### حماية صفحات المتجر والمنتج

تم ربط الحماية بـ:

```text
app/store/[slug]/page.tsx
app/store/[slug]/products/[productSlug]/page.tsx
```

النتيجة:

```text
host → verified tenant domain → tenant_stores membership → store/product rendering
```

إذا فتحت واجهة tenant صفحة متجر لا ينتمي لذلك tenant، تعيد `notFound` ولا تعرض بياناته.

### هوية White Label

`app/layout.tsx` أصبح يقرأ tenant context بأمان ويستخدمه من أجل:

- عنوان الصفحة واسم التطبيق في Metadata.
- لغة المستأجر الافتراضية.
- `data-tenant-id` على HTML.
- يظل `ThemeStyle` مطبقاً Theme المستأجر فوق Theme المنصة.

### تحقق DNS قابل للتشغيل

ملفات جديدة:

```text
lib/tenancy/domain-verification.ts
app/api/admin/tenants/domains/{id}/verify
components/admin/verify-tenant-domain-button.tsx
```

- يعرض الأدمن Record:
  ```text
  _salah-tenant-verification.<domain>
  ```
- ويتحقق الخادم عبر DNS TXT من قيمة `verificationToken`.
- لا تتحول حالة الدومين إلى `verified` قبل تطابق الرمز.
- تمت إضافة زر تحقق DNS في صفحة SaaS Tenants.

## اختبار

```text
tests/tenant-isolation.test.ts
```

ويغطي normalizing للـ host وDNS record وحصر المتجر ضمن tenant stores.

## حدود صريحة

- هذا **عزل تطبيقي** عند حدود host/store rendering، وليس RLS كامل على قاعدة البيانات.
- بعض جداول التجارة التاريخية لا تحتوي `tenant_id`؛ لا يجوز الادعاء بعزل DB كامل قبل migration واسعة وPostgreSQL RLS/Policies أو استراتيجية قاعدة منفصلة.
- DNS verification ينفذ lookup حقيقياً عند النشر، لكن لم يمكن اختباره على domain مملوك داخل Arena.
- إصدار SSL وربط الدومين في Vercel/Cloudflare ما زال عملية نشر خارج الكود.

## التحقق

```text
npm run lint                                      PASS
NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck   PASS
npm test                                          PASS — 37 ملفات / 106 اختبار
```
