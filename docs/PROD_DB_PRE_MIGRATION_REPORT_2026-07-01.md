# تقرير ما قبل تطبيق migrations على قاعدة الإنتاج

التاريخ: 2026-07-01  
قاعدة البيانات: Render PostgreSQL production — تم إخفاء رابط الاتصال وكلمة المرور عمداً.

## 1. نتيجة فحص الاتصال

تم فحص الاتصال فقط بدون أي تعديل.

النتيجة:

```txt
Connection: OK
Database: my_datasalah
User: [masked]
PostgreSQL: 18.4
Provider/Region: Render Frankfurt host
```

لم يتم تنفيذ أي migration حتى لحظة هذا التقرير.

---

## 2. حالة migrations الحالية

### الموجود محلياً داخل المشروع

عدد ملفات migrations المحلية:

```txt
22
```

آخر الملفات المحلية:

```txt
0016_peaceful_chimera.sql
0017_lethal_morbius.sql
0018_precise_admin_permissions.sql
0019_core_architecture_indexes.sql
0020_atomic_inventory_idempotency.sql
0021_background_jobs.sql
```

### الموجود في قاعدة البيانات

جدول Drizzle migrations موجود:

```txt
drizzle.__drizzle_migrations = موجود
```

عدد migrations المسجلة في قاعدة البيانات:

```txt
16
```

آخر hash مطابق محلياً حتى:

```txt
0015_past_gravity.sql
```

بالتالي القاعدة متأخرة عن الكود الحالي من:

```txt
0016 → 0021
```

---

## 3. فحص schema الحالي مقابل الكود

عدد الجداول المتوقعة من `lib/db/schema.ts`:

```txt
100
```

عدد جداول public الحالية في قاعدة البيانات:

```txt
92
```

الجداول المتوقعة المفقودة حالياً:

```txt
background_jobs
idempotency_keys
order_dispute_evidence
order_dispute_messages
order_disputes
order_invoices
order_status_history
platform_employees
```

هذا يعني أن تطبيق migrations الجديدة فقط `0020` و `0021` لن يكون كافياً بالكامل، لأن الكود الحالي أيضاً يعتمد على جداول من `0016` و `0017` مثل:

```txt
order_invoices
order_status_history
```

وهذه مستخدمة في مسار إنشاء الطلب وتحديث الحالة.

---

## 4. الجداول المتأثرة بالمجموعة المطلوبة

### 0016_peaceful_chimera.sql

ينشئ:

```txt
order_disputes
order_dispute_messages
order_dispute_evidence
order_invoices
order_status_history
```

ويضيف foreign keys وindexes.

### 0017_lethal_morbius.sql

ينشئ:

```txt
platform_employees
```

ويضيف foreign keys وindexes.

### 0018_precise_admin_permissions.sql

يضيف permissions فقط عبر:

```txt
INSERT ... ON CONFLICT DO NOTHING
```

### 0019_core_architecture_indexes.sql

يضيف indexes فقط:

```txt
products_store_status_idx
products_store_created_at_idx
orders_store_status_idx
orders_customer_created_at_idx
stores_status_idx
merchant_applications_applicant_idx
merchant_applications_created_at_idx
inventory_movements_store_created_at_idx
```

### 0020_atomic_inventory_idempotency.sql

ينشئ:

```txt
idempotency_keys
```

ويعدل:

```txt
inventory_movements
```

بإضافة:

```txt
reference_type
reference_id
```

ويضيف indexes لمنع تكرار حركات المخزون للطلب.

### 0021_background_jobs.sql

ينشئ:

```txt
background_jobs
```

---

## 5. فحص الخطورة / destructive changes

تم فحص migrations المطلوبة من `0016` إلى `0021`.

### لم يتم العثور على:

```txt
DROP TABLE
DROP COLUMN
RENAME COLUMN
TRUNCATE
DELETE FROM
```

### تم العثور على:

```txt
ON DELETE CASCADE
```

داخل:

```txt
0016_peaceful_chimera.sql
0017_lethal_morbius.sql
```

التقييم:

- هذه القيود تُضاف على جداول جديدة فارغة حالياً، وليست تعديلاً مدمراً على بيانات موجودة.
- لكنها تظل `cascade relation behavior`، وقد طلبتَ صراحةً إيقاف التنفيذ وعرض تقرير إذا ظهرت تغييرات cascade/relations.

لذلك تم إيقاف التنفيذ قبل تطبيق أي migration بانتظار موافقتك الصريحة.

---

## 6. النسخة الاحتياطية

تمت محاولة استخدام `pg_dump`، لكن العميل المتاح في البيئة هو PostgreSQL 17 بينما الخادم PostgreSQL 18.4، لذلك رفض `pg_dump` التنفيذ بسبب version mismatch.

بدلاً من ذلك، تم إنشاء backup منطقي كامل بصيغة JSON مضغوطة يحتوي:

- metadata لقاعدة البيانات.
- أعمدة الجداول.
- indexes.
- constraints.
- كل صفوف كل الجداول في schemas غير النظامية.

