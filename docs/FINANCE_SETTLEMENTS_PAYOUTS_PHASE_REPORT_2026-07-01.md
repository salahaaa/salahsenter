# تقرير مرحلة المالية والتسويات والمدفوعات المحلية

التاريخ: 2026-07-01

## المنجز

### 1. مدفوعات محلية مناسبة للسوق اليمني والخليجي

تم دعم أنواع الدفع:

- manual
- cod
- bank_transfer
- wallet
- remittance
- stripe

مع تعليمات دفع وإثباتات دفع.

### 2. إثباتات الدفع

تم بناء:

- payment_receipts
- /api/payments/proof
- /api/merchant/payment-receipts/[id]
- نموذج رفع إثبات دفع للعميل
- قبول/رفض إثبات الدفع من التاجر

### 3. السلة السيرفرية

تم بناء:

- shopping_carts
- shopping_cart_items
- /cart
- /api/cart
- /api/cart/items/[id]

وتزامنها مع LocalStorage.

### 4. الإرجاع والاسترداد

تم بناء:

- return_requests
- return_request_items
- /api/orders/[id]/returns
- /api/merchant/returns/[id]
- نماذج إرجاع للعميل
- قبول/رفض/استلام/استرداد من التاجر

### 5. المالية والتسويات

تم بناء:

- merchant_financial_accounts
- merchant_ledger_entries
- merchant_payout_requests
- /merchant/finance
- /admin/finance
- /api/merchant/finance
- /api/admin/finance
- /api/admin/finance/payouts/[id]

### 6. التسوية التلقائية

عند إغلاق طلب مدفوع:

- يتم حساب إجمالي الطلب
- حساب عمولة المنصة حسب commission_rules
- تسجيل gross / commission / net في ledger
- إضافة صافي المستحق إلى رصيد التاجر

وعند refund:

- يتم تسجيل حركة refund في ledger
- تخفيض رصيد التاجر

## Migrations المطبقة

تم تطبيق:

- 0025_cart_returns_production.sql
- 0026_payment_receipts.sql
- 0027_finance_settlements.sql

وتم التحقق من وجود الجداول الجديدة في قاعدة البيانات.

## الفحوصات

تم تشغيل:

- npm run lint
- npm run typecheck
- npm test
- npm run build

النتيجة: PASS

## ملاحظات

- لم يتم تشغيل db:seed.
- تم حذف node_modules و .next بعد الفحص للحفاظ على حجم المشروع.
- حجم المشروع بعد التنظيف حوالي 11MB بدون .git.
