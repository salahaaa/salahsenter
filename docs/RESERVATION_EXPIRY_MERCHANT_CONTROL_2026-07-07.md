# تعديل Reservation Expiry ليكون بقرار التاجر — 2026-07-07

## سبب التعديل
كان النظام يملك قيمة عامة لانتهاء حجز المخزون عبر:

```txt
ORDER_RESERVATION_TTL_MINUTES
```

وهذا يفرض وقتاً على كل التجار. بناءً على طلبك، تم تعديل التصميم بحيث لا يفرض النظام وقتاً موحداً، بل يصبح القرار من صلاحيات التاجر لكل متجر.

---

## القرار الجديد

لكل متجر إعدادان داخل إعدادات الطلبات:

```txt
enableReservationExpiry
reservationExpiryMinutes
```

### إذا لم يفعّل التاجر انتهاء الحجز

```txt
reservation_expires_at = null
```

وبالتالي:

- لا يلغي cron الطلب تلقائياً.
- لا يفك الحجز بسبب الوقت.
- يبقى فك الحجز من خلال إلغاء يدوي أو رد ERP.

### إذا فعّل التاجر انتهاء الحجز

يحدد المدة بالدقائق، مثلاً:

```txt
120 دقيقة
360 دقيقة
1440 دقيقة
```

وعند انتهاء الوقت بدون فاتورة ERP:

- يتم فك الحجز.
- يتم إلغاء الطلب.
- لا يتم إنشاء فاتورة.
- لا يحدث تأثير مالي.
- لا يتم تعديل مخزون ERP الفعلي.

---

## ما تم تعديله

### API إعدادات الطلبات

```txt
app/api/merchant/order-settings/route.ts
```

تمت إضافة:

```ts
enableReservationExpiry: boolean
reservationExpiryMinutes: number
```

### واجهة التاجر

```txt
components/merchant/operations-settings-panel.tsx
```

تمت إضافة حقول داخل صفحة:

```txt
/merchant/operations-settings
```

- تفعيل انتهاء حجز المخزون تلقائياً.
- مدة حجز المخزون بالدقائق.
- ملاحظة توضح أن المدة يحددها التاجر.

### Checkout Options

```txt
app/api/checkout/options/route.ts
```

تم تحديث الإعدادات الافتراضية كي تظهر للواجهة.

### إنشاء الطلب

```txt
app/api/orders/route.ts
```

أصبح:

```txt
إذا enableReservationExpiry=false → reservationExpiresAt=null
إذا enableReservationExpiry=true  → reservationExpiresAt=now + reservationExpiryMinutes
```

### حذف فرض النظام من env

تم حذف:

```txt
ORDER_RESERVATION_TTL_MINUTES
```

من:

```txt
.env.example
.env.production.example
```

لأن القرار أصبح من إعدادات المتجر وليس من متغير عام.

---

## Cron ما زال يعمل كل 5 دقائق

```txt
/api/cron/reservations/expire?limit=50
```

لكنه لن يؤثر إلا على الطلبات التي فعل تاجرها انتهاء الحجز ولها:

```txt
reservation_expires_at <= now
```

أما المتاجر التي لم تفعل الميزة فلن يفرض عليها النظام أي وقت.

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

محاولة build داخل Arena فشلت بـ SIGKILL بسبب قيود الذاكرة كما في المرات السابقة.

---

## تنظيف المحادثة/المشروع

تم تحديث ملف الاستمرار المختصر:

```txt
docs/FAST_CONTINUATION_STATE.md
```

وتم حذف الملفات الثقيلة بعد الفحص:

```txt
node_modules
.next
tsconfig.tsbuildinfo
```

ليظل المشروع خفيفاً داخل Arena.
