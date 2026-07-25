# Dual Commerce Modes — ERP Mode + Standalone Mode — 2026-07-07

## الهدف
تنفيذ بنية تشغيل مزدوجة تسمح للمتجر بالعمل:

```txt
ERP Mode
```

أو:

```txt
Standalone Mode
```

بدون إنشاء checkout منفصل أو order system منفصل. نفس دورة التجارة الأساسية تبقى موحدة، والاختلاف فقط في استراتيجية الفاتورة والمخزون والإيرادات.

---

## القرار المعماري

تم إنشاء طبقة:

```txt
Financial Strategy Layer
```

تفصل بين:

- invoice authority
- inventory authority
- revenue posting
- accounting flow

وبين Core Commerce Workflow.

أي أن:

```txt
Checkout / Orders / Statuses / Reservation
```

تبقى موحدة، بينما تختلف الاستراتيجية المالية حسب وضع المتجر.

---

## 1) Merchant Integration Mode

تمت إضافة إعدادات لكل متجر:

```txt
integrationEnabled
integrationMode
erpProvider
```

القيم:

```txt
ERP
STANDALONE
```

مكان الإعداد في لوحة التاجر:

```txt
/merchant/operations-settings
```

أضيف قسم جديد:

```txt
وضع الربط المالي والمخزني
```

وفيه:

- المتجر مرتبط بنظام ERP/POS.
- Commerce Mode: ERP أو Standalone.
- مزود ERP/POS.

---

## 2) ERP Mode Workflow

إذا كان المتجر في ERP Mode:

### داخل المنصة

- تنشئ Order.
- تحجز المخزون فقط عبر `reservedQuantity`.
- لا تنشئ Invoice.
- لا تخصم `stockQuantity` فعلياً.
- لا تسجل الإيراد مباشرة.
- ترسل event:

```txt
order.created
```

إلى Integration Queue.

### داخل ERP

- ينشئ Sales Order أو Pending Order.
- عند الشحن/التسليم/الاعتماد ينشئ Sales Invoice.
- يخصم المخزون فعلياً.
- يسجل الإيراد محاسبياً.
- يرسل للمنصة:

```txt
invoice.created
inventory.updated
payment.updated
```

### داخل المنصة عند رجوع ERP

- تنشئ/تحدث invoice كمرجع ERP.
- تحدث stockQuantity من ERP.
- تفك reservation.
- تحدث حالة الطلب.
- تحدث التقارير.

---

## 3) Standalone Mode Workflow

إذا كان المتجر لا يملك ERP:

### داخل المنصة

- تنشئ Order.
- تحجز المخزون أولاً بنفس workflow الموحد.
- تنشئ Invoice داخل المنصة.
- تحول الحجز إلى خصم فعلي من `stockQuantity`.
- تسجل حركة `deduct`.
- عند إغلاق الطلب/تأكيد الدفع تسجل الإيرادات والعمولات في ledger.

أي أن المنصة تصبح:

```txt
invoice authority = platform
inventory authority = platform
revenue authority = platform
```

---

## 4) Unified Commerce Workflow

لم يتم إنشاء checkout جديد.

نفس endpoint:

```txt
POST /api/orders
```

يعمل للحالتين.

الاختلاف يتم عبر:

```txt
Financial Strategy Layer
```

وليس عبر تكرار النظام.

---

## 5) Strategy-Based Services

تم إنشاء:

```txt
lib/commerce/financial-strategy.ts
lib/commerce/financial-services.ts
```

### الخدمات

```txt
InvoiceService
InventoryService
RevenueService
```

### ERP Mode

```txt
ERPInvoiceService
ERPInventoryService
ERPRevenueService
```

سلوكها:

- لا تنشئ فاتورة داخل المنصة.
- لا تخصم المخزون داخل المنصة.
- لا تسجل الإيراد مباشرة.
- تنتظر أحداث ERP.

### Standalone Mode

```txt
PlatformInvoiceService
PlatformInventoryService
PlatformRevenueService
```

سلوكها:

- تنشئ فاتورة داخل المنصة.
- تخصم المخزون داخل المنصة.
- تسجل revenue/commission عند closed + paid.

---

## 6) Future ERP Switching

يمكن للمتجر أن يبدأ:

```txt
STANDALONE
```

ثم لاحقاً يفعل:

```txt
ERP
```

عبر تغيير إعداد:

```txt
integrationMode
```

بدون إعادة بناء checkout أو orders أو statuses.

### ما يحدث عند التحويل مستقبلاً

- الطلبات القديمة تبقى بسجلها المالي حسب مصدرها.
- الطلبات الجديدة تتبع الاستراتيجية الجديدة.
- الفواتير القديمة لها `sourceSystem` يحدد مصدرها:

```txt
salah_center
erp
```

---

## 7) الملفات الجديدة

```txt
lib/commerce/financial-strategy.ts
lib/commerce/financial-services.ts
app/api/merchant/integration-settings/route.ts
docs/DUAL_COMMERCE_MODES_ERP_STANDALONE_2026-07-07.md
```

## 8) الملفات المعدلة

```txt
app/api/orders/route.ts
app/api/orders/[id]/status/route.ts
app/merchant/operations-settings/page.tsx
components/merchant/operations-settings-panel.tsx
```

---

## 9) تأثير التعديل على دورة الطلب

### عند إنشاء الطلب

المنصة تقرأ إعداد المتجر:

```txt
getMerchantIntegrationSettings(storeId)
```

ثم تنشئ الخدمات:

```txt
createFinancialServices(settings)
```

ثم تستخدم:

```txt
financialServices.invoice
financialServices.inventory
financialServices.revenue
```

### في ERP Mode

```txt
Order Created
Reservation Created
No Invoice
No Deduction
No Revenue
Integration Event sent
```

### في Standalone Mode

```txt
Order Created
Reservation Created
Platform Invoice Created
Reservation finalized as stock deduction
Revenue settled later when closed+paid
No ERP event required
```

---

## 10) لماذا هذا التصميم أفضل؟

لأن المنصة يجب أن تخدم نوعين من التجار:

1. تاجر لديه ERP/POS.
2. تاجر عادي بدون أي نظام محاسبي.

لو جعلنا ERP إلزامياً سنحصر المنصة ونفقد شريحة كبيرة.

ولو جعلنا المنصة دائماً مصدر الحقيقة سنكسر تكامل ERP.

لذلك الأفضل:

```txt
Unified Commerce Core + Pluggable Financial Strategy
```

---

## 11) الفحوصات

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

محاولة build داخل Arena فشلت بسبب الذاكرة:

```txt
SIGKILL
```

كما حدث سابقاً.

---

## 12) الخلاصة

أصبحت المنصة تدعم:

```txt
ERP Mode
Standalone Mode
```

بنفس checkout ونفس orders ونفس workflow، مع اختلاف الاستراتيجية المالية فقط.

وهذا يحقق:

- عدم حصر المنصة بالتجار أصحاب ERP.
- دعم التجار العاديين.
- دعم ERP Source of Truth عند الحاجة.
- قابلية التحويل مستقبلاً من Standalone إلى ERP.
- فصل المال والمخزون عن core commerce.
- بنية قابلة للتوسع والتكامل مع أنظمة مختلفة.
