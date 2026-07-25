-- Fine-grained store employee permissions.
-- These keep platform/admin RBAC separated from merchant/store RBAC while allowing
-- merchants to grant specific access per department (marketing, finance, returns, etc.).

INSERT INTO "permissions" ("name", "code", "group") VALUES
  ('إدارة أصناف ومتغيرات المنتجات', 'product_taxonomy.manage', 'merchant.catalog'),
  ('إدارة عروض المتجر', 'store_offers.manage', 'merchant.marketing'),
  ('إدارة كوبونات المتجر', 'store_coupons.manage', 'merchant.marketing'),
  ('إدارة طلبات إعلانات المتجر', 'store_ads.manage', 'merchant.marketing'),
  ('عرض مالية المتجر والتسويات', 'store_finance.view', 'merchant.finance'),
  ('مراجعة إثباتات الدفع', 'store_payment_receipts.manage', 'merchant.finance'),
  ('إدارة المرتجعات والاسترداد', 'store_returns.manage', 'merchant.orders'),
  ('إدارة شحن المتجر', 'store_shipping.manage', 'merchant.operations'),
  ('إدارة وسائل دفع المتجر', 'store_payments.manage', 'merchant.operations')
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "group" = EXCLUDED."group";

-- Existing merchant-owner role should receive the new fine-grained capabilities.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."code" IN (
  'product_taxonomy.manage',
  'store_offers.manage',
  'store_coupons.manage',
  'store_ads.manage',
  'store_finance.view',
  'store_payment_receipts.manage',
  'store_returns.manage',
  'store_shipping.manage',
  'store_payments.manage'
)
WHERE r."code" = 'merchant'
ON CONFLICT DO NOTHING;
