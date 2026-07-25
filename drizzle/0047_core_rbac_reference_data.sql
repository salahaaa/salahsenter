-- Production RBAC reference bootstrap. This migration replaces production seed execution.

INSERT INTO "roles" ("code", "name", "scope", "is_system", "description") VALUES
  ('super_admin', 'Super Admin', 'system', true, 'صلاحية كاملة على المنصة'),
  ('merchant', 'Merchant', 'store', true, 'إدارة متجر واحد أو أكثر'),
  ('store_employee', 'Store Employee', 'store', true, 'موظف متجر بصلاحيات محددة'),
  ('customer', 'Customer', 'system', true, 'عميل المنصة')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "permissions" ("code", "name", "group") VALUES
  ('admin.access', 'دخول لوحة الأدمن', 'admin'),
  ('admin.settings.manage', 'إدارة إعدادات النظام', 'admin'),
  ('master.manage', 'إدارة النظام المركزي', 'admin'),
  ('theme.manage', 'إدارة الهوية البصرية', 'design'),
  ('home.manage', 'إدارة الصفحة الرئيسية', 'content'),
  ('cms.manage', 'إدارة المحتوى CMS', 'content'),
  ('contracts.manage', 'إدارة العقود', 'operations'),
  ('branches.manage', 'إدارة الفروع', 'stores'),
  ('commissions.manage', 'إدارة العمولات', 'finance'),
  ('taxes.manage', 'إدارة الضرائب', 'finance'),
  ('wings.manage', 'إدارة الأجنحة', 'catalog'),
  ('stores.manage', 'إدارة المتاجر', 'stores'),
  ('merchant_applications.manage', 'إدارة طلبات التجار', 'stores'),
  ('geography.manage', 'إدارة المناطق', 'settings'),
  ('announcements.manage', 'إدارة الإعلانات', 'content'),
  ('ads.manage', 'إدارة الحملات الإعلانية', 'advertising'),
  ('offers.manage', 'إدارة نافذة العروض', 'marketing'),
  ('news.manage', 'إدارة الأخبار', 'content'),
  ('notifications.manage', 'إدارة الإشعارات والقوالب', 'notifications'),
  ('roles.manage', 'إدارة الصلاحيات', 'security'),
  ('security.manage', 'إدارة أمن المنصة', 'security'),
  ('payments.manage', 'إدارة وسائل الدفع', 'operations'),
  ('shipping.manage', 'إدارة وسائل الشحن', 'operations'),
  ('backups.manage', 'إدارة النسخ الاحتياطي', 'operations'),
  ('reports.view', 'عرض التقارير', 'reports'),
  ('users.manage', 'إدارة المستخدمين', 'security'),
  ('subscriptions.manage', 'إدارة الاشتراكات', 'billing'),
  ('tenants.manage', 'إدارة المستأجرين SaaS', 'saas'),
  ('default_media.manage', 'إدارة الصور الافتراضية', 'design'),
  ('merchant.access', 'دخول لوحة التاجر', 'merchant'),
  ('products.manage', 'إدارة المنتجات', 'merchant'),
  ('inventory.manage', 'إدارة المخزون', 'merchant'),
  ('orders.manage', 'إدارة الطلبات', 'merchant'),
  ('store_media.manage', 'إدارة وسائط المتجر', 'merchant'),
  ('store_settings.manage', 'إدارة إعدادات المتجر', 'merchant'),
  ('product_taxonomy.manage', 'إدارة أصناف ومتغيرات المنتجات', 'merchant.catalog'),
  ('store_offers.manage', 'إدارة عروض المتجر', 'merchant.marketing'),
  ('store_coupons.manage', 'إدارة كوبونات المتجر', 'merchant.marketing'),
  ('store_ads.manage', 'إدارة طلبات إعلانات المتجر', 'merchant.marketing'),
  ('store_finance.view', 'عرض مالية المتجر والتسويات', 'merchant.finance'),
  ('store_payment_receipts.manage', 'مراجعة إثباتات الدفع', 'merchant.finance'),
  ('store_returns.manage', 'إدارة المرتجعات والاسترداد', 'merchant.orders'),
  ('store_shipping.manage', 'إدارة شحن المتجر', 'merchant.operations'),
  ('store_payments.manage', 'إدارة وسائل دفع المتجر', 'merchant.operations')
ON CONFLICT ("code") DO NOTHING;

-- Super administrators receive all permissions; application code also treats this role as privileged.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r JOIN "permissions" p ON p."code" IN ('merchant.access', 'products.manage', 'product_taxonomy.manage', 'inventory.manage', 'orders.manage', 'store_payment_receipts.manage', 'store_returns.manage', 'store_offers.manage', 'store_coupons.manage', 'store_ads.manage', 'store_finance.view', 'store_media.manage', 'store_shipping.manage', 'store_payments.manage', 'store_settings.manage', 'announcements.manage', 'news.manage')
WHERE r."code" = 'merchant'
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r JOIN "permissions" p ON p."code" IN ('merchant.access', 'products.manage', 'inventory.manage', 'orders.manage')
WHERE r."code" = 'store_employee'
ON CONFLICT DO NOTHING;
