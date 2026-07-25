# FAST CONTINUATION STATE — 2026-07-09

## آخر تعديل
Store Operation Status + Manual Visibility + All Products button:
- حقول stores: operation_status, operation_note, business_hours, operation_status_updated_at.
- حالات: OPEN/CLOSED/VACATION/PAUSED.
- API: `PATCH /api/merchant/store-operation`.
- UI داخل `/merchant/operations-settings`.
- واجهة المتجر تعرض الحالة، والطلبات/checkout options تمنع الطلب إذا المتجر ليس OPEN.
- Home Visibility manualRefs/excludedRefs للمتاجر والمنتجات: إدخال رابط/ID/كود/رقم لإظهار أو إخفاء من الرئيسية.
- زر "كل المنتجات" في شريط مجموعات المتجر المتحرك.
- Migration: `drizzle/0044_store_operation_status.sql`.
- تقرير: `docs/STORE_OPERATION_STATUS_AND_MANUAL_VISIBILITY_2026-07-09.md`.

## فحوص آخر تعديل
```txt
NODE_OPTIONS=--max_old_space_size=4096 npm run typecheck -> PASS
npm run lint -> PASS
npm test -> PASS (9 files, 23 tests)
npm run build -> SIGKILL في Arena بسبب الذاكرة
```

## ملاحظة مهمة
يوجد أيضاً Financial Providers Registry منفذ مع migration `0045` وتقرير `docs/FINANCIAL_PROVIDERS_REGISTRY_2026-07-09.md`.

## Migrations المطلوبة بعد Deploy
```bash
psql "$DATABASE_URL" -f drizzle/0034_admin_platform_security_center.sql
psql "$DATABASE_URL" -f drizzle/0035_auto_scaling_intelligence.sql
psql "$DATABASE_URL" -f drizzle/0036_accounting_integration_architecture.sql
psql "$DATABASE_URL" -f drizzle/0037_local_sync_agent_runtime.sql
psql "$DATABASE_URL" -f drizzle/0038_enterprise_erp_integration_infrastructure.sql
psql "$DATABASE_URL" -f drizzle/0039_erp_financial_inventory_cycle.sql
psql "$DATABASE_URL" -f drizzle/0040_sync_reliability_reconciliation.sql
psql "$DATABASE_URL" -f drizzle/0041_store_commerce_type.sql
psql "$DATABASE_URL" -f drizzle/0042_showcase_product_sale_status.sql
psql "$DATABASE_URL" -f drizzle/0043_product_commerce_type.sql
psql "$DATABASE_URL" -f drizzle/0044_store_operation_status.sql
psql "$DATABASE_URL" -f drizzle/0045_financial_providers_registry.sql
```

## تنظيف
بعد كل فحص احذف node_modules/.next/tsconfig.tsbuildinfo. إذا احتجت فحصاً جديداً شغل npm ci.
