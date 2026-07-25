# Safe Test Experience Bootstrap

## الهدف

إنشاء أقل قدر من بيانات اختبار حقيقية في Local أو Staging حتى يمكن تجربة المنصة بلا روابط demo مكسورة وبلا الحاجة إلى فريق QA كامل.

ينشئ الأمر:

```text
حساب تاجر اختبار فردي is_test_account=true
Merchant profile
جناح اختبار فعلي active
متجر اختبار فعلي active ومربوط بالجناح
وحدة وتصنيف اختبار
منتج مسودة
Variant مسودة
COD وشحن اختبار
```

المنتج يلتزم بالسياسة:

```text
status=draft
price=0
stock=0
```

لذلك لا يصبح قابلاً للشراء تلقائياً. على التاجر ضبط السعر والمخزون والنشر من لوحة التاجر عند تجربة دورة العمل.

## ممنوع في Production

السكربت يرفض تلقائياً:

```text
APP_ENV=production
NEXT_PUBLIC_APP_ENV=production
VERCEL_ENV=production
NODE_ENV=production
```

ولا ينشئ Administrator افتراضياً ولا يطبع كلمة المرور أو البريد في الناتج.

## المتطلبات

نفذ أولاً في Local أو Staging فقط:

```bash
npm run db:migrate
npm run db:seed
```

ثم ضع القيم التالية في `.env` المحلي أو shell المحلي، من دون commit:

```env
TEST_EXPERIENCE_CONFIRM=CREATE_TEST_EXPERIENCE
TEST_EXPERIENCE_MERCHANT_EMAIL=<your-test-merchant-email>
TEST_EXPERIENCE_MERCHANT_NAME=<test-merchant-name>
TEST_EXPERIENCE_MERCHANT_PASSWORD=<unique-strong-password-at-least-16-characters>
TEST_EXPERIENCE_STORE_SLUG=test-experience-store
TEST_EXPERIENCE_WING_SLUG=test-experience-wing
```

ثم شغل:

```bash
npm run test:experience:bootstrap
```

## النتيجة

يعرض الأمر فقط metadata آمنة مثل:

```text
merchantCreated
wing slug
store slug
product status=draft
price=0
stock=0
```

كلمة المرور لا تظهر. إذا كان حساب التاجر جديداً، سيطلب منه التطبيق تغيير كلمة المرور عند أول دخول.

## إعادة التشغيل

السكربت idempotent للبيانات التي أنشأها هو نفسه:

```text
نفس merchant test account
نفس store slug
نفس wing slug
نفس draft product
```

لكنه يرفض تعديل متجر موجود لا يحمل علامة:

```text
TEST EXPERIENCE ONLY
```

لذلك إذا ظهر تعارض، اختر `TEST_EXPERIENCE_STORE_SLUG` جديداً ولا تعدل متجر غير اختبار.

## بعد الإنشاء

1. سجل دخول التاجر الاختباري.
2. غيّر كلمة المرور عند الطلب.
3. افتح لوحة التاجر.
4. أكمل السعر والمخزون للمنتج المسودة.
5. انشر المنتج فقط عندما تريد تجربة رحلة العميل.
6. سجل عميلاً منفصلاً من `/register` لتجربة التسوق.

## ليس بديلاً عن فريق QA

هذا المسار مناسب لتجربة أولية على جهاز واحد. للاختبارات المتوازية متعددة المتاجر استخدم لاحقاً:

```text
Provision isolated Staging test team
```
