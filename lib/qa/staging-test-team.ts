import { isPlatformPermission, isStorePermission } from "@/lib/permission-scopes";

/**
 * A deliberately small, named test team for parallel human acceptance testing.
 * These are role templates only; names, emails and passwords are supplied at
 * runtime through the protected STAGING_QA_TEAM_JSON GitHub Environment secret.
 */
export const STAGING_TEST_TEAM_ACCOUNT_KEYS = [
  "platformContent",
  "platformOnboarding",
  "platformOperations",
  "platformFinance",
  "platformSecurity",
  "merchantOneOwner",
  "merchantOneCatalog",
  "merchantOneFulfillment",
  "merchantTwoOwner",
  "merchantTwoCatalog",
  "merchantTwoFulfillment",
  "customerOne",
  "customerTwo",
  "customerThree"
] as const;

export type StagingTestTeamAccountKey = (typeof STAGING_TEST_TEAM_ACCOUNT_KEYS)[number];
export type StagingTestTeamProfileKind = "platform_employee" | "merchant_owner" | "store_employee" | "customer";

export type StagingTestTeamProfile = {
  key: StagingTestTeamAccountKey;
  kind: StagingTestTeamProfileKind;
  title: string;
  description: string;
  /** Store slot, only meaningful for merchant owners and store employees. */
  storeSlot?: 1 | 2;
  /** These permissions are intentionally role-scoped and do not grant sensitive owner control. */
  permissionCodes: readonly string[];
};

const PLATFORM_CONTENT_PERMISSIONS = [
  "admin.access",
  "ads.view",
  "ads.create",
  "ads.edit",
  "ads.delete",
  "ads.approve",
  "ads.reject",
  "ads.expiry.change",
  "ads.feature",
  "ads.suspend",
  "ads.restore",
  "ads.manage",
  "announcements.manage",
  "news.manage",
  "offers.manage",
  "home.manage",
  "cms.manage",
  "theme.manage"
] as const;

const PLATFORM_ONBOARDING_PERMISSIONS = [
  "admin.access",
  "stores.view",
  "stores.approve",
  "stores.activate",
  "stores.edit",
  "merchant_applications.manage",
  "contracts.manage",
  "wings.manage"
] as const;

const PLATFORM_OPERATIONS_PERMISSIONS = [
  "admin.access",
  "orders.view",
  "orders.edit",
  "orders.status.change",
  "orders.cancel",
  "orders.close",
  "customers.view",
  "customers.edit",
  "users.manage",
  "shipping.manage",
  "payments.manage",
  "platform_products.view",
  "platform_products.edit"
] as const;

/**
 * The platform does not receive customer money in merchant_collects mode.
 * This profile may read reports and review sales reports, but cannot issue or
 * settle customer-money statements or merchant withdrawals.
 */
const PLATFORM_FINANCE_READONLY_PERMISSIONS = [
  "admin.access",
  "finance.reports.view",
  "finance.reports.export",
  "reports.view"
] as const;

const PLATFORM_SECURITY_PERMISSIONS = [
  "admin.access",
  "security.manage",
  "system.security_center.manage",
  "backups.manage",
  "reports.view"
] as const;

const MERCHANT_OWNER_PERMISSIONS = [
  "merchant.access",
  "products.manage",
  "inventory.manage",
  "orders.manage",
  "store_media.manage",
  "store_settings.manage",
  "product_taxonomy.manage",
  "store_offers.manage",
  "store_coupons.manage",
  "store_ads.manage",
  "store_finance.view",
  "store_payment_receipts.manage",
  "store_returns.manage",
  "store_shipping.manage",
  "store_payments.manage",
  "announcements.manage",
  "news.manage",
  "store.employees.view",
  "store.employees.create",
  "store.employees.edit",
  "store.employees.delete",
  "store.employees.permissions.manage"
] as const;

const MERCHANT_CATALOG_PERMISSIONS = [
  "merchant.access",
  "store.products.view",
  "store.products.create",
  "store.products.edit",
  "store.products.bulk_edit",
  "store.products.prices.change",
  "store.products.lifecycle.manage",
  "store.products.showcase.manage",
  "store.inventory.view",
  "store.inventory.manage",
  "store.inventory.stock_count"
] as const;

const MERCHANT_FULFILLMENT_PERMISSIONS = [
  "merchant.access",
  "store.orders.view",
  "store.orders.edit",
  "store.orders.status.change",
  "store.orders.shipment.manage",
  "store.orders.payment.manage",
  "store.returns.manage",
  "store_payment_receipts.manage"
] as const;

