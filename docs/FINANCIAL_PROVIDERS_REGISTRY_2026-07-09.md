# Financial Providers Registry System — 2026-07-09

## الهدف
بناء طبقة حوكمة مالية مركزية تمنع التجار من إضافة بنوك أو محافظ أو بوابات دفع عشوائية، وتجعل جميع وسائل الدفع تمر عبر:

```txt
Central Financial Governance
```

بدون كسر نظام الدفع الحالي.

---

## ما تم تنفيذه

### 1) Financial Providers Registry
تمت إضافة جدول مركزي:

```txt
financial_providers
```

يحتوي على:

- id
- name
- slug
- type
- status
- logoUrl
- countryCode
- currencyCode
- isEnabled
- isVisibleToMerchants
- supportsDeposits
- supportsWithdrawals
- supportsRefunds
- supportsCOD
- featureFlags
- sortOrder
- createdAt
- updatedAt

### 2) أنواع المزودات
يدعم:

```txt
bank
wallet
gateway
hawala
cod
```

### 3) حالات المزودات
يدعم:

```txt
active
disabled
restricted
blocked
maintenance
```

---

## 4) Merchant Financial Provider Accounts
تمت إضافة جدول ربط:

```txt
merchant_financial_provider_accounts
```

يربط:

```txt
merchant/store ↔ financial_provider
```

ويحفظ بيانات التاجر الخاصة بالمزود:

- accountNumber
- walletNumber
- beneficiaryName
- IBAN
- branchName
- config
- status

---

## 5) ربط payment_methods بطبقة الحوكمة
تمت إضافة أعمدة إلى:

```txt
payment_methods
```

```txt
financial_provider_id
merchant_financial_account_id
```

وبذلك أصبح Payment Method المتجر مبنياً على مزود مالي معتمد، وليس نصاً عشوائياً من التاجر.

---

## 6) صفحة إدارة الأدمن
تم إنشاء:

```txt
/admin/financial-providers
```

يستطيع الأدمن:

- إضافة مزود.
- تعديل حالته.
- إيقاف مزود فوراً.
- إخفاء مزود عن التجار.
- حظر مزود.
- تفعيل/تعطيل خدماته.
- تحديد دعم الدفع/السحب/الاسترداد/COD.

وتمت إضافة بطاقة لها في لوحة الأدمن الرئيسية.

---

## 7) APIs

### Admin APIs

```txt
GET  /api/admin/financial-providers
POST /api/admin/financial-providers
PATCH /api/admin/financial-providers/[id]
DELETE /api/admin/financial-providers/[id]
```

### Merchant/Public API

```txt
GET /api/financial-providers
```

يرجع فقط المزودات:

```txt
active
isEnabled=true
isVisibleToMerchants=true
supportsDeposits=true
```

---

## 8) منع الإدخال اليدوي من التاجر
تم تعديل صفحة:

```txt
/merchant/operations-settings
```

بدلاً من أن يكتب التاجر اسم البنك/المحفظة يدوياً، أصبح يختار من:

```txt
المزود المعتمد
```

ثم يضيف فقط بياناته الخاصة:

- رقم الحساب.
- رقم المحفظة.
- اسم المستفيد.
- IBAN.
- تعليمات الدفع.

---

## 9) حماية Backend
تم تعديل:

```txt
app/api/merchant/payment-methods/route.ts
app/api/merchant/payment-methods/[id]/route.ts
app/api/orders/route.ts
app/api/checkout/options/route.ts
```

الحماية الآن:

- رفض أي financialProvider غير موجود.
- رفض أي provider غير active.
- رفض أي provider غير enabled.
- رفض أي provider مخفي عن التجار عند إنشاء وسيلة دفع.
- checkout لا يعرض مزودات متوقفة.
- order creation يرفض الدفع بمزود غير نشط أو لا يدعم مدفوعات العملاء.

---

## 10) Feature Flags
يدعم الجدول حقل:

```txt
feature_flags
```

مثل:

```json
{
  "supportsMerchantPayouts": false,
  "supportsCustomerPayments": true,
  "supportsRefunds": false,
  "supportsSettlements": false
}
```

---

## 11) Financial Safety Controls
الأدمن يستطيع من الصفحة:

- إيقاف المزود فوراً.
- إخفاؤه من التجار.
- حظره.
- تعطيل السحب.
- تعطيل الدفع.
- تعطيل الاسترداد.
- تعطيل COD.

بدون تعديل الكود.

---

## 12) Audit Logs
أي إنشاء/تعديل/تعطيل للمزود المالي يسجل عبر:

```txt
writeAuditLog
```

بـ:

- من قام بالتغيير.
- القيم السابقة.
- القيم الجديدة.
- وقت التغيير.

---

## 13) التوسع المستقبلي
البنية جاهزة لإضافة:

- Stripe.
- PayPal.
- محافظ محلية.
- بنوك يمنية.
- بوابات دفع.
- حوالات.
- تسويات تلقائية.

---

## Migration
تمت إضافة:

```txt
drizzle/0045_financial_providers_registry.sql
```

وتنشئ:

```txt
financial_providers
merchant_financial_provider_accounts
```

وتضيف إلى:

```txt
payment_methods.financial_provider_id
payment_methods.merchant_financial_account_id
```

كما تضيف مزودات افتراضية:

- الدفع عند الاستلام.
- تحويل بنكي يدوي.
- محفظة إلكترونية محلية.
- حوالة عبر شركة صرافة.

---

## الملفات الجديدة/المعدلة

```txt
drizzle/0045_financial_providers_registry.sql
lib/financial/providers.ts
app/admin/financial-providers/page.tsx
components/admin/financial-provider-management-panel.tsx
app/api/admin/financial-providers/route.ts
app/api/admin/financial-providers/[id]/route.ts
app/api/financial-providers/route.ts
app/api/merchant/payment-methods/route.ts
app/api/merchant/payment-methods/[id]/route.ts
app/api/orders/route.ts
app/api/checkout/options/route.ts
components/merchant/operations-settings-panel.tsx
app/merchant/operations-settings/page.tsx
app/admin/page.tsx
lib/db/schema.ts
```

---

## الفحوصات
تم تشغيل:

```bash
NODE_OPTIONS=--max_old_space_size=4096 npm run typecheck
npm run lint
npm test
```

النتيجة:

```txt
typecheck: PASS
lint: PASS
tests: PASS
9 test files passed
23 tests passed
```

محاولة build داخل Arena:

```txt
SIGKILL
```

وهو قيد الذاكرة المعروف.

---

## المطلوب بعد النشر
تطبيق migration:

```bash
psql "$DATABASE_URL" -f drizzle/0045_financial_providers_registry.sql
```

ثم Deploy.

---

## النتيجة
أصبح لدينا Governance Layer مالية مركزية فوق النظام الحالي بدون كسره. التاجر يختار فقط من مزودين معتمدين، والأدمن يستطيع إيقاف أو إخفاء أو حظر أي مزود فوراً لحماية المنصة مالياً وتشغيلياً.
