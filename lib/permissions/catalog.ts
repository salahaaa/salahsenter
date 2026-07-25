export type PermissionDomain = "platform" | "store";

export type PermissionDefinition = {
  code: string;
  name: string;
  group: string;
  description: string;
  domains: PermissionDomain[];
};

/**
 * The canonical, human-readable catalogue used by employee permission screens.
 * Codes are deliberately operation-level (not just module-level) so a role or
 * a direct user override can govern a screen/button/action independently.
 */
export const GRANULAR_PERMISSION_CATALOG: readonly PermissionDefinition[] = [
  { code: "admin.access", name: "دخول لوحة الأدمن", group: "لوحة الإدارة", description: "فتح لوحة الإدارة المركزية", domains: ["platform"] },

  { code: "ads.view", name: "عرض الإعلانات", group: "إدارة الإعلانات", description: "عرض الحملات والإعلانات", domains: ["platform"] },
  { code: "ads.create", name: "إنشاء إعلان", group: "إدارة الإعلانات", description: "إنشاء حملة أو إعلان", domains: ["platform"] },
  { code: "ads.approve", name: "اعتماد إعلان", group: "إدارة الإعلانات", description: "اعتماد إعلان مقدم للمراجعة", domains: ["platform"] },
  { code: "ads.reject", name: "رفض إعلان", group: "إدارة الإعلانات", description: "رفض إعلان مقدم للمراجعة", domains: ["platform"] },
  { code: "ads.edit", name: "تعديل إعلان", group: "إدارة الإعلانات", description: "تعديل بيانات الإعلان", domains: ["platform"] },
  { code: "ads.delete", name: "حذف إعلان", group: "إدارة الإعلانات", description: "حذف الإعلان", domains: ["platform"] },
  { code: "ads.expiry.change", name: "تغيير تاريخ الانتهاء", group: "إدارة الإعلانات", description: "تمديد أو تقصير مدة الإعلان", domains: ["platform"] },
  { code: "ads.feature", name: "تمييز إعلان", group: "إدارة الإعلانات", description: "إبراز الإعلان في مواضع العرض", domains: ["platform"] },
  { code: "ads.suspend", name: "إيقاف إعلان", group: "إدارة الإعلانات", description: "تعليق الإعلان مؤقتاً", domains: ["platform"] },
  { code: "ads.restore", name: "استعادة إعلان", group: "إدارة الإعلانات", description: "إعادة إعلان موقوف أو محذوف منطقياً", domains: ["platform"] },

  { code: "platform_products.view", name: "عرض المنتجات", group: "إدارة المنتجات", description: "عرض كتالوج المنصة", domains: ["platform"] },
  { code: "platform_products.create", name: "إنشاء منتج", group: "إدارة المنتجات", description: "إنشاء منتج نيابة عن متجر أو المنصة", domains: ["platform"] },
  { code: "platform_products.edit", name: "تعديل منتج", group: "إدارة المنتجات", description: "تعديل بيانات المنتج", domains: ["platform"] },
  { code: "platform_products.delete", name: "حذف منتج", group: "إدارة المنتجات", description: "أرشفة أو حذف المنتج", domains: ["platform"] },
  { code: "platform_products.bulk_edit", name: "تعديل جماعي", group: "إدارة المنتجات", description: "تحديث منتجات متعددة دفعة واحدة", domains: ["platform"] },
  { code: "platform_products.prices.change", name: "تغيير الأسعار", group: "إدارة المنتجات", description: "تغيير أسعار المنتجات", domains: ["platform"] },
  { code: "platform_products.inventory.manage", name: "إدارة المخزون", group: "إدارة المنتجات", description: "تعديل مخزون المنتجات من لوحة المنصة", domains: ["platform"] },
  { code: "platform_products.restore", name: "استعادة منتج محذوف", group: "إدارة المنتجات", description: "استعادة منتج مؤرشف", domains: ["platform"] },

  { code: "stores.view", name: "عرض المتاجر", group: "إدارة المتاجر", description: "عرض بيانات المتاجر", domains: ["platform"] },
  { code: "stores.approve", name: "اعتماد متجر", group: "إدارة المتاجر", description: "اعتماد طلب متجر", domains: ["platform"] },
  { code: "stores.suspend", name: "إيقاف متجر", group: "إدارة المتاجر", description: "تعليق المتجر", domains: ["platform"] },
  { code: "stores.activate", name: "تفعيل متجر", group: "إدارة المتاجر", description: "إعادة تفعيل المتجر", domains: ["platform"] },
  { code: "stores.edit", name: "تعديل متجر", group: "إدارة المتاجر", description: "تعديل بيانات المتجر", domains: ["platform"] },
  { code: "stores.delete", name: "حذف متجر", group: "إدارة المتاجر", description: "إغلاق أو حذف متجر", domains: ["platform"] },
  { code: "stores.incomplete.delete", name: "حذف متجر غير مكتمل", group: "إدارة المتاجر", description: "حذف نهائي آمن لمتجر pending بلا بيانات تشغيلية", domains: ["platform"] },

  { code: "orders.view", name: "عرض الطلبات", group: "إدارة الطلبات", description: "عرض طلبات المنصة", domains: ["platform"] },
  { code: "orders.edit", name: "تعديل الطلبات", group: "إدارة الطلبات", description: "تعديل بيانات الطلب", domains: ["platform"] },
  { code: "orders.status.change", name: "تغيير حالة الطلب", group: "إدارة الطلبات", description: "تغيير حالة سير الطلب", domains: ["platform"] },
  { code: "orders.cancel", name: "إلغاء الطلبات", group: "إدارة الطلبات", description: "إلغاء الطلب", domains: ["platform"] },
  { code: "orders.refund", name: "استرداد الطلبات", group: "إدارة الطلبات", description: "تنفيذ الاسترداد", domains: ["platform"] },
  { code: "orders.close", name: "إغلاق الطلبات", group: "إدارة الطلبات", description: "إغلاق الطلب بعد اكتماله", domains: ["platform"] },

  { code: "customers.view", name: "عرض العملاء", group: "إدارة العملاء", description: "عرض ملفات العملاء", domains: ["platform"] },
  { code: "customers.edit", name: "تعديل العملاء", group: "إدارة العملاء", description: "تعديل بيانات العميل", domains: ["platform"] },
  { code: "customers.suspend", name: "إيقاف العملاء", group: "إدارة العملاء", description: "تعليق حساب العميل", domains: ["platform"] },
  { code: "customers.delete", name: "حذف العملاء", group: "إدارة العملاء", description: "حذف أو إخفاء العميل", domains: ["platform"] },

  { code: "employees.view", name: "عرض الموظفين", group: "إدارة الموظفين", description: "عرض دليل موظفي المنصة", domains: ["platform"] },
  { code: "employees.create", name: "إنشاء موظف", group: "إدارة الموظفين", description: "إنشاء حساب موظف جديد", domains: ["platform"] },
  { code: "employees.edit", name: "تعديل موظف", group: "إدارة الموظفين", description: "تعديل بيانات الموظف وحالة حسابه", domains: ["platform"] },
  { code: "employees.delete", name: "إلغاء تفعيل موظف", group: "إدارة الموظفين", description: "إلغاء تفعيل الحساب مع الاحتفاظ بالسجل", domains: ["platform"] },
  { code: "employees.permissions.manage", name: "إدارة الصلاحيات", group: "إدارة الموظفين", description: "منح وسحب وتجاوز صلاحيات الموظفين", domains: ["platform"] },

  { code: "finance.reports.view", name: "عرض التقارير المالية", group: "إدارة المالية", description: "عرض التقارير المالية", domains: ["platform"] },
  { code: "finance.reports.export", name: "تصدير التقارير", group: "إدارة المالية", description: "تصدير التقارير المالية", domains: ["platform"] },
  { code: "finance.settlements.manage", name: "إدارة التسويات", group: "إدارة المالية", description: "إدارة التسويات", domains: ["platform"] },
  { code: "finance.commissions.manage", name: "إدارة العمولات", group: "إدارة المالية", description: "تعديل العمولات", domains: ["platform"] },
  { code: "finance.withdrawals.manage", name: "إدارة السحوبات", group: "إدارة المالية", description: "مراجعة السحوبات والتحويلات", domains: ["platform"] },

  { code: "providers.view", name: "عرض المزودين", group: "إدارة البنوك والمحافظ", description: "عرض البنوك والمحافظ ومزودي الدفع", domains: ["platform"] },
  { code: "providers.add", name: "إضافة مزود", group: "إدارة البنوك والمحافظ", description: "إضافة بنك أو محفظة", domains: ["platform"] },
  { code: "providers.edit", name: "تعديل مزود", group: "إدارة البنوك والمحافظ", description: "تعديل المزود المالي", domains: ["platform"] },
  { code: "providers.suspend", name: "إيقاف مزود", group: "إدارة البنوك والمحافظ", description: "إيقاف مزود مالي", domains: ["platform"] },
  { code: "providers.delete", name: "حذف مزود", group: "إدارة البنوك والمحافظ", description: "حذف مزود مالي", domains: ["platform"] },

  { code: "system.settings.view", name: "عرض الإعدادات", group: "إدارة النظام", description: "عرض إعدادات المنصة", domains: ["platform"] },
  { code: "system.settings.edit", name: "تعديل الإعدادات", group: "إدارة النظام", description: "تعديل إعدادات المنصة", domains: ["platform"] },
  { code: "system.integrations.manage", name: "إدارة التكاملات", group: "إدارة النظام", description: "إدارة العملاء والموصلات", domains: ["platform"] },
  { code: "system.erp.manage", name: "إدارة ERP", group: "إدارة النظام", description: "اعتماد وفتح ERP والمتزامنين", domains: ["platform"] },
  { code: "system.security_center.manage", name: "إدارة مركز الأمان", group: "إدارة النظام", description: "إدارة الحوادث والحماية", domains: ["platform"] },

  { code: "merchant.access", name: "دخول لوحة التاجر", group: "لوحة التاجر", description: "فتح لوحة المتجر", domains: ["store"] },
  { code: "store.products.view", name: "عرض المنتجات", group: "إدارة المنتجات", description: "عرض منتجات المتجر", domains: ["store"] },
  { code: "store.products.create", name: "إنشاء منتج", group: "إدارة المنتجات", description: "إضافة منتج", domains: ["store"] },
  { code: "store.products.edit", name: "تعديل منتج", group: "إدارة المنتجات", description: "تعديل المنتج", domains: ["store"] },
  { code: "store.products.delete", name: "حذف منتج", group: "إدارة المنتجات", description: "أرشفة أو حذف منتج", domains: ["store"] },
  { code: "store.products.bulk_edit", name: "تعديل جماعي", group: "إدارة المنتجات", description: "تعديل منتجات متعددة", domains: ["store"] },
  { code: "store.products.prices.change", name: "تغيير الأسعار", group: "إدارة المنتجات", description: "تعديل الأسعار", domains: ["store"] },
  { code: "store.products.restore", name: "استعادة المنتجات", group: "إدارة المنتجات", description: "استعادة منتج مؤرشف", domains: ["store"] },
  { code: "store.products.export", name: "تصدير المنتجات", group: "إدارة المنتجات", description: "تصدير الكتالوج حسب الفلاتر", domains: ["store"] },
  { code: "store.products.lifecycle.manage", name: "إدارة دورة حياة المنتج", group: "إدارة المنتجات", description: "إرسال ومراجعة وإيقاف وأرشفة المنتج", domains: ["store"] },
  { code: "store.products.showcase.manage", name: "إدارة حالة العرض", group: "إدارة المنتجات", description: "تغيير حالة منتج العرض أو تسجيل بيعه", domains: ["store"] },
  { code: "store.inventory.view", name: "عرض المخزون", group: "إدارة المخزون", description: "عرض مستويات المخزون", domains: ["store"] },
  { code: "store.inventory.manage", name: "إدارة المخزون", group: "إدارة المخزون", description: "تعديل الكميات والحجوزات", domains: ["store"] },
  { code: "store.inventory.stock_count", name: "إدارة الجرد", group: "إدارة المخزون", description: "تنفيذ جرد دوري", domains: ["store"] },
  { code: "store.orders.view", name: "عرض الطلبات", group: "إدارة الطلبات", description: "عرض طلبات المتجر", domains: ["store"] },
  { code: "store.orders.edit", name: "تعديل الطلبات", group: "إدارة الطلبات", description: "تعديل بيانات الطلب", domains: ["store"] },
  { code: "store.orders.status.change", name: "تغيير حالة الطلب", group: "إدارة الطلبات", description: "تغيير حالة الطلب", domains: ["store"] },
  { code: "store.orders.cancel", name: "إلغاء الطلبات", group: "إدارة الطلبات", description: "إلغاء الطلب", domains: ["store"] },
  { code: "store.orders.refund", name: "استرداد الطلبات", group: "إدارة الطلبات", description: "إرجاع المبلغ", domains: ["store"] },
  { code: "store.orders.close", name: "إغلاق الطلبات", group: "إدارة الطلبات", description: "إغلاق الطلب", domains: ["store"] },
  { code: "store.orders.shipment.manage", name: "إدارة الشحن للطلب", group: "إدارة الطلبات", description: "إضافة التتبع وتحديث حالة الشحنة", domains: ["store"] },
  { code: "store.orders.payment.manage", name: "إدارة حالة الدفع", group: "إدارة الطلبات", description: "تأكيد أو رفض أو استرداد حالة دفع الطلب", domains: ["store"] },
  { code: "store.customers.view", name: "عرض العملاء", group: "إدارة العملاء", description: "عرض عملاء المتجر", domains: ["store"] },
  { code: "store.customers.edit", name: "تعديل العملاء", group: "إدارة العملاء", description: "تعديل بيانات العميل في نطاق المتجر", domains: ["store"] },
  { code: "store.employees.view", name: "عرض الموظفين", group: "إدارة الموظفين", description: "عرض موظفي المتجر", domains: ["store"] },
  { code: "store.employees.create", name: "إنشاء موظف", group: "إدارة الموظفين", description: "إنشاء حساب موظف متجر", domains: ["store"] },
  { code: "store.employees.edit", name: "تعديل موظف", group: "إدارة الموظفين", description: "تعديل بيانات الموظف وحالته", domains: ["store"] },
  { code: "store.employees.delete", name: "إلغاء تفعيل موظف", group: "إدارة الموظفين", description: "إلغاء تفعيل موظف المتجر", domains: ["store"] },
  { code: "store.employees.permissions.manage", name: "إدارة الصلاحيات", group: "إدارة الموظفين", description: "إدارة أدوار وتجاوزات موظفي المتجر", domains: ["store"] },
  { code: "store.branches.view", name: "عرض الفروع", group: "إدارة الفروع", description: "عرض الفروع", domains: ["store"] },
  { code: "store.branches.manage", name: "إدارة الفروع", group: "إدارة الفروع", description: "إضافة وتعديل الفروع", domains: ["store"] },
  { code: "store.finance.view", name: "عرض المالية", group: "إدارة المالية", description: "عرض مالية المتجر", domains: ["store"] },
  { code: "store.finance.reports.export", name: "تصدير التقارير", group: "إدارة المالية", description: "تصدير تقارير المتجر", domains: ["store"] },
  { code: "store.finance.withdrawals.manage", name: "إدارة طلبات السحب", group: "إدارة المالية", description: "إنشاء ومتابعة طلبات سحب المتجر", domains: ["store"] },
  { code: "store.returns.manage", name: "إدارة المرتجعات", group: "إدارة المالية", description: "مراجعة المرتجعات وطلبات الاسترداد", domains: ["store"] },
  { code: "store.payments.view", name: "عرض وسائل الدفع", group: "إدارة التشغيل", description: "عرض وسائل الدفع المفعلة", domains: ["store"] },
  { code: "store.shipping.view", name: "عرض وسائل الشحن", group: "إدارة التشغيل", description: "عرض وسائل الشحن المفعلة", domains: ["store"] },
  { code: "store.ads.view", name: "عرض إعلانات المتجر", group: "إدارة الإعلانات", description: "عرض حملات المتجر", domains: ["store"] },
  { code: "store.ads.manage", name: "إدارة إعلانات المتجر", group: "إدارة الإعلانات", description: "إنشاء وتعديل حملات المتجر", domains: ["store"] },
  { code: "store.shipping.manage", name: "إدارة الشحن", group: "إدارة التشغيل", description: "إدارة وسائل الشحن", domains: ["store"] },
  { code: "store.payments.manage", name: "إدارة الدفع", group: "إدارة التشغيل", description: "إدارة وسائل الدفع", domains: ["store"] }
] as const;

