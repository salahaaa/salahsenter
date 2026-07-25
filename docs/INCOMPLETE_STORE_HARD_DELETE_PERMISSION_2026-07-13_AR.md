# صلاحية حذف المتاجر غير المكتملة

## الهدف

تمت إضافة قدرة أدمن ضيقة لحذف متجر فُتح ثم تُرك غير مكتمل، من دون استخدام الحذف النهائي للمتاجر التشغيلية.

## الصلاحية

```text
stores.incomplete.delete
```

Migration:

```text
drizzle/0062_incomplete_store_deletion_permission.sql
```

وتدخل في سياسة التشغيل:

```text
stores.incomplete.delete
→ stores.incomplete.delete + stores.delete + stores.manage
```

هذا يحافظ على الأدوار التاريخية مؤقتاً، بينما يمكن للأدمن منح الصلاحية الجديدة وحدها لموظف مختص بمراجعة المتاجر غير المكتملة.

## API

```text
DELETE /api/admin/stores/{id}/incomplete
```

يتطلب:

```json
{
  "reason": "سبب الحذف",
  "confirmationStoreNumber": "رقم المتجر الدقيق"
}
```

## قواعد الأمان قبل الحذف النهائي

لا يقبل الحذف إلا عندما:

```text
status = pending
ولا توجد Orders
ولا Payment Receipts
ولا Merchant Financial Account
ولا Ledger Entries
ولا Payout Requests
ولا Integration Events
ولا orderCount أو salesTotal مسجلان
```

إذا وجدت أي بيانات تشغيلية، ترفض API الحذف النهائي برسالة واضحة وتلزم الأدمن باستخدام مسار الإغلاق/التجميد العادي للحفاظ على الأثر المالي والتشغيلي.

## السلوك

- حذف حقيقي للمتجر غير المكتمل وإعداداته ومسودات منتجاته المرتبطة عبر علاقات قاعدة البيانات.
- لا يحذف حساب التاجر نفسه، لأن الحساب قد يكون مرتبطاً بمتجر آخر أو سجل طلب لاحق.
- يسجل Audit Log يحتوي بيانات المتجر، السبب، وإثبات فحص عدم وجود عمليات.
- يحدث كاش المتاجر والصفحة الرئيسية.
- واجهة الأدمن تعرض زر:

```text
حذف نهائي لغير المكتمل
```

فقط عندما تكون حالة المتجر `pending` وعدد طلباته صفر.

- تظهر نافذة تأكيد موحدة، تطلب كتابة رقم المتجر وتسجيل سبب الحذف.

## التحقق

```text
npm run lint                                      PASS
NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck   PASS
npm test                                          PASS — 40 ملفات / 110 اختبارات
npm run migrations:verify                         PASS — 63 SQL / 63 journal entries
npx drizzle-kit check                             PASS
npm run security:verify                           PASS
git diff --check                                  PASS
```
