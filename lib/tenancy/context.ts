import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { db, tenantDomains, tenantSettings, tenantStores, tenantThemes, tenants, tenantUsers } from "@/lib/db";
import { isNextProductionBuildPhase } from "@/lib/runtime-phase";

export type TenantContext = {
  tenant: typeof tenants.$inferSelect;
  domain: typeof tenantDomains.$inferSelect;
  theme: typeof tenantThemes.$inferSelect | null;
  publicSettings: Array<typeof tenantSettings.$inferSelect>;
  /** The only stores allowed to render on this tenant host. */
  storeIds: string[];
};

export function normalizeTenantHost(value: string | null | undefined) {
  return String(value || "").toLowerCase().split(",")[0].trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
}

export async function resolveTenantByHost(host: string | null | undefined): Promise<TenantContext | null> {
  if (isNextProductionBuildPhase()) return null;
  const domainName = normalizeTenantHost(host);
  if (!domainName) return null;
  const [row] = await db.select({ domain: tenantDomains, tenant: tenants }).from(tenantDomains).innerJoin(tenants, eq(tenantDomains.tenantId, tenants.id)).where(and(eq(tenantDomains.domain, domainName), eq(tenantDomains.status, "verified"), eq(tenants.status, "active"), eq(tenants.isWhiteLabel, true))).limit(1);
  if (!row) return null;
  const [theme, publicSettings, storeRows] = await Promise.all([
    db.select().from(tenantThemes).where(and(eq(tenantThemes.tenantId, row.tenant.id), eq(tenantThemes.isActive, true))).orderBy(desc(tenantThemes.updatedAt)).limit(1).then((rows) => rows[0] || null),
    db.select().from(tenantSettings).where(and(eq(tenantSettings.tenantId, row.tenant.id), eq(tenantSettings.isPublic, true))).limit(100),
    db.select({ storeId: tenantStores.storeId }).from(tenantStores).where(eq(tenantStores.tenantId, row.tenant.id))
  ]);
  return { tenant: row.tenant, domain: row.domain, theme, publicSettings, storeIds: storeRows.map((item) => item.storeId) };
}

export async function getRequestTenantContext() {
  if (isNextProductionBuildPhase()) return null;
  const h = await headers();
  return resolveTenantByHost(h.get("x-forwarded-host") || h.get("host"));
}

/** Enforces host → tenant → store membership at server-render/API boundaries. */
export function assertTenantStoreMembership(context: TenantContext, storeId: string, allowedStoreIds: string[] = context.storeIds) {
  if (!allowedStoreIds.includes(storeId)) throw new Error(`Store ${storeId} خارج نطاق tenant ${context.tenant.id}`);
  return true;
}

export async function assertTenantUserMembership(context: TenantContext, userId: string) {
  const [membership] = await db.select({ id: tenantUsers.id }).from(tenantUsers).where(and(eq(tenantUsers.tenantId, context.tenant.id), eq(tenantUsers.userId, userId), eq(tenantUsers.status, "active"))).limit(1);
  if (!membership) throw new Error(`User ${userId} خارج نطاق tenant ${context.tenant.id}`);
  return true;
}

/** Null means marketplace host; non-null means a verified white-label host with strict store scope. */
export async function getRequestTenantStoreScope() {
  const context = await getRequestTenantContext();
  return context ? { tenantId: context.tenant.id, storeIds: context.storeIds } : null;
}