const LEGACY_PLATFORM_CODES = [
  "admin.settings.manage", "master.manage", "theme.manage", "home.manage", "cms.manage", "contracts.manage", "branches.manage", "commissions.manage", "taxes.manage", "wings.manage", "stores.manage", "merchant_applications.manage", "geography.manage", "announcements.manage", "ads.manage", "offers.manage", "news.manage", "notifications.manage", "roles.manage", "security.manage", "payments.manage", "shipping.manage", "backups.manage", "reports.view", "users.manage", "subscriptions.manage", "tenants.manage", "default_media.manage"
] as const;

const LEGACY_STORE_CODES = [
  "products.manage", "inventory.manage", "orders.manage", "store_media.manage", "store_settings.manage", "product_taxonomy.manage", "store_offers.manage", "store_coupons.manage", "store_ads.manage", "store_finance.view", "store_payment_receipts.manage", "store_returns.manage", "store_shipping.manage", "store_payments.manage", "announcements.manage", "news.manage"
] as const;

export const PLATFORM_PERMISSION_CODES = new Set<string>([
  ...GRANULAR_PERMISSION_CATALOG.filter((permission) => permission.domains.includes("platform")).map((permission) => permission.code),
  ...LEGACY_PLATFORM_CODES
]);

export const STORE_PERMISSION_CODES = new Set<string>([
  ...GRANULAR_PERMISSION_CATALOG.filter((permission) => permission.domains.includes("store")).map((permission) => permission.code),
  ...LEGACY_STORE_CODES
]);

export function isCatalogPermissionForDomain(code: string, domain: PermissionDomain) {
  return (domain === "platform" ? PLATFORM_PERMISSION_CODES : STORE_PERMISSION_CODES).has(code);
}

export function catalogPermissionCodes(domain: PermissionDomain) {
  return GRANULAR_PERMISSION_CATALOG.filter((permission) => permission.domains.includes(domain)).map((permission) => permission.code);
}

export const LEGACY_EMPLOYEE_ACTION_FALLBACK = {
  platform: "roles.manage",
  store: "store_settings.manage"
} as const;
