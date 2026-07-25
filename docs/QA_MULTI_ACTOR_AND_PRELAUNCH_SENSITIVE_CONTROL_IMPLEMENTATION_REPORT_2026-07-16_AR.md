# تقرير تنفيذ: QA متعدد الأدوار ومركز التحكم الحساس

**التاريخ:** 2026-07-16  
**الحالة:** مكتمل محلياً ومتحقق منه آلياً — لم يطبق على Staging أو Production

## ما تم تنفيذه

### حسابات QA

- تم تطوير `test:fixtures` ليطلب وينشئ:
  ```text
  2 أدمن QA
  2 تاجر QA
  2 عميل QA
  ```
- لكل تاجر متجر QA مستقل ووحدة بيع وتصنيف ومنتج ومخزون وCOD وشحن.
- تكتب الحسابات التجريبية بعلامة `is_test_account=true`.
- حتى أدمن QA لا يستطيع رؤية مركز التحكم الحساس في لوحة الأدمن أو استخدام API الخاص به.
- لا يعمل السكربت على Production ويحتاج `TEST_FIXTURES_CONFIRM=true`.

### مركز التحكم الحساس

- أضيف المسار `/admin/sensitive-control`.
- لا يسمح بالدخول إلا لمسؤول `super_admin` غير تجريبي.
- يهيئ المالك كلمة مرور مستقلة عند أول استخدام؛ تحفظ hash فقط.
- unlock session مدتها 10 دقائق في HttpOnly cookie.
- يوفر:
  ```text
  قفل المنصة العامة وإعادة فتحها
  تعليق أو إغلاق متجر
  ملخص بيانات ما قبل الإطلاق
  إدارة حسابي المالك
  تصفية بيانات ما قبل الإطلاق
  ```

### زر تصفية ما قبل الإطلاق

- يتطلب unlock حساساً.
- يتطلب كلمة المرور الصحيحة ثلاث مرات مستقلة.
- يقفل المنصة العامة قبل التنفيذ.
- ينفذ التنظيف في transaction واحدة.
- يحتفظ بإعدادات وأدوار ومراجع المشروع ويزيل بيانات التشغيل اليدوية.
- ينشئ bootstrap ticket HttpOnly لمرة واحدة صالحاً 15 دقيقة.

### مالكا المنصة

- صفحة `/bootstrap-owner` تنشئ مالكين مستقلين بعد التصفية.
- كل مالك يحصل على `super_admin` وبريد/كلمة مرور مستقلين.
- يمكن استخدام المالك الثاني لتعليق الأول وإلغاء جلساته واستبداله ببريد جديد.

## الملفات الرئيسية

```text
lib/sensitive-control.ts
lib/prelaunch-reset.ts
app/admin/sensitive-control/page.tsx
components/admin/sensitive-control-panel.tsx
app/api/admin/sensitive-control/route.ts
app/api/admin/sensitive-control/prelaunch-purge/route.ts
app/api/admin/sensitive-control/owners/[slot]/route.ts
app/api/bootstrap/owners/route.ts
app/bootstrap-owner/page.tsx
components/auth/bootstrap-owner-form.tsx
scripts/create-test-fixtures.ts
docs/SAFE_TEST_FIXTURES.md
```

## التحقق المنفذ

| الفحص | النتيجة |
|---|---|
| `npm run lint` | ناجح |
| `npm run typecheck` | ناجح |
| `npm test` | ناجح: 62 ملفاً / 169 اختباراً |
| `npm run migrations:verify` | ناجح: 85 SQL / 85 journal entries |
| `npx drizzle-kit check` | ناجح |
| `npm run security:verify` | ناجح: فحص الأسرار وحراس مسارات الأدمن و`npm audit` بلا ثغرات عالية |
| `git diff --check` | ناجح |

## حدود صريحة

- لم تنفذ تصفية البيانات فعلياً على قاعدة PostgreSQL حقيقية.
- لا يجوز اختبارها إلا على Local/Staging مخصصة بعد backup.
- لم ينشأ أي حساب QA أو مالك فعلي لأن ذلك يحتاج DATABASE_URL حقيقية وقرار منك.
- قبل Production يلزم تشغيل المجموعة الكاملة: lint/typecheck/tests/security/migration ثم اختبار purge/bootstrap على Staging.
