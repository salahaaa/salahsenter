-- Employee Management & Granular Permission System.
-- This migration is additive: legacy roles/role_permissions keep working while
-- direct grant/deny overrides are introduced for every employee and store scope.

ALTER TYPE "user_status" ADD VALUE IF NOT EXISTS 'inactive';

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" varchar(64);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text;
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique" ON "users" ("username") WHERE "username" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "user_permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "permission_id" uuid NOT NULL,
  "store_id" uuid,
  "effect" varchar(8) NOT NULL,
  "reason" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_permissions_effect_check" CHECK ("effect" IN ('grant', 'deny'))
);
DO $$ BEGIN ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_fk" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "user_permissions_system_unique" ON "user_permissions" ("user_id", "permission_id") WHERE "store_id" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "user_permissions_store_unique" ON "user_permissions" ("user_id", "permission_id", "store_id") WHERE "store_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "user_permissions_user_scope_idx" ON "user_permissions" ("user_id", "store_id");
CREATE INDEX IF NOT EXISTS "user_permissions_permission_idx" ON "user_permissions" ("permission_id");

INSERT INTO "permissions" ("code", "name", "group", "description") VALUES
  ('admin.access', 'دخول لوحة الأدمن', 'لوحة الإدارة', 'فتح لوحة الإدارة المركزية'),
  ('ads.view', 'عرض الإعلانات', 'إدارة الإعلانات', 'عرض الحملات والإعلانات'),
  ('ads.create', 'إنشاء إعلان', 'إدارة الإعلانات', 'إنشاء حملة أو إعلان'),
  ('ads.approve', 'اعتماد إعلان', 'إدارة الإعلانات', 'اعتماد إعلان مقدم للمراجعة'),
  ('ads.reject', 'رفض إعلان', 'إدارة الإعلانات', 'رفض إعلان مقدم للمراجعة'),
  ('ads.edit', 'تعديل إعلان', 'إدارة الإعلانات', 'تعديل بيانات الإعلان'),
  ('ads.delete', 'حذف إعلان', 'إدارة الإعلانات', 'حذف الإعلان'),
  ('ads.expiry.change', 'تغيير تاريخ الانتهاء', 'إدارة الإعلانات', 'تمديد أو تقصير مدة الإعلان'),
  ('ads.feature', 'تمييز إعلان', 'إدارة الإعلانات', 'إبراز الإعلان في مواضع العرض'),
  ('ads.suspend', 'إيقاف إعلان', 'إدارة الإعلانات', 'تعليق الإعلان مؤقتاً'),
  ('ads.restore', 'استعادة إعلان', 'إدارة الإعلانات', 'إعادة إعلان موقوف أو محذوف منطقياً'),
  ('platform_products.view', 'عرض المنتجات', 'إدارة المنتجات', 'عرض كتالوج المنصة'),
  ('platform_products.create', 'إنشاء منتج', 'إدارة المنتجات', 'إنشاء منتج نيابة عن متجر أو المنصة'),
  ('platform_products.edit', 'تعديل منتج', 'إدارة المنتجات', 'تعديل بيانات المنتج'),
  ('platform_products.delete', 'حذف منتج', 'إدارة المنتجات', 'أرشفة أو حذف المنتج'),
  ('platform_products.bulk_edit', 'تعديل جماعي', 'إدارة المنتجات', 'تحديث منتجات متعددة دفعة واحدة'),
  ('platform_products.prices.change', 'تغيير الأسعار', 'إدارة المنتجات', 'تغيير أسعار المنتجات'),
  ('platform_products.inventory.manage', 'إدارة المخزون', 'إدارة المنتجات', 'تعديل مخزون المنتجات من لوحة المنصة'),
  ('platform_products.restore', 'استعادة منتج محذوف', 'إدارة المنتجات', 'استعادة منتج مؤرشف'),
  ('stores.view', 'عرض المتاجر', 'إدارة المتاجر', 'عرض بيانات المتاجر'),
  ('stores.approve', 'اعتماد متجر', 'إدارة المتاجر', 'اعتماد طلب متجر'),
  ('stores.suspend', 'إيقاف متجر', 'إدارة المتاجر', 'تعليق المتجر'),
  ('stores.activate', 'تفعيل متجر', 'إدارة المتاجر', 'إعادة تفعيل المتجر'),
  ('stores.edit', 'تعديل متجر', 'إدارة المتاجر', 'تعديل بيانات المتجر'),
  ('stores.delete', 'حذف متجر', 'إدارة المتاجر', 'إغلاق أو حذف متجر'),
  ('orders.view', 'عرض الطلبات', 'إدارة الطلبات', 'عرض طلبات المنصة'),
  ('orders.edit', 'تعديل الطلبات', 'إدارة الطلبات', 'تعديل بيانات الطلب'),
  ('orders.status.change', 'تغيير حالة الطلب', 'إدارة الطلبات', 'تغيير حالة سير الطلب'),
  ('orders.cancel', 'إلغاء الطلبات', 'إدارة الطلبات', 'إلغاء الطلب'),
  ('orders.refund', 'استرداد الطلبات', 'إدارة الطلبات', 'تنفيذ الاسترداد'),
  ('orders.close', 'إغلاق الطلبات', 'إدارة الطلبات', 'إغلاق الطلب بعد اكتماله'),
  ('customers.view', 'عرض العملاء', 'إدارة العملاء', 'عرض ملفات العملاء'),
  ('customers.edit', 'تعديل العملاء', 'إدارة العملاء', 'تعديل بيانات العميل'),
  ('customers.suspend', 'إيقاف العملاء', 'إدارة العملاء', 'تعليق حساب العميل'),
  ('customers.delete', 'حذف العملاء', 'إدارة العملاء', 'حذف أو إخفاء العميل'),
  ('employees.view', 'عرض الموظفين', 'إدارة الموظفين', 'عرض دليل موظفي المنصة'),
  ('employees.create', 'إنشاء موظف', 'إدارة الموظفين', 'إنشاء حساب موظف جديد'),
  ('employees.edit', 'تعديل موظف', 'إدارة الموظفين', 'تعديل بيانات الموظف وحالة حسابه'),
  ('employees.delete', 'إلغاء تفعيل موظف', 'إدارة الموظفين', 'إلغاء تفعيل الحساب مع الاحتفاظ بالسجل'),
  ('employees.permissions.manage', 'إدارة الصلاحيات', 'إدارة الموظفين', 'منح وسحب وتجاوز صلاحيات الموظفين'),
  ('finance.reports.view', 'عرض التقارير المالية', 'إدارة المالية', 'عرض التقارير المالية'),
  ('finance.reports.export', 'تصدير التقارير', 'إدارة المالية', 'تصدير التقارير المالية'),
  ('finance.settlements.manage', 'إدارة التسويات', 'إدارة المالية', 'إدارة التسويات'),
  ('finance.commissions.manage', 'إدارة العمولات', 'إدارة المالية', 'تعديل العمولات'),
  ('finance.withdrawals.manage', 'إدارة السحوبات', 'إدارة المالية', 'مراجعة السحوبات والتحويلات'),
  ('providers.add', 'إضافة مزود', 'إدارة البنوك والمحافظ', 'إضافة بنك أو محفظة'),
  ('providers.edit', 'تعديل مزود', 'إدارة البنوك والمحافظ', 'تعديل المزود المالي'),
  ('providers.suspend', 'إيقاف مزود', 'إدارة البنوك والمحافظ', 'إيقاف مزود مالي'),
  ('providers.delete', 'حذف مزود', 'إدارة البنوك والمحافظ', 'حذف مزود مالي'),
  ('system.settings.view', 'عرض الإعدادات', 'إدارة النظام', 'عرض إعدادات المنصة'),
  ('system.settings.edit', 'تعديل الإعدادات', 'إدارة النظام', 'تعديل إعدادات المنصة'),
  ('system.integrations.manage', 'إدارة التكاملات', 'إدارة النظام', 'إدارة العملاء والموصلات'),
  ('system.erp.manage', 'إدارة ERP', 'إدارة النظام', 'اعتماد وفتح ERP والمتزامنين'),
  ('system.security_center.manage', 'إدارة مركز الأمان', 'إدارة النظام', 'إدارة الحوادث والحماية'),
  ('merchant.access', 'دخول لوحة التاجر', 'لوحة التاجر', 'فتح لوحة المتجر'),
  ('store.products.view', 'عرض المنتجات', 'إدارة المنتجات', 'عرض منتجات المتجر'),
  ('store.products.create', 'إنشاء منتج', 'إدارة المنتجات', 'إضافة منتج'),
  ('store.products.edit', 'تعديل منتج', 'إدارة المنتجات', 'تعديل المنتج'),
  ('store.products.delete', 'حذف منتج', 'إدارة المنتجات', 'أرشفة أو حذف منتج'),
  ('store.products.bulk_edit', 'تعديل جماعي', 'إدارة المنتجات', 'تعديل منتجات متعددة'),
  ('store.products.prices.change', 'تغيير الأسعار', 'إدارة المنتجات', 'تعديل الأسعار'),
  ('store.products.restore', 'استعادة المنتجات', 'إدارة المنتجات', 'استعادة منتج مؤرشف'),
  ('store.inventory.view', 'عرض المخزون', 'إدارة المخزون', 'عرض مستويات المخزون'),
  ('store.inventory.manage', 'إدارة المخزون', 'إدارة المخزون', 'تعديل الكميات والحجوزات'),
  ('store.inventory.stock_count', 'إدارة الجرد', 'إدارة المخزون', 'تنفيذ جرد دوري'),
  ('store.orders.view', 'عرض الطلبات', 'إدارة الطلبات', 'عرض طلبات المتجر'),
  ('store.orders.edit', 'تعديل الطلبات', 'إدارة الطلبات', 'تعديل بيانات الطلب'),
  ('store.orders.status.change', 'تغيير حالة الطلب', 'إدارة الطلبات', 'تغيير حالة الطلب'),
  ('store.orders.cancel', 'إلغاء الطلبات', 'إدارة الطلبات', 'إلغاء الطلب'),
  ('store.orders.refund', 'استرداد الطلبات', 'إدارة الطلبات', 'إرجاع المبلغ'),
  ('store.orders.close', 'إغلاق الطلبات', 'إدارة الطلبات', 'إغلاق الطلب'),
  ('store.customers.view', 'عرض العملاء', 'إدارة العملاء', 'عرض عملاء المتجر'),
  ('store.customers.edit', 'تعديل العملاء', 'إدارة العملاء', 'تعديل بيانات العميل في نطاق المتجر'),
  ('store.employees.view', 'عرض الموظفين', 'إدارة الموظفين', 'عرض موظفي المتجر'),
  ('store.employees.create', 'إنشاء موظف', 'إدارة الموظفين', 'إنشاء حساب موظف متجر'),
  ('store.employees.edit', 'تعديل موظف', 'إدارة الموظفين', 'تعديل بيانات الموظف وحالته'),
  ('store.employees.delete', 'إلغاء تفعيل موظف', 'إدارة الموظفين', 'إلغاء تفعيل موظف المتجر'),
  ('store.employees.permissions.manage', 'إدارة الصلاحيات', 'إدارة الموظفين', 'إدارة أدوار وتجاوزات موظفي المتجر'),
  ('store.branches.view', 'عرض الفروع', 'إدارة الفروع', 'عرض الفروع'),
  ('store.branches.manage', 'إدارة الفروع', 'إدارة الفروع', 'إضافة وتعديل الفروع'),
  ('store.finance.view', 'عرض المالية', 'إدارة المالية', 'عرض مالية المتجر'),
  ('store.finance.reports.export', 'تصدير التقارير', 'إدارة المالية', 'تصدير تقارير المتجر'),
  ('store.ads.view', 'عرض إعلانات المتجر', 'إدارة الإعلانات', 'عرض حملات المتجر'),
  ('store.ads.manage', 'إدارة إعلانات المتجر', 'إدارة الإعلانات', 'إنشاء وتعديل حملات المتجر'),
  ('store.shipping.manage', 'إدارة الشحن', 'إدارة التشغيل', 'إدارة وسائل الشحن'),
  ('store.payments.manage', 'إدارة الدفع', 'إدارة التشغيل', 'إدارة وسائل الدفع')
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name", "group" = EXCLUDED."group", "description" = EXCLUDED."description";
