# حسابات QA متعددة للأدوار

`npm run test:fixtures` ينشئ ستة حسابات اختبار Local/Staging فقط:

```text
2 أدمن تجريبيين
2 تاجرين تجريبيين، لكل منهما متجر مستقل
2 عملاء تجريبيين
```

ويجهز لكل متجر QA وحدة بيع، تصنيفاً، منتجاً، متغير مخزون، دفع COD وشحناً.

## ضوابط الأمان

- محظور عند `production` أو `APP_ENV=production` أو Vercel Production.
- يتطلب `TEST_FIXTURES_CONFIRM=true`.
- كل الحسابات تكتب بـ `is_test_account=true`.
- حتى حسابات QA ذات دور `super_admin` تمنع من مركز التحكم الحساس.
- كلمات المرور لا تطبع في الإخراج.
- الحسابات الموجودة لا تعاد كلمات مرورها إلا عند `TEST_FIXTURES_RESET_PASSWORDS=true` صراحة.

## المتغيرات المطلوبة

```bash
TEST_FIXTURES_CONFIRM=true

TEST_ADMIN_EMAIL=qa-admin-1@local.test
TEST_ADMIN_NAME="QA Admin 1"
TEST_ADMIN_PASSWORD="ضع-كلمة-مرور-قوية-16-حرفا-على-الأقل"
TEST_ADMIN_2_EMAIL=qa-admin-2@local.test
TEST_ADMIN_2_NAME="QA Admin 2"
TEST_ADMIN_2_PASSWORD="ضع-كلمة-مرور-مختلفة-16-حرفا-على-الأقل"

TEST_MERCHANT_EMAIL=qa-merchant-1@local.test
TEST_MERCHANT_NAME="QA Merchant 1"
TEST_MERCHANT_PASSWORD="ضع-كلمة-مرور-مختلفة-16-حرفا-على-الأقل"
TEST_MERCHANT_2_EMAIL=qa-merchant-2@local.test
TEST_MERCHANT_2_NAME="QA Merchant 2"
TEST_MERCHANT_2_PASSWORD="ضع-كلمة-مرور-مختلفة-16-حرفا-على-الأقل"

TEST_CUSTOMER_EMAIL=qa-customer-1@local.test
TEST_CUSTOMER_NAME="QA Customer 1"
TEST_CUSTOMER_PASSWORD="ضع-كلمة-مرور-مختلفة-16-حرفا-على-الأقل"
TEST_CUSTOMER_2_EMAIL=qa-customer-2@local.test
TEST_CUSTOMER_2_NAME="QA Customer 2"
TEST_CUSTOMER_2_PASSWORD="ضع-كلمة-مرور-مختلفة-16-حرفا-على-الأقل"

TEST_FIXTURES_STORE_SLUG=qa-local-store
```

ثم:

```bash
npm run test:fixtures
```

## إعادة ضبط كلمات مرور QA الموجودة

```bash
TEST_FIXTURES_RESET_PASSWORDS=true npm run test:fixtures
```

لا تشغل fixtures أو reset passwords على Production.