export const STAGING_TEST_TEAM_PROFILES: readonly StagingTestTeamProfile[] = [
  {
    key: "platformContent",
    kind: "platform_employee",
    title: "محتوى وإعلانات المنصة",
    description: "إدارة المحتوى والإعلانات فقط، دون المتاجر أو المالية أو الأمان.",
    permissionCodes: PLATFORM_CONTENT_PERMISSIONS
  },
  {
    key: "platformOnboarding",
    kind: "platform_employee",
    title: "مراجعة انضمام المتاجر والعقود",
    description: "مراجعة طلبات التجار والعقود وتفعيل المتاجر في Staging.",
    permissionCodes: PLATFORM_ONBOARDING_PERMISSIONS
  },
  {
    key: "platformOperations",
    kind: "platform_employee",
    title: "عمليات ودعم الطلبات",
    description: "متابعة الطلبات والكتالوج والدعم التشغيلي دون صلاحيات مالية أو أمنية.",
    permissionCodes: PLATFORM_OPERATIONS_PERMISSIONS
  },
  {
    key: "platformFinance",
    kind: "platform_employee",
    title: "تقارير وإيرادات المنصة للقراءة",
    description: "قراءة وتصدير التقارير ومراجعة تقارير المبيعات فقط؛ لا تسويات لأموال العملاء.",
    permissionCodes: PLATFORM_FINANCE_READONLY_PERMISSIONS
  },
  {
    key: "platformSecurity",
    kind: "platform_employee",
    title: "مراقبة الأمان والنسخ الاحتياطي",
    description: "اختبارات الأمان والنسخ والاستعادة في Staging؛ لا يمكن لهذا الحساب فتح التحكم الحساس للمالك.",
    permissionCodes: PLATFORM_SECURITY_PERMISSIONS
  },
  {
    key: "merchantOneOwner",
    kind: "merchant_owner",
    storeSlot: 1,
    title: "مالك متجر الاختبار الأول",
    description: "مالك متجر مستقل لاختبار إعدادات المتجر وإدارة موظفيه.",
    permissionCodes: MERCHANT_OWNER_PERMISSIONS
  },
  {
    key: "merchantOneCatalog",
    kind: "store_employee",
    storeSlot: 1,
    title: "كتالوج ومخزون المتجر الأول",
    description: "موظف متجر مخصص للمنتجات والأسعار والمخزون فقط.",
    permissionCodes: MERCHANT_CATALOG_PERMISSIONS
  },
  {
    key: "merchantOneFulfillment",
    kind: "store_employee",
    storeSlot: 1,
    title: "تنفيذ طلبات المتجر الأول",
    description: "موظف متجر مخصص لمتابعة الطلبات والشحن وإثباتات الدفع فقط.",
    permissionCodes: MERCHANT_FULFILLMENT_PERMISSIONS
  },
  {
    key: "merchantTwoOwner",
    kind: "merchant_owner",
    storeSlot: 2,
    title: "مالك متجر الاختبار الثاني",
    description: "مالك متجر مستقل ثانٍ لاختبار العزل بين التجار والطلبات متعددة المتاجر.",
    permissionCodes: MERCHANT_OWNER_PERMISSIONS
  },
  {
    key: "merchantTwoCatalog",
    kind: "store_employee",
    storeSlot: 2,
    title: "كتالوج ومخزون المتجر الثاني",
    description: "موظف متجر ثانٍ مخصص للمنتجات والأسعار والمخزون فقط.",
    permissionCodes: MERCHANT_CATALOG_PERMISSIONS
  },
  {
    key: "merchantTwoFulfillment",
    kind: "store_employee",
    storeSlot: 2,
    title: "تنفيذ طلبات المتجر الثاني",
    description: "موظف متجر ثانٍ مخصص لمتابعة الطلبات والشحن وإثباتات الدفع فقط.",
    permissionCodes: MERCHANT_FULFILLMENT_PERMISSIONS
  },
  {
    key: "customerOne",
    kind: "customer",
    title: "عميل اختبار أول",
    description: "عميل لطلب متجر واحد واختبار الحساب والعناوين.",
    permissionCodes: []
  },
  {
    key: "customerTwo",
    kind: "customer",
    title: "عميل اختبار ثانٍ",
    description: "عميل لسلة متعددة المتاجر والدفع وإثبات التحويل.",
    permissionCodes: []
  },
  {
    key: "customerThree",
    kind: "customer",
    title: "عميل اختبار سلبي",
    description: "حساب لاختبارات العزل ومحاولات الوصول المرفوضة.",
    permissionCodes: []
  }
] as const;

export function stagingTestTeamProfile(key: StagingTestTeamAccountKey) {
  const profile = STAGING_TEST_TEAM_PROFILES.find((item) => item.key === key);
  if (!profile) throw new Error(`ملف فريق الاختبار غير معروف: ${key}`);
  return profile;
}

export function validateStagingTestTeamProfiles() {
  const keys = STAGING_TEST_TEAM_PROFILES.map((profile) => profile.key);
  if (keys.length !== STAGING_TEST_TEAM_ACCOUNT_KEYS.length || new Set(keys).size !== keys.length) {
    throw new Error("قائمة حسابات فريق الاختبار يجب أن تكون كاملة وفريدة.");
  }
  for (const profile of STAGING_TEST_TEAM_PROFILES) {
    if (profile.kind === "platform_employee" && !profile.permissionCodes.every(isPlatformPermission)) {
      throw new Error(`صلاحية متجر وجدت في دور منصة: ${profile.key}`);
    }
    if (["merchant_owner", "store_employee"].includes(profile.kind) && !profile.permissionCodes.every(isStorePermission)) {
      throw new Error(`صلاحية منصة وجدت في دور متجر: ${profile.key}`);
    }
    if (profile.kind === "customer" && profile.permissionCodes.length) {
      throw new Error(`حساب العميل لا يمنح صلاحيات تشغيلية: ${profile.key}`);
    }
  }
  return true;
}
