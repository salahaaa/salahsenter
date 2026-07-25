# تقرير إعادة الفحص الدقيق: فتح المتجر والعقد والمتغيرات والصلاحيات — 2026-06-26

## نطاق الفحص

تمت إعادة فحص المحاور التالية:

1. دورة فتح المتجر.
2. دورة إنشاء العقد وتوقيعه والموافقة النهائية.
3. نظام المتغيرات والوحدات في المنتج.
4. نظام الصلاحيات وموظفي المنصة والمتجر.

---

## أولاً: دورة فتح المتجر والعقد

### المسار الحالي بعد الفحص

```txt
إنشاء حساب / تسجيل دخول
→ تقديم طلب فتح متجر
→ pending
→ بدء مراجعة الأدمن
→ under_review
→ قبول مبدئي
→ pre_approved
→ إنشاء وإرسال العقد
→ contract_created
→ توقيع التاجر للعقد
→ waiting_final_approval
→ موافقة نهائية من الأدمن
→ active + إنشاء المتجر + إنشاء عقد تشغيل فعلي
```

### ما تم التحقق منه

- لا يمكن تقديم طلب فتح متجر بدون تسجيل دخول.
- لا يمكن تقديم طلب جديد إذا كان للحساب متجر قائم أو طلب مفتوح.
- صفحة متابعة الطلب محمية لصاحب الطلب أو الأدمن.
- صفحة العقد لا تظهر إلا بعد إنشاء العقد.
- العقد يمكن الوصول إليه عبر:
  - صاحب الطلب المسجل.
  - الأدمن.
  - token آمن مرسل في التنبيه.
- لا يمكن تفعيل المتجر قبل توقيع العقد.
- الموافقة النهائية تنشئ:
  - حساب/ربط التاجر.
  - merchant profile.
  - store.
  - store wing link.
  - merchant contract.
  - role للتاجر على المتجر.
  - notification للتاجر.
  - audit log.

### إصلاحات تمت أثناء الفحص

- بعد توقيع العقد كان النظام يضع الحالة `contract_signed` فقط، وتم تعديلها إلى:

```txt
waiting_final_approval
```

حتى تكون دورة العمل أوضح: العقد موقّع وينتظر الموافقة النهائية.

- الموافقة النهائية كانت تستخدم مدة عقد افتراضية جديدة، وتم تعديلها لتستخدم تاريخ بداية ونهاية العقد التي أنشأها الأدمن عند إرسال العقد إذا كانت موجودة:

```txt
application.contractStartAt
application.contractEndAt
application.contractDurationDays
```

- رفض الطلب من زر الرفض السريع أصبح يستخدم مسار المراجعة المنضبط:

```txt
/api/admin/merchant-applications/[id]/review
```

بدلاً من تغيير الحالة مباشرة عبر PATCH، حتى يخضع لقواعد الانتقال والتنبيهات.

- تم السماح برفض الطلب قبل الموافقة النهائية حتى لو كان العقد موقّعاً:

```txt
contract_signed
waiting_final_approval
```

---

## ثانياً: فحص نظام المتغيرات والوحدات

### ما تم التحقق منه

- التاجر لا يرى كل المتغيرات دفعة واحدة.
- يختار المتغير أولاً، ثم تظهر قيمه فقط.
- يمكن إضافة أكثر من متغير.
- يتم توليد التركيبات من القيم المختارة.
- لكل تركيبة وحدة بيع مستقلة.
- الوحدات تدعم مفاهيم مثل:

```txt
حبة
كيس
كرتون = 20 حبة
درزن = 12 حبة
```

### حماية API بعد الفحص

تم التأكد من أن API إضافة المنتج يمنع:

- الحفظ بدون قسم.
- الحفظ بقسم لا يتبع المتجر.
- الحفظ بدون وحدة بيع.
- الحفظ بوحدة بيع لا تتبع المتجر.
- الحفظ بدون قيم متغيرات.
- الحفظ بقيم متغيرات لا تتبع المتجر.
- اختيار أكثر من قيمة لنفس المتغير في نفس التركيبة.
- نشر منتج بدون سعر.
- نشر منتج بكود يدوي فارغ.

### إصلاح تمت إضافته أثناء الفحص

تمت إضافة تحقق إلزامي من المتغيرات المطلوبة:

إذا كانت هناك خاصية متغير معلّمة كـ:

```txt
isRequired = true
```

