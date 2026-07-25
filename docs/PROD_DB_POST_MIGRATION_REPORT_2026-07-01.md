# تقرير ما بعد تطبيق migrations على قاعدة الإنتاج

التاريخ: 2026-07-01  
البيئة: Production-like Render PostgreSQL 18.4  
ملاحظة أمنية: تم التعامل مع رابط قاعدة البيانات كسر حساس، ولم يتم حفظه داخل ملفات المشروع. تم حذف الملف المؤقت الذي استُخدم للاتصال بعد الانتهاء.

---

## 1. ملخص القرار والتنفيذ

بناءً على موافقتك الصريحة على الخيار A، تم تطبيق كامل مجموعة migrations المطلوبة:

```txt
0016_peaceful_chimera.sql
0017_lethal_morbius.sql
0018_precise_admin_permissions.sql
0019_core_architecture_indexes.sql
0020_atomic_inventory_idempotency.sql
0021_background_jobs.sql
```

تم التنفيذ داخل transaction واحدة مع:

```txt
ON_ERROR_STOP
advisory lock
lock_timeout = 10s
statement_timeout = 180s
```

النتيجة:

```txt
Migration apply: SUCCESS
```

---

## 2. النسخة الاحتياطية قبل التنفيذ

قبل أي تعديل تم أخذ backup منطقي كامل مضغوط.

المسار:

```txt
backups/prod-pre-migration-2026-06-30T23-50-23-565Z.json.gz
```

الحجم:

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

ملاحظة: `pg_dump` الرسمي لم يعمل لأن الخادم PostgreSQL 18.4 بينما العميل المتاح 17.10، لذلك تم استخدام backup منطقي JSON كامل. يظل Render Snapshot مفضلاً كنسخة بنيوية كاملة للـ roles/owners/privileges.

---

## 3. حالة migrations بعد التنفيذ

قبل التنفيذ:

```txt
Applied migrations: 16
```

بعد التنفيذ:

```txt
Applied migrations: 22
```

آخر migrations المسجلة الآن:

```txt
0016 hash: 74442409c2c35a85b1c18bd85c16b5d508790735cc9e7c60a35bc0b5d4657570
0017 hash: 9c7eaf698f679928c20e188872f93c3142ea5bcf241b2df0fed17947df4e6e37
0018 hash: 4d6e5da642bd9b5db25515e1dc9170e8da87243a7e164c42c6b578dfe1ffe7e3
0019 hash: 00fc0e8eee94febe5ebb9fe86ad74fc87ea8b60a9423365704f821a0b443c1f1
0020 hash: 7907ff013d28b520fd4369ba15cd2a2087699de75e7643eb03d26c0
0021 hash: 50532735be0e36489894da88cd078b75abe9bdd0cc13cd6c750775868a487fe5
```

---

## 4. الجداول التي تمت إضافتها

تم التأكد بعد التنفيذ من وجود الجداول التالية:

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

لا توجد جداول مطلوبة مفقودة بعد التنفيذ.

---

## 5. الأعمدة التي تمت إضافتها إلى جداول موجودة

### order_items

```txt
sku
product_code
image_url
product_snapshot
```

### store_employees

```txt
group_role_id
```

### inventory_movements

```txt
reference_type
reference_id
```

---

## 6. indexes وقيود مهمة تم إنشاؤها

تم التأكد من وجود 28 index مهم للجداول الجديدة وتعديلات المخزون، منها:

```txt
background_jobs_queue_status_idx
background_jobs_queue_dedupe_unique
background_jobs_locked_idx
idempotency_keys_scope_key_unique
idempotency_keys_user_idx
idempotency_keys_expiry_idx
inventory_movements_reference_idx
inventory_movements_order_variant_reserve_unique
inventory_movements_order_variant_release_unique
inventory_movements_order_variant_return_unique
inventory_movements_order_variant_deduct_unique
order_invoices_order_unique
order_invoices_number_unique
order_status_history_order_idx
platform_employees_user_unique
platform_employees_number_unique
```

---

## 7. downtime / locks

التنفيذ اكتمل بنجاح وبدون توقف ظاهر من جهة أداة التنفيذ.

نوع العمليات:

- CREATE TABLE
- ALTER TABLE ADD COLUMN nullable
- CREATE INDEX
- INSERT permissions
- ADD FOREIGN KEY على جداول جديدة أو علاقات جديدة

التقييم:

```txt
Downtime فعلي: لم يتم رصده من التنفيذ
Lock risk: منخفض إلى متوسط قصير جداً
```

الأكثر حساسية كان:

```txt
CREATE INDEX على جداول موجودة
ALTER TABLE inventory_movements ADD COLUMN
ALTER TABLE order_items ADD COLUMN
ALTER TABLE store_employees ADD COLUMN
```

لكن الجداول الحالية صغيرة نسبياً، والتنفيذ اكتمل بنجاح.

---

## 8. مخاطر البيانات

لم يتم تنفيذ:

```txt
DROP TABLE
DROP COLUMN
RENAME COLUMN
TRUNCATE
DELETE FROM
```

