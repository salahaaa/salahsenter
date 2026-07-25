# Team Test Control Center — QA Evidence and Failure Registry

**التاريخ:** 25 يوليو 2026  
**النطاق:** تطوير مصدر فقط. لا توجد قاعدة Staging حية أو حسابات QA تم إنشاؤها أو تشغيلها في هذه الحزمة.

## الهدف

تمكين فريق الاختبار متعدد الأدوار من تسجيل:

```text
حالة الاختبار
الدليل
ملاحظات التنفيذ
سبب الفشل أو الحجب
```

باسم الحساب الفردي، ثم تجميع ذلك في لوحة أدمن واحدة بدلاً من مشاركة حساب أو توزيع أدلة الاختبار داخل محادثات غير منظمة.

## ما أضيف

### Migration 0088

```text
drizzle/0088_qa_test_runs_evidence_registry.sql
```

وأضيفت إلى:

```text
drizzle/meta/_journal.json
```

تنشئ:

```text
qa_test_runs
```

وتحفظ:

```text
case_key
category
environment
status
severity
executor_user_id
evidence_url
note
failure_summary
started_at
completed_at
```

الحالات المدعومة:

```text
planned
running
passed
failed
blocked
```

### كتالوج موحد

```text
lib/qa/test-catalog.ts
```

ويحتوي حالات تشمل المسارات المطلوبة:

```text
DB-SCHEMA-01
PUBLIC-DATA-01
RBAC-01
COMMERCE-01
CHECKOUT-01
A11Y-01
TEXT-01
PAYMENT-01
PAYMENT-02
ERP-01
PERF-01
RECOVERY-01
```

### واجهة عضو QA

```text
/test-evidence
```

تتاح فقط لـ:

```text
is_test_account=true
أو super_admin
```

ولا يحتاج عضو QA إلى أي صلاحية أدمن لتسجيل نتيجة مهمته.

### مركز الأدمن

```text
/admin/test-control
```

يعرض:

```text
عداد النجاح والفشل والحجب والاختبارات غير المكتملة
آخر حالة لكل Test Case
الأعطال والحالات المحجوبة
رابط الدليل HTTPS عند وجوده
نموذج تسجيل نتيجة من الأدمن أيضاً
```

### API

```text
GET /api/qa/test-runs
POST /api/qa/test-runs
```

القيود:

```text
QA account يرى سجلاته فقط
super_admin يرى كل السجلات
Test Case يجب أن يكون في الكتالوج الرسمي
failed/blocked يتطلب failure summary
رابط الدليل يجب أن يكون HTTPS
لا تسجل كلمات مرور أو URLs لقاعدة البيانات في الدليل
```

## الربط مع المسارات القادمة

| المسار | Test Case |
|---|---|
| Accessibility/Axe | `A11Y-01` |
| Customer Text Center | `TEXT-01` |
| Payment success/failure | `PAYMENT-01` |
| Webhook/Replay/Duplicate | `PAYMENT-02` |
| ERP order/invoice/inventory | `ERP-01` |
| Homepage/load evidence | `PERF-01` |
| Recovery/R2 evidence | `RECOVERY-01` |

## ما لم يحدث فعلياً

```text
لم تطبق migration 0088 على قاعدة حية.
لم تسجل نتائج اختبار حقيقية.
لم تنشأ حسابات QA خارج المصدر.
لم يتم نشر أي صفحة أو API.
```

## التحقق

```text
release:verify:source                  ✅
Client/server boundary                  ✅ 197 entries
Unit tests                              ✅ 77 files / 214 tests
Migration journal                       ✅ 89 SQL / 89 journal entries
Drizzle schema check                    ✅
Security verification                   ✅
npm audit --audit-level=high           ✅ 0 vulnerabilities
git diff --check                        ✅
```

هذه الحزمة هي أساس سجل الأدلة والأعطال. لا تحل تلقائياً مشاكل Accessibility أو Payment أو ERP؛ تلك ستدخل تدريجياً في الكتالوج وStaging evidence عند تطوير كل مسار.
