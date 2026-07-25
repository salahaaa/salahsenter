# ترتيب الدورة المالية والمخزنية بين المنصة و ERP — 2026-07-07

## ملاحظة اعتماد رأي المطور
تم اعتماد ملاحظتك كقاعدة عمل دائمة داخل التطوير: إذا كان الطلب يحتمل تصميماً أفضل من الناحية الهندسية، يتم اعتماد التصميم الأفضل مع توضيح السبب، خصوصاً في نقاط المال والمخزون والأمان.

---

## القرار المعماري المعتمد

تم اعتماد:

```txt
ERP = Source of Truth
```

أي أن:

- الجرد الحقيقي داخل ERP/POS.
- الخصم الفعلي من المخزون داخل ERP.
- الفاتورة المحاسبية/الإيراد داخل ERP.
- حركة المخزن النهائية داخل ERP.
- المنصة تحجز وتعرض وتتزامن فقط.

المنصة لا تنشئ فاتورة محاسبية عند إنشاء الطلب، ولا تخصم المخزون فعلياً.

---

## الدورة الجديدة للطلب

### 1) إنشاء الطلب داخل المنصة

عند شراء العميل:

- يتم إنشاء `Order` داخل المنصة.
- لا يتم إنشاء `Invoice` مباشرة.
- لا يتم خصم المخزون الفعلي.
- يتم إنشاء **Reservation** فقط داخل المنصة.

تم تعديل checkout بحيث:

```txt
Order Created
Invoice = null
Stock Deduction = no
Reserved Stock = yes
ERP Event = order.created
```

### 2) حجز المخزون بدل الخصم

تمت إضافة حقل جديد:

```txt
product_variants.reserved_quantity
```

وأصبحت المعادلة:

```txt
Physical Stock from ERP = stock_quantity
Reserved by Platform = reserved_quantity
Available Online = stock_quantity - reserved_quantity
```

وبهذا لا يحدث overselling داخل المنصة، وفي نفس الوقت لا تعتبر المنصة أنها خصمت من المخزون الحقيقي.

### 3) إرسال الطلب إلى ERP

بعد إنشاء الطلب، يتم إنشاء Integration Event:

```txt
order.created
```

عبر:

```txt
integration_events
background_jobs queue='integrations'
```

وليس sync مباشر داخل request lifecycle.

### 4) داخل ERP

Local Sync Agent أو Cloud ERP Adapter يسحب الحدث وينشئ في ERP:

```txt
Sales Order
أو Pending Order
```

وليس Sales Invoice مباشرة إلا عند الشحن/التسليم/اعتماد الطلب حسب نظام التاجر.

### 5) عند إصدار ERP للفاتورة

عند الشحن أو التسليم أو اعتماد الطلب داخل ERP:

ERP ينشئ:

```txt
Sales Invoice
Delivery Invoice
```

وهنا فقط يحدث:

- خصم فعلي من المخزون في ERP.
- تسجيل الإيراد في ERP.
- تسجيل حركة المخزن في ERP.
- ثم يرسل Agent للمنصة:

```txt
invoice.created
inventory.updated
stock.movement
```

### 6) تحديث المنصة من ERP

عند وصول `invoice.created` للمنصة:

- يتم إنشاء/تحديث `order_invoices` كمصدر ERP.
- يتم تحويل الطلب إلى `closed`.
- يتم جعل `paymentStatus = paid`.
- يتم فك Reservation.
- يتم تسجيل تأثير مالي في Ledger المنصة كتقرير انعكاسي من ERP.

عند وصول `inventory.updated`:

- يتم تحديث `stock_quantity` من ERP.
- يتم الحفاظ على `reserved_quantity` أو تقليله إذا تجاوز stock الجديد.
- يتم حساب available تلقائياً.
- يتم إنشاء حركة `inventory_movements` من نوع `adjust` مرجعها ERP.

### 7) البيع داخل الفرع أو الكاشير

إذا حدث بيع مباشر داخل ERP/POS:

- ERP يخصم المخزون.
- Agent يرسل `inventory.updated`.
- المنصة تحدث `stock_quantity`.
- available online يتغير فورياً:

```txt
available = ERP stock - platform reservations
```

### 8) الإلغاء والمرتجعات

#### إلغاء قبل الفاتورة

- يتم فك الحجز فقط.
- لا يوجد Credit Note.
- لا يوجد تأثير مالي.

#### إلغاء بعد الفاتورة

- المنصة لا تعيد المخزون بنفسها.
- يتم إرسال طلب/حدث إلى ERP.
- ERP ينشئ Return/Credit Note.
- ERP يعيد المخزون محاسبياً.
- Agent يرسل `inventory.updated` و/أو `invoice.cancelled`.

---

## الملفات/التغييرات المنفذة

### Migration جديدة

```txt
drizzle/0039_erp_financial_inventory_cycle.sql
```

تضيف:

```txt
product_variants.reserved_quantity
order_invoices.external_invoice_id
order_invoices.source_system
order_invoices.erp_posted_at
order_invoices.integration_metadata
```

### تعديل منطق المخزون

```txt
lib/inventory/atomic-inventory.ts
```

أصبح:

- `reserveOrderStock` يزيد `reserved_quantity` ولا ينقص `stock_quantity`.
- `releaseOrderStock` ينقص `reserved_quantity` ولا يزيد المخزون الفعلي.
- `deductOrderStockForLegacyUnreservedOrder` أصبح no-op لأن ERP هو مصدر الخصم الحقيقي.

