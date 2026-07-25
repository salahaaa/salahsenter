# Notes Completion Report

تاريخ التنفيذ: 2026-06-17

## الملاحظات التي تمت معالجتها

### 1) Rate Limiting

تمت إضافة Rate Limiting مبدئي لمسارات حساسة:

- تسجيل الدخول.
- تسجيل حساب جديد.
- رفع الملفات.
- إرسال طلب فتح متجر.
- توقيع العقد.
- رفع مستندات طلب فتح المتجر.

الملف:

```txt
lib/rate-limit.ts
```

ملاحظة: هذا Rate Limit in-memory مناسب كبداية، ويفضل استبداله بـ Redis/Upstash في الإنتاج متعدد السيرفرات.

### 2) CSRF / Origin Validation

تم تحديث `middleware.ts` لمنع الطلبات cross-origin لطلبات API غير GET/HEAD/OPTIONS.

### 3) RBAC دقيق لعمليات التاجر

تمت إضافة:

```txt
userHasStorePermission
assertStorePermission
```

داخل:

```txt
lib/rbac.ts
```

وتم ربطها بمسارات تشغيلية للتاجر مثل:

- المنتجات.
- المخزون.
- الوسائط.
- إعدادات المتجر.
- إعلانات المتجر.
- أخبار المتجر.
- موظفي المتجر.
- تحديث حالة الطلب.

### 4) حماية رفع الملفات

تمت إضافة فحص Magic Bytes للملفات في:

```txt
lib/media.ts
```

ويتم رفض SVG لأسباب أمنية، والتحقق من توقيع الصور و PDF والفيديو MP4.

### 5) حماية API العقد والمستندات

تم سابقاً ربط العقد بـ token hash وملكية المستخدم، وتم إضافة مستندات الطلب مع تحقق صلاحيات الوصول.

## نتائج الفحص

تم تشغيل:

```bash
npm run lint
npm run typecheck
npm run build
npm audit --audit-level=high
```

النتيجة:

```txt
Passed
No high or critical vulnerabilities
```

## ملاحظات متبقية للإنتاج

- استبدال rate limit الحالي بـ Redis/Upstash.
- إضافة Playwright E2E tests حقيقية على staging.
- ربط البريد والرسائل بمزود فعلي.
- تخزين النسخ الاحتياطية في S3/R2 بدلاً من النظام المحلي.

## Update: Permission Save + Demo Data + Security Hardening

تمت إضافة:

- واجهة إدارة أدوار وصلاحيات قابلة للحفظ في `/admin/roles`.
- APIs لحفظ الأدوار والصلاحيات:
  - `/api/admin/rbac/roles`
  - `/api/admin/rbac/roles/[id]`
- حسابات تجريبية في `db:seed`:
  - admin@salah.center / Demo@123456
  - merchant@salah.center أو SLH-000001 / Demo@123456
  - customer@salah.center / Demo@123456
- متجر تجريبي نشط ورقم متجر SLH-000001.
- منتج تجريبي نشط بمتغيرات ومخزون.
- فحص Magic Bytes للملفات.
- Rate Limit مبدئي.
- Origin validation للـ API.
- RBAC دقيق على APIs التاجر.

تمت إعادة الفحص:

```bash
npm run lint
npm run typecheck
npm run build
```

والنتيجة ناجحة.
