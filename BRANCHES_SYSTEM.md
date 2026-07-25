# Multi-Store Branches System

## الهدف
تمكين التاجر المعتمد من فتح أكثر من محل/فرع لنفس الشركة دون تقديم طلب تاجر جديد لكل فرع، مع ربط كل محل بإيجار مستقل وإدارة موحدة بنفس بيانات دخول التاجر.

## الصفحات
```txt
/merchant/branches   لوحة التاجر لإدارة المحلات والفروع
/admin/branches      لوحة الإدارة لاعتماد الفروع وتحديد الإيجار
```

## APIs
```txt
GET  /api/merchant/branches
POST /api/merchant/branches
PATCH /api/merchant/active-store
GET  /api/admin/branches
PATCH /api/admin/branches
```

## الجداول
```txt
store_groups
store_branch_profiles
store_rent_invoices
```

## آلية العمل
1. التاجر لديه متجر رئيسي معتمد.
2. من `/merchant/branches` يطلب فتح فرع جديد مثل "فرع تعز".
3. النظام ينشئ Store جديد بحالة pending ويربطه بنفس merchantId ونفس حساب التاجر.
4. الإدارة تراجع الطلب من `/admin/branches`.
5. عند الاعتماد:
   - يصبح المتجر active.
   - يتم تحديد الإيجار والعملة والدورة.
   - يتم إنشاء فاتورة إيجار أولية إن كان الإيجار أكبر من صفر.
6. التاجر يستطيع اختيار المحل النشط للإدارة، وجميع صفحات لوحة التاجر الحالية ستستخدم المحل المختار عبر cookie آمن `merchant_store_id`.

## العزل والصلاحيات
- كل فرع هو سجل مستقل في جدول `stores` لذلك المنتجات والطلبات والمخزون تبقى مستقلة لكل محل.
- نفس التاجر يملك كل الفروع عبر `stores.merchantId`.
- الموظفون والصلاحيات تبقى store-scoped.
- `getMerchantPrimaryStore` أصبح يفضل المحل المختار ثم يعود للمحل الرئيسي.

## الإيرادات
كل محل/فرع يمكن أن يحمل إيجاراً مستقلاً عبر:
```txt
store_branch_profiles.rent_amount
store_branch_profiles.rent_cycle
store_rent_invoices
```