فكل تركيبة يجب أن تحتوي قيمة لهذه الخاصية، وإلا يرفض API الحفظ برسالة واضحة.

---

## ثالثاً: فحص نظام الصلاحيات RBAC

### المشكلة التي ظهرت أثناء الفحص

نظام موظفي المنصة الجديد كان يسمح بإنشاء موظف وصلاحيات، لكن middleware القديم كان يسمح بدخول `/admin` فقط لمن لديه role code:

```txt
super_admin
```

وهذا يعني أن موظف المنصة الجديد لن يستطيع دخول لوحة الأدمن حتى لو أعطيته صلاحية `admin.access`.

### الإصلاحات المنفذة

- تم تحديث middleware ليسمح بدخول `/admin` لـ:

```txt
super_admin
platform_employee_*
```

- تم تحديث `assertAdmin` ليصبح فحصاً فعلياً للصلاحيات:

```txt
super_admin
أو admin.access
```

- أصبح `assertAdmin` يدعم صلاحية تفصيلية اختيارية، مثل:

```txt
assertAdmin(session, "merchant_applications.manage")
assertAdmin(session, "roles.manage")
assertAdmin(session, "stores.manage")
assertAdmin(session, "products.manage")
```

- تم تطبيق الصلاحيات التفصيلية على الملفات الحساسة التالية:

```txt
طلبات فتح المتاجر والعقود: merchant_applications.manage
إدارة موظفي المنصة والصلاحيات: roles.manage
إدارة المتاجر: stores.manage
إدارة المنتجات المخالفة: products.manage
```

- تم إجبار موظف المنصة على امتلاك `admin.access` دائماً داخل صلاحياته المباشرة حتى لا يحدث تعارض بين middleware والـ API.

---

## رابعاً: فحص APIs

بعد الفحص:

```txt
Admin API routes: 67
كلها تستخدم await assertAdmin
Merchant API routes: 38
كلها تستخدم requireAuth
```

كما تم التأكد من عدم بقاء أي استدعاء:

```txt
assertAdmin(session);
```

بدون:

```txt
await
```

---

## الملفات التي تم تعديلها في هذا الفحص

```txt
middleware.ts
lib/rbac.ts
app/api/merchant-applications/[id]/contract/route.ts
app/api/admin/merchant-applications/[id]/approve/route.ts
app/api/admin/merchant-applications/[id]/review/route.ts
components/admin/merchant-application-actions.tsx
app/api/merchant/products/route.ts
app/api/admin/employees/route.ts
app/api/admin/employees/[id]/route.ts
app/admin/employees/page.tsx
app/admin/merchant-applications/page.tsx
app/admin/stores/page.tsx
app/admin/products/page.tsx
app/admin/roles/page.tsx
```

---

## أوامر الفحص المنفذة

```bash
npm install
npm run typecheck
npm run lint
npm run test
npm run check:paths
npx drizzle-kit check --config=drizzle.config.ts
npm run build
npm audit --audit-level=high
```

### النتائج

```txt
TypeScript: ناجح
Lint: ناجح
Tests: ناجحة 6/6
Path check: ناجح
Drizzle check: ناجح
Build production: ناجح
```

### npm audit

لا توجد High/Critical.

الموجود فقط:

```txt
2 moderate عبر exceljs -> uuid
```

ولم يتم استخدام:

```bash
npm audit fix --force
```

لأنه سيخفض/يكسر `exceljs`.

---

## نتيجة الفحص النهائية

```txt
دورة فتح المتجر والعقد أصبحت أوضح وأكثر انضباطاً.
نظام المتغيرات يمنع الآن الحفظ الناقص ويؤكد تبعية القسم والوحدات والقيم للمتجر.
نظام الصلاحيات أصبح يدعم موظفي منصة حقيقيين مع admin.access وصلاحيات تفصيلية.
المسارات الحساسة لفتح المتاجر والعقود والموظفين والمتاجر والمنتجات أصبحت مرتبطة بصلاحيات تفصيلية.
البناء والإختبارات ناجحة.
```

---

## ملاحظات مهمة للنشر

لأن آخر تحديث أضاف migration سابقاً لنظام الموظفين:

```txt
0017_lethal_morbius.sql
```

يجب تشغيل migration على قاعدة الإنتاج بعد الرفع:

```bash
npm run db:migrate
```

ثم:

```bash
npm run build
```
