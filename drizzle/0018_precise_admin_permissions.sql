INSERT INTO "permissions" ("name", "code", "group") VALUES
  ('إدارة الصفحة الرئيسية', 'home.manage', 'content'),
  ('إدارة الفروع', 'branches.manage', 'stores'),
  ('إدارة الحملات الإعلانية', 'ads.manage', 'advertising'),
  ('إدارة نافذة العروض', 'offers.manage', 'marketing'),
  ('إدارة الإشعارات والقوالب', 'notifications.manage', 'notifications'),
  ('إدارة أمن المنصة', 'security.manage', 'security'),
  ('إدارة المستخدمين', 'users.manage', 'security'),
  ('إدارة الاشتراكات', 'subscriptions.manage', 'billing'),
  ('إدارة المستأجرين SaaS', 'tenants.manage', 'saas'),
  ('إدارة الصور الافتراضية', 'default_media.manage', 'design')
ON CONFLICT ("code") DO NOTHING;
