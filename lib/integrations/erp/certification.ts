import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, erpConnectorCertifications, integrationAgentDevices, integrationClients, integrationMappingProfiles, integrationSyncRuns } from "@/lib/db";

type DbLike = any;
const requiredResources = ["products", "inventory", "orders", "invoices"];

export async function buildErpCertificationChecklist(clientId: string, tx: DbLike = db) {
  const [client] = await tx.select().from(integrationClients).where(eq(integrationClients.id, clientId)).limit(1);
  if (!client) throw new Error("عميل ERP غير موجود");
  const [devices, mappings, latestRun] = await Promise.all([
    tx.select().from(integrationAgentDevices).where(eq(integrationAgentDevices.clientKey, client.clientKey)).orderBy(desc(integrationAgentDevices.lastSeenAt)).limit(20),
    tx.select().from(integrationMappingProfiles).where(and(eq(integrationMappingProfiles.clientKey, client.clientKey), eq(integrationMappingProfiles.isActive, true))).limit(100),
    tx.select().from(integrationSyncRuns).where(eq(integrationSyncRuns.clientKey, client.clientKey)).orderBy(desc(integrationSyncRuns.startedAt)).limit(1).then((rows: any[]) => rows[0] || null)
  ]);
  const recentDevice = devices.some((device: any) => device.status === "online" && device.lastSeenAt && Date.now() - new Date(device.lastSeenAt).getTime() < 24 * 60 * 60 * 1000);
  const mappingsByResource = new Map<string, any>(mappings.map((mapping: any) => [String(mapping.resource), mapping] as [string, any]));
  const checklist: Record<string, boolean> = {
    activeClient: client.status === "active",
    scopes: ["products:read", "inventory:read", "orders:write", "invoices:write"].every((scope) => client.scopes.includes(scope)),
    agentSeenLast24h: recentDevice,
    productMapping: Boolean(mappingsByResource.get("products")),
    inventoryMapping: Boolean(mappingsByResource.get("inventory")),
    orderMapping: Boolean(mappingsByResource.get("orders")),
    invoiceMapping: Boolean(mappingsByResource.get("invoices")),
    warehouseMapping: Object.keys(((mappingsByResource.get("inventory")?.mapping as Record<string, any>)?.operational?.warehouses || {})).length > 0,
    branchMapping: Object.keys(((mappingsByResource.get("orders")?.mapping as Record<string, any>)?.operational?.branches || {})).length > 0,
    customerMapping: Object.keys(((mappingsByResource.get("orders")?.mapping as Record<string, any>)?.operational?.customers || {})).length > 0,
    paymentMapping: Object.keys(((mappingsByResource.get("invoices")?.mapping as Record<string, any>)?.operational?.payments || {})).length > 0,
    priceListMapping: Object.keys(((mappingsByResource.get("products")?.mapping as Record<string, any>)?.operational?.priceLists || {})).length > 0,
    conflictPolicies: requiredResources.every((resource) => Object.keys((mappingsByResource.get(resource)?.conflictPolicy || {}) as Record<string, unknown>).length > 0),
    successfulSyncObserved: Boolean(latestRun && latestRun.status === "completed")
  };
  return { client, checklist, evidence: { deviceCount: devices.length, latestDeviceAt: devices[0]?.lastSeenAt || null, latestSyncStatus: latestRun?.status || null, mappingVersions: Object.fromEntries(mappings.map((mapping: any) => [mapping.resource, mapping.version])) } };
}

export async function upsertErpCertification(input: { clientId: string; storeId?: string | null; actorId: string; note?: string | null }) {
  const result = await buildErpCertificationChecklist(input.clientId);
  const allCore = Object.values(result.checklist).every(Boolean);
  const [certification] = await db.insert(erpConnectorCertifications).values({ integrationClientId: input.clientId, storeId: input.storeId || null, status: allCore ? "ready_for_sandbox" : "draft", checklist: result.checklist, evidence: result.evidence, note: input.note || null, reviewedBy: input.actorId, reviewedAt: new Date() }).onConflictDoUpdate({ target: erpConnectorCertifications.integrationClientId, set: { storeId: input.storeId || null, status: allCore ? "ready_for_sandbox" : "draft", checklist: result.checklist, evidence: result.evidence, note: input.note || null, reviewedBy: input.actorId, reviewedAt: new Date(), updatedAt: new Date() } }).returning();
  return { certification, allCore };
}

export async function transitionErpCertification(input: { id: string; action: "certify" | "reject" | "recheck"; actorId: string; note?: string | null }) {
  const [before] = await db.select().from(erpConnectorCertifications).where(eq(erpConnectorCertifications.id, input.id)).limit(1);
  if (!before) throw new Error("شهادة ERP غير موجودة");
  if (input.action === "recheck") return upsertErpCertification({ clientId: before.integrationClientId, storeId: before.storeId, actorId: input.actorId, note: input.note });
  if (input.action === "certify" && !Object.values(before.checklist).every(Boolean)) throw new Error("لا يمكن اعتماد الموصل قبل اجتياز عناصر checklist كافة");
  const now = new Date();
  const [certification] = await db.update(erpConnectorCertifications).set({ status: input.action === "certify" ? "certified" : "rejected", note: input.note || before.note, reviewedBy: input.actorId, reviewedAt: now, certifiedAt: input.action === "certify" ? now : null, updatedAt: now }).where(eq(erpConnectorCertifications.id, before.id)).returning();
  return { certification, allCore: Object.values(certification.checklist).every(Boolean) };
}
