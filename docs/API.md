# REST API MVP

كل الاستجابات القياسية:

```json
{ "success": true, "data": {} }
```

أو:

```json
{ "success": false, "message": "رسالة واضحة", "details": {} }
```

## Auth

| Method | Endpoint | الوصف |
|---|---|---|
| POST | `/api/auth/register` | تسجيل عميل جديد |
| POST | `/api/auth/login` | تسجيل الدخول وإنشاء Session Cookie |
| POST | `/api/auth/logout` | تسجيل الخروج |

## Merchant Applications

| Method | Endpoint | الصلاحية | الوصف |
|---|---|---|---|
| POST | `/api/merchant-applications` | عام/عميل | إرسال طلب فتح متجر |
| GET | `/api/merchant-applications` | Super Admin | عرض طلبات التجار |
| GET/POST | `/api/merchant-applications/:id/contract` | مقدم الطلب | عرض العقد وحفظ التوقيع الإلكتروني ونقل الطلب لانتظار الموافقة النهائية |
| PATCH | `/api/admin/merchant-applications/:id` | Super Admin | تغيير حالة الطلب |
| POST | `/api/admin/merchant-applications/:id/approve` | Super Admin | الموافقة النهائية بعد توقيع العقد: إنشاء التاجر والمتجر والتفعيل |

## Admin

| Method | Endpoint | الوصف |
|---|---|---|
| GET/PATCH | `/api/admin/settings` | إعدادات النظام العامة |
| GET/POST | `/api/admin/home-sections` | أقسام الصفحة الرئيسية |
| GET/POST | `/api/admin/wings` | الأجنحة وصورها |
| GET/POST | `/api/admin/banners` | بانرات المول الرئيسية |
| GET/POST | `/api/admin/announcements` | إعلانات المول العامة فقط |
| GET/POST | `/api/admin/news` | أخبار المول وشريط الأخبار |
| GET/POST | `/api/admin/geography` | الدول والمحافظات والمدن والمناطق |
| PATCH/DELETE | `/api/admin/geography/:kind/:id` | تعديل/حذف عنصر جغرافي |
| GET/POST | `/api/admin/subscriptions` | باقات الاشتراك |
| GET/POST | `/api/admin/default-media` | الصور الافتراضية للأنشطة |
| PATCH | `/api/admin/stores/:id` | تحديث حالة المتجر وإظهاره/إخفاؤه |

## Public Marketplace

| Method | Endpoint | الوصف |
|---|---|---|
| GET | `/api/stores` | قائمة المتاجر النشطة |
| GET | `/api/stores/:slug` | تفاصيل متجر عام |

## Merchant

| Method | Endpoint | الوصف |
|---|---|---|
| GET/POST | `/api/merchant/products` | منتجات المتجر ومتغيراتها |
| PATCH | `/api/merchant/store-media` | تحديث وسائط المتجر |
| GET/POST | `/api/merchant/store-settings` | الأقسام والوحدات والمقاسات والألوان |
| GET/POST | `/api/merchant/announcements` | إعلانات المتجر، تظهر داخل المتجر فقط |
| GET/POST | `/api/merchant/news` | أخبار المتجر المتحركة داخل المتجر فقط |
| GET/POST | `/api/merchant/inventory` | المخزون وحركات الإضافة/الخصم/الجرد |

## Orders

| Method | Endpoint | الوصف |
|---|---|---|
| GET | `/api/orders` | طلبات المستخدم حسب دوره |
| POST | `/api/orders` | إنشاء طلب وخصم المخزون وتسجيل حركة مخزون |
| PATCH | `/api/orders/:id/status` | تحديث حالة الطلب حسب الانتقالات المسموحة |


## Media Uploads

| Method | Endpoint | الوصف |
|---|---|---|
| POST | `/api/media/upload` | رفع ملف فعلي إلى Local/Cloudinary/S3/R2 حسب الإعدادات |
| GET | `/api/media/assets` | مكتبة الوسائط المرفوعة |

## Employees RBAC

| Method | Endpoint | الوصف |
|---|---|---|
| GET/POST | `/api/merchant/employees` | إنشاء موظف متجر وربطه بدور وصلاحيات مخصصة |
| PATCH/DELETE | `/api/merchant/employees/:id` | تعديل/حذف موظف متجر |

## Backup / Restore

| Method | Endpoint | الوصف |
|---|---|---|
| GET/POST | `/api/admin/backups` | عرض/إنشاء نسخ احتياطية JSON |
| GET | `/api/admin/backups/:file/download` | تنزيل نسخة احتياطية |
| POST | `/api/admin/backups/:file/restore` | استعادة نسخة احتياطية بإدراج البيانات غير الموجودة |

## Payment & Shipping

| Method | Endpoint | الوصف |
|---|---|---|
| GET/POST | `/api/admin/payment-methods` | وسائل الدفع |
| PATCH/DELETE | `/api/admin/payment-methods/:id` | تعديل/حذف وسيلة دفع |
| GET/POST | `/api/admin/shipping-methods` | وسائل الشحن |
| PATCH/DELETE | `/api/admin/shipping-methods/:id` | تعديل/حذف وسيلة شحن |
