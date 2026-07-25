import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db, permissions, rolePermissions, roles, userPermissions, userRoles } from "@/lib/db";
import { hasMerchantAccess, type SessionPayload } from "@/lib/auth";
import { LEGACY_EMPLOYEE_ACTION_FALLBACK } from "@/lib/permissions/catalog";

export const Permission = {
  AdminAccess: "admin.access",
  ManageSettings: "admin.settings.manage",
  ManageMaster: "master.manage",
  ManageTheme: "theme.manage",
  ManageHome: "home.manage",
  ManageCms: "cms.manage",
  ManageContracts: "contracts.manage",
  ManageCommissions: "commissions.manage",
  ManageTaxes: "taxes.manage",
  ManageAds: "ads.manage",
  ManageOffers: "offers.manage",
  ManageNotifications: "notifications.manage",
  ManagePayments: "payments.manage",
  ManageShipping: "shipping.manage",
  ManageBackups: "backups.manage",
  ManageReports: "reports.view",
  ManageSecurity: "security.manage",
  ManageTenants: "tenants.manage",
  ManageUsers: "users.manage",
  ManageSubscriptions: "subscriptions.manage",
  ManageDefaultMedia: "default_media.manage",
  ManageBranches: "branches.manage",
  ManageWings: "wings.manage",
  ManageStores: "stores.manage",
  ManageMerchantApplications: "merchant_applications.manage",
  ManageGeography: "geography.manage",
  ManageAnnouncements: "announcements.manage",
  ManageNews: "news.manage",
  ManageRoles: "roles.manage",
  MerchantAccess: "merchant.access",
  ManageProducts: "products.manage",
  ManageInventory: "inventory.manage",
  ManageOrders: "orders.manage",
  ManageStoreMedia: "store_media.manage",
  ManageStoreSettings: "store_settings.manage",
  ManageProductTaxonomy: "product_taxonomy.manage",
  ManageStoreOffers: "store_offers.manage",
  ManageStoreCoupons: "store_coupons.manage",
  ManageStoreAds: "store_ads.manage",
  ViewStoreFinance: "store_finance.view",
  ManageStorePaymentReceipts: "store_payment_receipts.manage",
  ManageStoreReturns: "store_returns.manage",
  ManageStoreShipping: "store_shipping.manage",
  ManageStorePayments: "store_payments.manage"
} as const;

export type PermissionCode = (typeof Permission)[keyof typeof Permission];
export type PermissionOverrideEffect = "grant" | "deny";

async function userIsSuperAdmin(userId: string) {
  const [row] = await db
    .select({ id: userRoles.id })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(eq(userRoles.userId, userId), eq(roles.code, "super_admin")))
    .limit(1);
  return Boolean(row);
}

async function getDirectOverride(userId: string, permissionCode: string, storeId: string | null) {
  const [row] = await db
    .select({ effect: userPermissions.effect })
    .from(userPermissions)
    .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
    .where(and(eq(userPermissions.userId, userId), eq(permissions.code, permissionCode), storeId ? eq(userPermissions.storeId, storeId) : isNull(userPermissions.storeId)))
    .limit(1);
  return row?.effect as PermissionOverrideEffect | undefined;
}

