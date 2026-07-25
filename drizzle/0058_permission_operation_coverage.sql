-- Granular operation coverage for legacy routes being migrated from module-level RBAC.
INSERT INTO "permissions" ("code", "name", "group", "description") VALUES
  ('providers.view', 'عرض المزودين', 'إدارة البنوك والمحافظ', 'عرض البنوك والمحافظ ومزودي الدفع'),
  ('store.products.export', 'تصدير المنتجات', 'إدارة المنتجات', 'تصدير الكتالوج حسب الفلاتر'),
  ('store.products.lifecycle.manage', 'إدارة دورة حياة المنتج', 'إدارة المنتجات', 'إرسال ومراجعة وإيقاف وأرشفة المنتج'),
  ('store.products.showcase.manage', 'إدارة حالة العرض', 'إدارة المنتجات', 'تغيير حالة منتج العرض أو تسجيل بيعه'),
  ('store.orders.shipment.manage', 'إدارة الشحن للطلب', 'إدارة الطلبات', 'إضافة التتبع وتحديث حالة الشحنة'),
  ('store.orders.payment.manage', 'إدارة حالة الدفع', 'إدارة الطلبات', 'تأكيد أو رفض أو استرداد حالة دفع الطلب'),
  ('store.finance.withdrawals.manage', 'إدارة طلبات السحب', 'إدارة المالية', 'إنشاء ومتابعة طلبات سحب المتجر'),
  ('store.returns.manage', 'إدارة المرتجعات', 'إدارة المالية', 'مراجعة المرتجعات وطلبات الاسترداد'),
  ('store.payments.view', 'عرض وسائل الدفع', 'إدارة التشغيل', 'عرض وسائل الدفع المفعلة'),
  ('store.shipping.view', 'عرض وسائل الشحن', 'إدارة التشغيل', 'عرض وسائل الشحن المفعلة')
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name", "group" = EXCLUDED."group", "description" = EXCLUDED."description";