مسار النسخة الاحتياطية داخل المشروع:

```txt
backups/prod-pre-migration-2026-06-30T23-50-23-565Z.json.gz
```

حجم النسخة:

```txt
103,320,130 bytes
```

SHA256:

```txt
2c227bfea648e4d111fe6cff356b8eedd5ebc0619216a0488ee421e5559a428d
```

ملف التحقق:

```txt
backups/prod-pre-migration-2026-06-30T23-50-23-565Z.json.gz.sha256
```

ملاحظة Enterprise مهمة:

هذه نسخة منطقية كاملة لبيانات التطبيق، لكنها ليست بديلاً مثالياً عن `pg_dump` الرسمي أو Render Snapshot لأنها لا تحفظ roles/owners/privileges بنفس صيغة PostgreSQL الأصلية. قبل التنفيذ النهائي في production يفضل أيضاً أخذ Snapshot من Render Dashboard إن أمكن.

---

## 7. downtime المحتمل

المجموعة المطلوبة أغلبها:

- CREATE TABLE
- CREATE INDEX
- ALTER TABLE ADD COLUMN
- INSERT permissions

التأثير المتوقع:

```txt
Downtime فعلي: منخفض جداً
Locks: قصيرة غالباً
```

المخاطر الأعلى نسبياً:

- إنشاء indexes على جداول موجودة مثل products/orders/inventory_movements قد يأخذ lock قصير.
- `ALTER TABLE inventory_movements ADD COLUMN` سريع لأنه أعمدة nullable بدون default ثقيل.
- لا توجد drop/rename/delete.

---

## 8. مخاطر البيانات

### مخاطر مباشرة على البيانات الحالية

```txt
منخفضة
```

لأن migrations لا تحذف ولا تعيد تسمية أعمدة ولا تغير أنواع أعمدة موجودة.

### مخاطر سلوكية مستقبلية

```txt
متوسطة/محدودة
```

بسبب `ON DELETE CASCADE` على جداول جديدة:

- حذف order مستقبلاً سيحذف dispute/invoice/history المرتبطة.
- حذف user/store مرتبط ببعض الجداول الجديدة قد يحذف child rows حسب constraint.

هذا متوقع في تصميم الجداول التابعة، لكنه سبب الإيقاف والانتظار حسب شرطك.

---

## 9. rollback plan

بما أنه لم يتم تطبيق أي migration بعد، لا يوجد rollback مطلوب الآن.

إذا وافقت على التطبيق لاحقاً، ستكون خطة rollback كالتالي:

### Rollback من 0021

```sql
DROP TABLE IF EXISTS background_jobs;
```

### Rollback من 0020

```sql
DROP TABLE IF EXISTS idempotency_keys;
DROP INDEX IF EXISTS inventory_movements_order_variant_reserve_unique;
DROP INDEX IF EXISTS inventory_movements_order_variant_release_unique;
DROP INDEX IF EXISTS inventory_movements_order_variant_return_unique;
DROP INDEX IF EXISTS inventory_movements_order_variant_deduct_unique;
DROP INDEX IF EXISTS inventory_movements_reference_idx;
ALTER TABLE inventory_movements DROP COLUMN IF EXISTS reference_type;
ALTER TABLE inventory_movements DROP COLUMN IF EXISTS reference_id;
```

### Rollback من 0019

حذف indexes المضافة فقط عند الحاجة.

### Rollback من 0018

حذف permissions المضافة فقط إذا لم تعد مطلوبة.

### Rollback من 0017

```sql
DROP TABLE IF EXISTS platform_employees;
```

### Rollback من 0016

```sql
DROP TABLE IF EXISTS order_dispute_evidence;
DROP TABLE IF EXISTS order_dispute_messages;
DROP TABLE IF EXISTS order_disputes;
DROP TABLE IF EXISTS order_invoices;
DROP TABLE IF EXISTS order_status_history;
```

مع التنبيه: بعد تشغيل التطبيق الجديد، قد تحتوي هذه الجداول الجديدة على بيانات، لذلك rollback بعد التشغيل يجب أن يتم بحذر شديد أو بعد تصدير بيانات هذه الجداول.

---

## 10. قرار التنفيذ

بناءً على شرطك:

> إذا وجدت cascade changes أو alter relation أوقف التنفيذ واعرض تقريراً قبل التطبيق.

تم إيقاف التنفيذ الآن ولم يتم تطبيق migrations.

المطلوب منك الآن موافقة صريحة على أحد الخيارين:

### الخيار A — تطبيق كامل المجموعة المطلوبة 0016 → 0021

موصى به لأن القاعدة متأخرة عن الكود الحالي، والكود يحتاج `order_invoices` و `order_status_history` بالإضافة إلى جداول المرحلة الجديدة.

### الخيار B — تطبيق فقط 0020 و 0021

غير موصى به، لأن بعض جداول مستخدمة حالياً في الكود ستبقى مفقودة.

### الخيار C — عدم التطبيق الآن

نحتفظ بالتقرير والنسخة الاحتياطية، ولا نغير قاعدة البيانات.
