# تقرير دمج صفحات الأدمن وتطوير التعديل الجماعي لمنتجات التاجر — 2026-07-08

## الهدف
تخفيف عدد صفحات لوحة التحكم بدمج النوافذ المتقاربة وظيفياً، ثم إضافة أدوات تشغيلية للتاجر:

1. دمج الأخبار مع الإعلانات والبانرات.
2. دمج RBAC Builder المتقدم مع صفحة الصلاحيات.
3. دمج إعدادات النظام مع Theme Builder وLayout Builder.
4. إضافة تعديل جماعي لأسعار المنتجات في لوحة التاجر.
5. إضافة حذف صنف فقط إذا لم يكن عليه أي حركة/طلبات.

---

## 1) دمج الأخبار مع الإعلانات والبانرات

### تم التنفيذ في:

```txt
app/admin/ads/page.tsx
```

أصبحت صفحة الإعلانات تضم الآن:

- طلبات إعلانات المتاجر.
- البانرات.
- إعلانات المول.
- إعدادات الإعلانات.
- أخبار المول والشريط المتحرك.

### الصفحة القديمة:

```txt
/admin/news
```

أصبحت redirect إلى:

```txt
/admin/ads#news
```

### الملفات:

```txt
app/admin/ads/page.tsx
app/admin/news/page.tsx
```

---

## 2) دمج RBAC Builder المتقدم مع صفحة الصلاحيات

### تم التنفيذ في:

```txt
app/admin/roles/page.tsx
```

أصبحت صفحة الصلاحيات تحتوي:

- Role Management Panel.
- Role Templates.
- Roles overview.
- Permissions overview.
- RoleTemplateForm.

### الصفحة القديمة:

```txt
/admin/rbac-builder
```

أصبحت redirect إلى:

```txt
/admin/roles#advanced-rbac
```

### الملفات:

```txt
app/admin/roles/page.tsx
app/admin/rbac-builder/page.tsx
```

---

## 3) دمج إعدادات النظام + Theme Builder + Layout Builder

### تم التنفيذ في:

```txt
app/admin/settings/page.tsx
```

أصبحت الصفحة تضم:

- إعدادات هوية النظام.
- Theme Builder.
- محتوى الصفحة الرئيسية.
- Welcome Popup.
- إعدادات صفحة العروض.
- Layout Builder / ترتيب أقسام الرئيسية.

### الصفحات القديمة:

```txt
/admin/theme-builder
/admin/home-builder
```

أصبحت redirect إلى:

```txt
/admin/settings#theme
/admin/settings#layout
```

### الملفات:

```txt
app/admin/settings/page.tsx
app/admin/theme-builder/page.tsx
app/admin/home-builder/page.tsx
app/admin/page.tsx
```

كما تم تحديث بطاقات لوحة الأدمن لتقليل ظهور الصفحات المكررة.

---

## 4) التعديل الجماعي لأسعار منتجات التاجر

### تم التنفيذ في صفحة:

```txt
/merchant/products
```

أضفت صندوق تشغيل سريع:

```txt
تعديل جماعي للأسعار
```

يدعم:

- زيادة السعر بنسبة.
- تخفيض السعر بنسبة.
- زيادة السعر بمبلغ ثابت.
- تخفيض السعر بمبلغ ثابت.
- تطبيق على نتائج الفلترة الحالية.
- خيار تعديل السعر الأساسي `basePrice` أيضاً.
- تأكيد كتابي قبل التنفيذ.

### API جديد:

```txt
PATCH /api/merchant/products/bulk-prices
```

### الحماية:

- يتأكد من صلاحية التاجر على المتجر.
- يتأكد من صلاحية `products.manage`.
- لا يعمل إذا المتجر مجمد/غير مفعل.
- يسجل Audit Log.
- يمسح كاش المنتجات والمخزون.
- يحدث كاش الواجهة العامة.

### الملفات:

```txt
components/merchant/bulk-product-price-actions.tsx
app/api/merchant/products/bulk-prices/route.ts
app/merchant/products/page.tsx
```

---

## 5) حذف الصنف إذا لم يحتوي على حركة

### تم التنفيذ في:

```txt
DELETE /api/merchant/products/[id]
```

### القاعدة:

يمكن حذف الصنف فقط إذا:

```txt
لا توجد inventory_movements
ولا توجد order_items
```

إذا كان عليه حركة أو طلبات، يرجع النظام رسالة تمنع الحذف وتقترح الأرشفة بدلاً من الحذف.

### تم إضافة زر حذف في جدول المنتجات

في:

```txt
/merchant/products
```

### الملفات:

```txt
components/merchant/product-row-actions.tsx
app/api/merchant/products/[id]/route.ts
app/merchant/products/page.tsx
```

---

## 6) الحفاظ على الأداء

- الصفحات القديمة أصبحت redirects بدلاً من تكرار الواجهات.
- لم يتم تحميل صور إضافية في جداول المنتجات.
- التعديل الجماعي يعمل على نتائج الفلترة ولا يفتح كل المنتجات في الواجهة.
- API يحد عدد المنتجات المطابقة بـ 5000 والـ variants بـ 20000 للحماية.
- الكاش يتم تحديثه بعد عمليات bulk/delete.

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

وهو نفس قيد الذاكرة المعروف في بيئة Arena.

---

## الملفات الأساسية المعدلة/المضافة

```txt
app/admin/ads/page.tsx
app/admin/news/page.tsx
app/admin/roles/page.tsx
app/admin/rbac-builder/page.tsx
app/admin/settings/page.tsx
app/admin/theme-builder/page.tsx
app/admin/home-builder/page.tsx
app/admin/page.tsx

app/merchant/products/page.tsx
app/api/merchant/products/bulk-prices/route.ts
app/api/merchant/products/[id]/route.ts
components/merchant/bulk-product-price-actions.tsx
components/merchant/product-row-actions.tsx
```

## النتيجة
تم تخفيف لوحة الأدمن بدمج الصفحات المتقاربة، وإضافة أدوات تاجر عملية للتعديل الجماعي للأسعار وحذف المنتجات الآمنة فقط دون التأثير على السجلات المالية أو حركات المخزون.