المخاطر المباشرة على البيانات الحالية:

```txt
منخفضة
```

المخاطر السلوكية المستقبلية:

```txt
متوسطة/محدودة
```

بسبب وجود `ON DELETE CASCADE` في بعض علاقات الجداول الجديدة، خصوصاً جداول النزاعات والفواتير وسجل الطلبات. هذه العلاقات أُضيفت حسب تصميم الجداول التابعة، وبعد موافقتك الصريحة على الخيار A.

---

## 9. التحقق بعد التنفيذ

تم تشغيل الفحوصات المطلوبة:

```bash
npm run lint
npm run build
npm run typecheck
```

النتائج:

```txt
lint: PASS
typecheck: PASS
build: PASS
```

كما تم تشغيل الاختبارات الإضافية:

```bash
npm test
```

النتيجة:

```txt
tests: PASS
2 files / 6 tests
```

### prisma validate

تم فحص وجود Prisma:

```txt
prisma/schema.prisma: غير موجود
Prisma dependency: غير موجودة
```

النتيجة:

```txt
prisma validate: SKIPPED / NOT APPLICABLE
```

السبب: المشروع يستخدم Drizzle ORM وليس Prisma، ولا يوجد schema Prisma يمكن التحقق منه.

---

## 10. لم يتم تشغيل db:seed

تم الالتزام بشرطك:

```txt
db:seed: NOT RUN
```

لم يتم تشغيل seed نهائياً.

---

## 11. rollback plan بعد التنفيذ

إذا ظهرت مشكلة حرجة قبل أن يبدأ النظام بإنتاج بيانات جديدة في الجداول الجديدة، يمكن rollback يدوياً كالتالي، مع أخذ backup إضافي أولاً:

### 0021 rollback

```sql
DROP TABLE IF EXISTS background_jobs;
DELETE FROM drizzle.__drizzle_migrations WHERE hash = '50532735be0e36489894da88cd078b75abe9bdd0cc13cd6c750775868a487fe5';
```

### 0020 rollback

```sql
DROP TABLE IF EXISTS idempotency_keys;
DROP INDEX IF EXISTS inventory_movements_order_variant_reserve_unique;
DROP INDEX IF EXISTS inventory_movements_order_variant_release_unique;
DROP INDEX IF EXISTS inventory_movements_order_variant_return_unique;
DROP INDEX IF EXISTS inventory_movements_order_variant_deduct_unique;
DROP INDEX IF EXISTS inventory_movements_reference_idx;
ALTER TABLE inventory_movements DROP COLUMN IF EXISTS reference_type;
ALTER TABLE inventory_movements DROP COLUMN IF EXISTS reference_id;
DELETE FROM drizzle.__drizzle_migrations WHERE hash = '7907ff013d28b520fd4369ba15cd2a2087699de75e7643eb03d26c0';
```

### 0019 rollback

إزالة indexes المضافة فقط إن لزم.

### 0018 rollback

حذف permissions المضافة فقط إن لم تعد مستخدمة.

### 0017 rollback

```sql
DROP TABLE IF EXISTS platform_employees;
ALTER TABLE store_employees DROP COLUMN IF EXISTS group_role_id;
DELETE FROM drizzle.__drizzle_migrations WHERE hash = '9c7eaf698f679928c20e188872f93c3142ea5bcf241b2df0fed17947df4e6e37';
```

### 0016 rollback

```sql
DROP TABLE IF EXISTS order_dispute_evidence;
DROP TABLE IF EXISTS order_dispute_messages;
DROP TABLE IF EXISTS order_disputes;
DROP TABLE IF EXISTS order_invoices;
DROP TABLE IF EXISTS order_status_history;
ALTER TABLE order_items DROP COLUMN IF EXISTS sku;
ALTER TABLE order_items DROP COLUMN IF EXISTS product_code;
ALTER TABLE order_items DROP COLUMN IF EXISTS image_url;
ALTER TABLE order_items DROP COLUMN IF EXISTS product_snapshot;
DELETE FROM drizzle.__drizzle_migrations WHERE hash = '74442409c2c35a85b1c18bd85c16b5d508790735cc9e7c60a35bc0b5d4657570';
```

تحذير: بعد تشغيل التطبيق الجديد، هذه الجداول قد تحتوي بيانات production، لذلك rollback بعد التشغيل يجب أن يكون مدروساً وقد يتطلب ترحيل بيانات وليس drop مباشر.

---

## 12. التوصيات التالية

1. إنشاء Render Database Snapshot من لوحة Render كنسخة رسمية إضافية.
2. ضبط Redis production variables قبل إطلاق الكاش والـ rate limits بشكل كامل.
3. تشغيل job processor:

```bash
npm run jobs:worker
```

أو ضبط cron:

```txt
/api/cron/jobs/process?limit=25
Authorization: Bearer CRON_SECRET
```

4. البدء بالمرحلة التالية:

```txt
Search Scalability: pg_trgm + GIN indexes + search provider + Redis search cache
```
