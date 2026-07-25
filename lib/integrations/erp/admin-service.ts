import crypto from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db, integrationAgentDevices, integrationClients, integrationEntityLinks, integrationEvents, integrationMappingProfiles, integrationSyncRuns, stores } from "@/lib/db";
import { sha256 } from "@/lib/integrations/accounting/auth";
import { getErpAdapter } from "@/lib/integrations/erp/abstraction";
import { assertNoNameOnlyMatching, validateMappingProfile } from "@/lib/integrations/erp/mapping";

export function generateIntegrationSecret() {
  return `sci_${crypto.randomBytes(32).toString("base64url")}`;
}

export async function listIntegrationDashboardData() {
  const [clients, devices, mappings, events, syncRuns, entityLinkCount, storeRows] = await Promise.all([
    db.select().from(integrationClients).orderBy(desc(integrationClients.createdAt)).limit(100),
    db.select().from(integrationAgentDevices).orderBy(desc(integrationAgentDevices.lastSeenAt)).limit(100),
    db.select().from(integrationMappingProfiles).orderBy(desc(integrationMappingProfiles.createdAt)).limit(100),
    db.select().from(integrationEvents).orderBy(desc(integrationEvents.createdAt)).limit(50),
    db.select().from(integrationSyncRuns).orderBy(desc(integrationSyncRuns.startedAt)).limit(50),
    db.select({ count: sql<number>`count(*)::int` }).from(integrationEntityLinks),
    db.select({ id: stores.id, name: stores.name, slug: stores.slug }).from(stores).orderBy(stores.name).limit(500)
  ]);
  return { clients, devices, mappings, events, syncRuns, entityLinkCount: Number(entityLinkCount[0]?.count || 0), stores: storeRows };
}

export async function createIntegrationClient(input: {
  clientKey: string;
  name: string;
  provider?: string;
  storeIds?: string[];
  scopes?: string[];
  systemType?: string;
  metadata?: Record<string, unknown>;
}) {
  const apiKey = generateIntegrationSecret();
  const adapter = getErpAdapter(input.systemType || "generic");
  const [client] = await db.insert(integrationClients).values({
    clientKey: input.clientKey,
    name: input.name,
    provider: input.provider || "accounting",
    tokenHash: sha256(apiKey),
    status: "active",
    storeIds: input.storeIds || [],
    scopes: input.scopes?.length ? input.scopes : ["products:read", "inventory:read", "orders:read", "invoices:read", "events:read", "sales_reports:write"],
    metadata: { ...(input.metadata || {}), systemType: input.systemType || "generic", adapter: adapter.displayName }
  }).returning();
  return { client, apiKey };
}

export async function rotateIntegrationClientKey(id: string) {
  const apiKey = generateIntegrationSecret();
  const [client] = await db.update(integrationClients).set({ tokenHash: sha256(apiKey), updatedAt: new Date() }).where(eq(integrationClients.id, id)).returning();
  return { client, apiKey };
}

export async function createMappingProfile(input: {
  clientKey: string;
  storeId?: string | null;
  name: string;
  systemType?: string;
  resource: string;
  direction?: string;
  mapping: Record<string, unknown>;
  sourceOfTruth?: Record<string, unknown>;
  conflictPolicy?: Record<string, unknown>;
  createdBy?: string | null;
}) {
  const mapping = validateMappingProfile(input.mapping);
  assertNoNameOnlyMatching(mapping);
  const [{ maxVersion }] = await db
    .select({ maxVersion: sql<number>`coalesce(max(${integrationMappingProfiles.version}), 0)::int` })
    .from(integrationMappingProfiles)
    .where(eq(integrationMappingProfiles.clientKey, input.clientKey));
  const [profile] = await db.insert(integrationMappingProfiles).values({
    clientKey: input.clientKey,
    storeId: input.storeId || null,
    name: input.name,
    systemType: input.systemType || "generic",
    resource: input.resource,
    direction: input.direction || "bidirectional",
    version: Number(maxVersion || 0) + 1,
    mapping,
    sourceOfTruth: input.sourceOfTruth || {},
    conflictPolicy: input.conflictPolicy || {},
    createdBy: input.createdBy || null
  }).returning();
  return profile;
}