async function userHasRolePermission(userId: string, permissionCode: string, options: { storeId?: string; systemOnly?: boolean } = {}) {
  const scopeCondition = options.systemOnly
    ? and(eq(roles.scope, "system"), isNull(userRoles.storeId))
    : options.storeId
      ? eq(userRoles.storeId, options.storeId)
      : undefined;
  const rows = await db
    .select({ code: permissions.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(eq(userRoles.userId, userId), eq(permissions.code, permissionCode), scopeCondition));
  return rows.length > 0;
}

/** System/platform permission evaluation: explicit deny > explicit grant > roles. */
export async function userHasPermission(userId: string, permissionCode: PermissionCode | string) {
  if (await userIsSuperAdmin(userId)) return true;
  const override = await getDirectOverride(userId, permissionCode, null);
  if (override === "deny") return false;
  if (override === "grant") return true;
  return userHasRolePermission(userId, permissionCode, { systemOnly: true });
}

/** Store permission evaluation is constrained to one store and never crosses tenants. */
export async function userHasAnyStorePermission(userId: string, storeId: string, permissionCodes: readonly (PermissionCode | string)[]) {
  if (await userIsSuperAdmin(userId)) return true;
  for (const permissionCode of permissionCodes) {
    const override = await getDirectOverride(userId, permissionCode, storeId);
    if (override === "grant") return true;
    if (override === "deny") continue;
    if (await userHasRolePermission(userId, permissionCode, { storeId })) return true;
  }
  return false;
}

export async function userHasStorePermission(userId: string, storeId: string, permissionCode: PermissionCode | string) {
  return userHasAnyStorePermission(userId, storeId, [permissionCode]);
}

export async function assertStorePermission(userId: string, storeId: string, permissionCode: PermissionCode | string) {
  const allowed = await userHasStorePermission(userId, storeId, permissionCode);
  if (!allowed) throw new Error("لا تملك الصلاحية الدقيقة لتنفيذ هذه العملية");
}

/**
 * Returns currently effective system permissions for UI navigation. Store roles
 * are intentionally excluded; callers needing a store must pass storeId.
 */
export async function getUserPermissions(userId: string, options: { storeId?: string } = {}) {
  if (await userIsSuperAdmin(userId)) {
    const rows = await db.select({ code: permissions.code }).from(permissions);
    return rows.map((row) => row.code);
  }

  const scope = options.storeId ? eq(userRoles.storeId, options.storeId) : and(eq(roles.scope, "system"), isNull(userRoles.storeId));
  const roleRows = await db
    .select({ code: permissions.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(eq(userRoles.userId, userId), scope));
  const overrideRows = await db
    .select({ code: permissions.code, effect: userPermissions.effect })
    .from(userPermissions)
    .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
    .where(and(eq(userPermissions.userId, userId), options.storeId ? eq(userPermissions.storeId, options.storeId) : isNull(userPermissions.storeId)));
  const result = new Set(roleRows.map((row) => row.code));
  for (const row of overrideRows) {
    if (row.effect === "deny") result.delete(row.code);
    else result.add(row.code);
  }
  return [...result];
}

export function assertRole(session: SessionPayload, acceptedRoles: string[]) {
  const allowed = session.roles.some((role) => acceptedRoles.includes(role.code));
  if (!allowed) throw new Error("لا تملك صلاحية تنفيذ هذه العملية");
}

export async function assertAdmin(session: SessionPayload, permissionCode: PermissionCode | string | readonly string[] = Permission.AdminAccess) {
  if (session.roles.some((role) => role.code === "super_admin")) return;
  if (!(await userHasPermission(session.userId, Permission.AdminAccess))) {
    throw new Error("لا تملك صلاحية دخول لوحة الأدمن");
  }
  const requested = Array.isArray(permissionCode) ? permissionCode : [permissionCode];
  if (requested.includes(Permission.AdminAccess)) return;
  const allowed = await Promise.all(requested.map((code) => userHasPermission(session.userId, code)));
  if (!allowed.some(Boolean)) throw new Error("لا تملك الصلاحية التفصيلية لتنفيذ هذه العملية");
}

/** Compatibility fallback preserves existing role setups during granular RBAC migration. */
export async function assertAdminEmployeeAction(session: SessionPayload, action: "view" | "create" | "edit" | "delete" | "permissions.manage") {
  return assertAdmin(session, [`employees.${action}`, LEGACY_EMPLOYEE_ACTION_FALLBACK.platform]);
}

/**
 * Operation-level admin policy. New staff receive the first code; the second
 * code preserves existing module roles until every legacy assignment has been
 * migrated. Route handlers must use this instead of a broad `*.manage` check.
 */
export const ADMIN_OPERATION_PERMISSIONS = {
  "ads.view": ["ads.view", "ads.manage"],
  "ads.create": ["ads.create", "ads.manage"],
  "ads.edit": ["ads.edit", "ads.manage"],
  "ads.delete": ["ads.delete", "ads.manage"],
  "ads.approve": ["ads.approve", "ads.manage"],
  "ads.reject": ["ads.reject", "ads.manage"],
  "ads.suspend": ["ads.suspend", "ads.manage"],
  "ads.feature": ["ads.feature", "ads.manage"],
  "ads.settings": ["system.settings.edit", "ads.manage"],
  "ads.billing.view": ["ads.billing.view", "ads.manage"],
  "ads.billing.issue": ["ads.billing.issue", "ads.manage"],
  "ads.billing.settle": ["ads.billing.settle", "ads.manage"],
  "ads.fraud.view": ["ads.fraud.view", "ads.manage"],
  "platform_revenue.terms.manage": ["platform_revenue.terms.manage", "contracts.manage", "finance.settlements.manage"],
  "platform_revenue.promotions.manage": ["platform_revenue.promotions.manage", "ads.manage"],
  "platform_revenue.sales_reports.review": ["platform_revenue.sales_reports.review", "finance.reports.view"],
  "platform_revenue.statements.view": ["platform_revenue.statements.view", "finance.reports.view"],
  "platform_revenue.statements.issue": ["platform_revenue.statements.issue", "finance.settlements.manage"],
  "platform_revenue.statements.settle": ["platform_revenue.statements.settle", "finance.settlements.manage"],
  "erp.requests.review": ["erp.requests.review", "system.erp.manage", "system.integrations.manage"],
  "erp.connectors.manage": ["erp.connectors.manage", "system.erp.manage", "system.integrations.manage"],
  "erp.requests.activate": ["erp.requests.activate", "system.erp.manage"],
  "merchant_applications.documents.review": ["merchant_applications.documents.review", "merchant_applications.manage"],
  "merchant_applications.launch.review": ["merchant_applications.launch.review", "merchant_applications.manage", "stores.manage"],
  "contracts.addendum.manage": ["contracts.addendum.manage", "contracts.manage"],
  "stores.identity_changes.review": ["stores.identity_changes.review", "stores.manage", "contracts.manage"],
  "ai.assistant.use": ["ai.assistant.use", "admin.access"],
  "ai.proposals.approve": ["ai.proposals.approve", "admin.access"],
  "platform_products.view": ["platform_products.view", "products.manage"],
  "platform_products.edit": ["platform_products.edit", "products.manage"],
  "platform_products.delete": ["platform_products.delete", "products.manage"],
  "customers.view": ["customers.view", "users.manage"],
  "customers.edit": ["customers.edit", "users.manage"],
  "stores.view": ["stores.view", "stores.manage"],
  "stores.approve": ["stores.approve", "stores.manage"],
  "stores.edit": ["stores.edit", "stores.manage"],
  "stores.suspend": ["stores.suspend", "stores.manage"],
  "stores.activate": ["stores.activate", "stores.manage"],
  "stores.delete": ["stores.delete", "stores.manage"],
  "stores.incomplete.delete": ["stores.incomplete.delete", "stores.delete", "stores.manage"],
  "providers.view": ["providers.view", "payments.manage"],
  "providers.add": ["providers.add", "payments.manage"],
  "providers.edit": ["providers.edit", "payments.manage"],
  "providers.suspend": ["providers.suspend", "payments.manage"],
  "providers.delete": ["providers.delete", "payments.manage"],
  "finance.reports.view": ["finance.reports.view", "reports.view"],
  "finance.reports.export": ["finance.reports.export", "reports.view"],
  "finance.withdrawals.manage": ["finance.withdrawals.manage", "reports.view"],
  "finance.commissions.manage": ["finance.commissions.manage", "commissions.manage"],
  "system.settings.view": ["system.settings.view", "admin.settings.manage"],
  "system.settings.edit": ["system.settings.edit", "admin.settings.manage"],
  "system.integrations.manage": ["system.integrations.manage", "security.manage"],
  "system.erp.manage": ["system.erp.manage", "security.manage"],
  "system.security_center.manage": ["system.security_center.manage", "security.manage"]
} as const;

export type AdminOperation = keyof typeof ADMIN_OPERATION_PERMISSIONS;
export async function assertAdminOperation(session: SessionPayload, operation: AdminOperation) {
  return assertAdmin(session, ADMIN_OPERATION_PERMISSIONS[operation]);
}

export const STORE_OPERATION_PERMISSIONS = {
  "products.view": ["store.products.view", Permission.ManageProducts],
  "products.create": ["store.products.create", Permission.ManageProducts],
  "products.edit": ["store.products.edit", Permission.ManageProducts],
  "products.delete": ["store.products.delete", Permission.ManageProducts],
  "products.export": ["store.products.export", Permission.ManageProducts],
  "products.lifecycle": ["store.products.lifecycle.manage", Permission.ManageProducts],
  "products.showcase": ["store.products.showcase.manage", Permission.ManageProducts],
  "inventory.view": ["store.inventory.view", "store.inventory.manage", Permission.ManageInventory],
  "inventory.manage": ["store.inventory.manage", Permission.ManageInventory],
  "inventory.stock_count": ["store.inventory.stock_count", Permission.ManageInventory],
  "orders.view": ["store.orders.view", Permission.ManageOrders],
  "orders.edit": ["store.orders.edit", Permission.ManageOrders],
  "orders.status": ["store.orders.status.change", Permission.ManageOrders],
  "orders.shipment": ["store.orders.shipment.manage", Permission.ManageOrders],
  "orders.payment": ["store.orders.payment.manage", Permission.ManageOrders],
  "orders.returns": ["store.returns.manage", Permission.ManageStoreReturns, Permission.ManageOrders],
  "ads.view": ["store.ads.view", Permission.ManageStoreAds, Permission.ManageAnnouncements, Permission.ManageStoreMedia, Permission.ManageStoreSettings],
  "ads.manage": ["store.ads.manage", Permission.ManageStoreAds, Permission.ManageAnnouncements, Permission.ManageStoreMedia, Permission.ManageStoreSettings],
  "ads.billing.view": ["store.ads.billing.view", "store.ads.view", Permission.ManageStoreAds],
  "platform_revenue.view": ["store.platform_revenue.view", "store.finance.view", Permission.ViewStoreFinance],
  "platform_revenue.sales_report.submit": ["store.platform_revenue.sales_report.submit", "store.finance.view", Permission.ViewStoreFinance],
  "erp.requests.view": ["store.erp.requests.view", "store.settings.manage", Permission.ManageStoreSettings],
  "erp.requests.create": ["store.erp.requests.create", "store.settings.manage", Permission.ManageStoreSettings],
  "onboarding.view": ["store.onboarding.view", "store.settings.manage", Permission.ManageStoreSettings],
  "onboarding.submit": ["store.onboarding.submit", "store.settings.manage", Permission.ManageStoreSettings],
  "identity_changes.view": ["store.identity_changes.view", "store.settings.manage", Permission.ManageStoreSettings],
  "identity_changes.create": ["store.identity_changes.create", "store.settings.manage", Permission.ManageStoreSettings],
  "ai.use": ["store.ai.use", "store.settings.manage", Permission.ManageStoreSettings],
  "ai.proposals.approve": ["store.ai.proposals.approve", "store.settings.manage", Permission.ManageStoreSettings],
  "finance.view": ["store.finance.view", Permission.ViewStoreFinance, Permission.ManageStoreSettings],
  "finance.withdrawals": ["store.finance.withdrawals.manage", Permission.ViewStoreFinance, Permission.ManageStoreSettings],
  "payments.view": ["store.payments.view", Permission.ManageStorePayments, Permission.ManageStoreSettings],
  "payments.manage": ["store.payments.manage", Permission.ManageStorePayments, Permission.ManageStoreSettings],
  "shipping.view": ["store.shipping.view", Permission.ManageStoreShipping, Permission.ManageStoreSettings],
  "shipping.manage": ["store.shipping.manage", Permission.ManageStoreShipping, Permission.ManageStoreSettings]
} as const;

export type StoreOperation = keyof typeof STORE_OPERATION_PERMISSIONS;
export async function userHasStoreOperation(userId: string, storeId: string, operation: StoreOperation) {
  return userHasAnyStorePermission(userId, storeId, STORE_OPERATION_PERMISSIONS[operation]);
}

/** Compatibility fallback preserves the current merchant-owner role until it is migrated. */
export async function userCanManageStoreEmployees(userId: string, storeId: string, action: "view" | "create" | "edit" | "delete" | "permissions.manage") {
  return userHasAnyStorePermission(userId, storeId, [`store.employees.${action}`, LEGACY_EMPLOYEE_ACTION_FALLBACK.store]);
}

export function assertMerchant(session: SessionPayload) {
  if (!hasMerchantAccess(session)) throw new Error("لا تملك صلاحية تنفيذ هذه العملية");
}

export async function ensureBasePermissions(codes: string[]) {
  const existing = await db.select({ code: permissions.code }).from(permissions).where(inArray(permissions.code, codes));
  return new Set(existing.map((item) => item.code));
}

export async function getPermissionOverrides(userId: string, storeId: string | null) {
  return db
    .select({ code: permissions.code, effect: userPermissions.effect, reason: userPermissions.reason })
    .from(userPermissions)
    .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
    .where(and(eq(userPermissions.userId, userId), storeId ? eq(userPermissions.storeId, storeId) : isNull(userPermissions.storeId)));
}
