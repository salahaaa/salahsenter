# Safe Test Experience Bootstrap — تقرير التنفيذ

**التاريخ:** 25 يوليو 2026  
**النطاق:** تطوير مصدر فقط. لم يُشغل السكربت على أي قاعدة بيانات خارجية.

## المشكلة التي يعالجها

بعد تطبيق migrations على قاعدة اختبار فارغة، لا توجد بالضرورة متاجر أو أجنحة أو منتجات حقيقية. كانت الصفحة الرئيسية القديمة تستخدم بطاقات fallback وهمية قد تقود إلى روابط غير موجودة.

بعد إزالة الروابط الوهمية، احتاجت التجربة المحلية البسيطة إلى مسار آمن ينشئ بيانات حقيقية قابلة للتجربة، من دون seed Production أو فريق QA كامل.

## ما أضيف

```text
lib/test-experience/policy.ts
scripts/bootstrap-test-experience.ts
npm run test:experience:bootstrap
tests/test-experience-bootstrap-policy.test.ts
docs/SAFE_TEST_EXPERIENCE_BOOTSTRAP_2026-07-25_AR.md
```

## ضوابط الأمان

- لا يعمل دون:

```text
TEST_EXPERIENCE_CONFIRM=CREATE_TEST_EXPERIENCE
```

- يرفض Production عبر `APP_ENV` و`NEXT_PUBLIC_APP_ENV` و`VERCEL_ENV` و`NODE_ENV`.
- لا ينشئ Administrator افتراضياً.
- لا يطبع كلمة مرور أو بريد حساب الاختبار.
- يرفض تحويل حساب حقيقي موجود إلى حساب QA.
- يرفض تعديل متجر ليس موسوماً بـ `TEST EXPERIENCE ONLY`.
- لا يعدل أو يحذف بيانات موجودة خارج نطاق اختباراته.

## البيانات الناتجة

```text
تاجر اختبار فردي
جناح اختبار فعال
متجر اختبار فعال
تصنيف ووحدة اختبار
وسيلة COD وشحن اختبار
منتج مسودة وVariant بسعر 0 ومخزون 0
```

المنتج لا يصبح متاحاً للعميل تلقائياً:

```text
status=draft
price=0
stock=0
```

وهذا يفرض على التاجر اختبار دورة السعر والمخزون والنشر من الواجهة بدلاً من تجاوزها ببيانات بيع جاهزة.

## الاستخدام لاحقاً

بعد migrations وseed في Local/Staging فقط:

```bash
npm run test:experience:bootstrap
```

التفاصيل موجودة في:

```text
docs/SAFE_TEST_EXPERIENCE_BOOTSTRAP_2026-07-25_AR.md
```

## فشل آمن تم التحقق منه

شغّل السكربت بلا confirmation في المصدر، وكانت النتيجة:

```text
رفض التنفيذ قبل أي اتصال بقاعدة بيانات
```

## ما لم يحدث

```text
لم تُنشأ أي بيانات اختبار خارجية.
لم يُشغّل السكربت على Render أو Neon أو Vercel.
لم يتم نشر المصدر.
لم يتم إنشاء حساب أدمن.
```

## نتائج التحقق

```text
release:verify:source                  ✅
Client/server boundary                  ✅
Unit tests                              ✅ 75 files / 208 tests
Migration journal                       ✅
Drizzle schema check                    ✅
Security verification                   ✅
npm audit --audit-level=high           ✅ 0 vulnerabilities
git diff --check                        ✅
```

هذه الحزمة تجعل تجربة المشروع على قاعدة Test فارغة أسرع وأكثر صدقاً، لكنها ليست بديلاً عن Staging متعدد المستخدمين أو إطلاق Production.