### تعديل إنشاء الطلب

```txt
app/api/orders/route.ts
```

أصبح:

- لا ينشئ invoice عند checkout.
- لا يمنح loyalty مباشرة عند إنشاء الطلب.
- يحجز المخزون فقط.
- ينشئ `order.created` event للـ ERP.
- يرجع رسالة توضح أن الفاتورة ستصدر من ERP.

### تعديل تحديث حالة الطلب

```txt
app/api/orders/[id]/status/route.ts
```

أصبح:

- لا يخصم مخزون عند preparing.
- لا يسجل ledger عند closed يدوياً.
- إذا تم الإلغاء قبل invoice يفك الحجز.
- إذا تم الإلغاء بعد invoice لا يغير المخزون وينتظر ERP credit note.
- ينشئ `order.updated` event للـ ERP.

### تطبيق واردات ERP

```txt
lib/integrations/accounting/apply.ts
```

يعالج inbound integration events:

- `inventory` updates.
- `invoice` created/cancelled.

### Queue Worker

```txt
lib/queue/processor.ts
```

أصبح يدعم jobs:

```txt
integrations.accounting.sync
integrations.accounting.dispatch
```

ويعالجها خارج request lifecycle.

### API مخزون التاجر

```txt
app/api/merchant/inventory/route.ts
```

أصبح يرجع:

```txt
stockQuantity      = ERP physical stock
reservedQuantity   = platform reserved stock
availableQuantity  = stockQuantity - reservedQuantity
```

---

## كيف ستظهر في تقارير المخازن؟

### المفاهيم الجديدة

| الحقل | المعنى |
|---|---|
| stockQuantity | مخزون ERP الفعلي حسب آخر sync |
| reservedQuantity | كمية محجوزة بسبب طلبات منصة لم تفوتر بعد |
| availableQuantity | الكمية المتاحة للبيع Online |

### حركات المخزون داخل المنصة

| الحركة | متى تحدث؟ | هل تغير المخزون الفعلي؟ |
|---|---|---|
| reserve | عند إنشاء طلب في المنصة | لا، تزيد reserved فقط |
| release | عند إلغاء طلب قبل الفاتورة | لا، تنقص reserved فقط |
| adjust | عند وصول inventory.updated من ERP | نعم، تعكس ERP stock |
| return | بعد ERP credit note فقط | ERP يرسل stock update |

---

## ما هي الفاتورة التي تؤثر مالياً؟

الفاتورة المؤثرة مالياً هي:

```txt
ERP Sales Invoice / Delivery Invoice
```

وليست order داخل المنصة.

المنصة تنشئ Order فقط. الإيراد لا يُعترف به إلا عند وصول:

```txt
invoice.created من ERP
```

حينها تقوم المنصة بتحديث تقاريرها كنسخة انعكاسية من ERP.

---

## كيف تظهر الإيرادات والمبيعات؟

### قبل ERP invoice

```txt
Order موجود
Stock reserved
Revenue = 0
Ledger = no settlement
Invoice = none
```

### بعد ERP invoice

```txt
Invoice created
Order closed/paid
Reservation released
Ledger settlement recorded
Revenue reports updated
```

---

## منع overselling

يتم منع overselling عبر:

```txt
available = stockQuantity - reservedQuantity
```

وعند checkout:

```txt
if available < requestedQuantity → reject order
```

حتى لو ERP هو المصدر الحقيقي، المنصة تمنع بيع كمية محجوزة أو غير متاحة.

---

## عدم وجود DB-to-DB

لا يوجد ربط مباشر بين قواعد البيانات.

الدورة تعتمد على:

```txt
Order API
→ Integration Events
→ Background Jobs
→ Local Sync Agent / Cloud Adapter
→ ERP
→ ERP Events back
→ Integration Queue
→ Platform update
```

---

## المطلوب بعد Deploy

تطبيق migration الجديدة مع migrations السابقة:

```bash
psql "$DATABASE_URL" -f drizzle/0036_accounting_integration_architecture.sql
psql "$DATABASE_URL" -f drizzle/0037_local_sync_agent_runtime.sql
psql "$DATABASE_URL" -f drizzle/0038_enterprise_erp_integration_infrastructure.sql
psql "$DATABASE_URL" -f drizzle/0039_erp_financial_inventory_cycle.sql
```

ثم Deploy جديد.

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

محاولة build داخل Arena فشلت بـ:

```txt
SIGKILL
```

وذلك بسبب قيود الذاكرة في البيئة، كما حدث سابقاً.

---

## خلاصة الدورة النهائية

```txt
Customer Checkout
   ↓
Platform Order Created
   ↓
Platform Reservation Only
   ↓
order.created Integration Event
   ↓
Local Agent / Cloud ERP Adapter
   ↓
ERP Sales Order / Pending Order
   ↓
ERP Invoice on Delivery/Approval
   ↓
ERP Stock Deduction + Revenue Posting
   ↓
ERP sends invoice.created + inventory.updated
   ↓
Platform releases reservation + updates stock + updates reports
```

هذه هي الدورة المالية والمخزنية الصحيحة لمنصة Enterprise تعتمد ERP كمصدر حقيقي للمخزون والمحاسبة.
