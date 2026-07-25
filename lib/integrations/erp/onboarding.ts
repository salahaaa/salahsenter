import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { ApiError } from "@/lib/api";
import {
  db,
  erpConnectorCatalog,
  erpConnectorCertifications,
  erpIntegrationRequestEvents,
  erpIntegrationRequests,
  integrationClients,
  integrationEntityLinks,
  integrationMappingProfiles,
  stores,
  systemSettings,
  users
} from "@/lib/db";
import { createIntegrationClient } from "@/lib/integrations/erp/admin-service";
import { agentCapabilitiesForMode, sourceOfTruthForMode } from "@/lib/integrations/erp/source-of-truth";
import { assertErpOnboardingAction } from "@/lib/integrations/erp/onboarding-policy";

type DbLike = any;
export const ERP_REQUEST_STATUSES = ["pending_review", "under_review", "needs_information", "approved_for_setup", "agent_connected", "mapping_in_progress", "ready_for_certification", "activated", "rejected", "cancelled"] as const;
export type ErpRequestStatus = (typeof ERP_REQUEST_STATUSES)[number];

const genericConnectors = [
  { code: "generic_local_agent", provider: "Generic", displayName: "Generic Local Agent Connector", version: "1.0", systemType: "desktop_erp", connectionModes: ["local_agent", "sql_server", "access", "odbc"], capabilities: { orders: true, inventory: true, invoices: true, heartbeat: true, mapping: true }, status: "active" },
  { code: "generic_cloud_api", provider: "Generic", displayName: "Generic Cloud API Connector", version: "1.0", systemType: "cloud_erp", connectionModes: ["cloud_api", "rest_api"], capabilities: { orders: true, inventory: true, invoices: true, webhooks: false, mapping: true }, status: "active" },
  { code: "generic_file_exchange", provider: "Generic", displayName: "Generic CSV/Excel Exchange Connector", version: "1.0", systemType: "csv_excel", connectionModes: ["file_exchange", "csv_excel"], capabilities: { inventory: true, orders: true, mapping: true, realtime: false }, status: "active" }
] as const;

function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function requestNumber() { return `ERP-REQ-${new Date().getFullYear()}-${nanoid(9).toUpperCase()}`; }
function clientKey(storeId: string) { return `erp-${storeId.slice(0, 8)}-${nanoid(8).toLowerCase()}`; }
function isSetupStatus(status: string) { return ["approved_for_setup", "agent_connected", "mapping_in_progress", "ready_for_certification"].includes(status); }

export async function ensureGenericErpConnectors(tx: DbLike = db) {
  for (const connector of genericConnectors) {
    await tx.insert(erpConnectorCatalog).values({ ...connector, connectionModes: [...connector.connectionModes], capabilities: { ...connector.capabilities } }).onConflictDoNothing({ target: [erpConnectorCatalog.code, erpConnectorCatalog.version] });
  }
}

async function appendRequestEvent(tx: DbLike, input: { requestId: string; actorId?: string | null; action: string; fromStatus?: string | null; toStatus?: string | null; note?: string | null; data?: Record<string, unknown> }) {
  await tx.insert(erpIntegrationRequestEvents).values({ requestId: input.requestId, actorId: input.actorId || null, action: input.action, fromStatus: input.fromStatus || null, toStatus: input.toStatus || null, note: input.note || null, data: input.data || {} });
}

export async function createErpIntegrationRequest(input: {
  storeId: string; merchantId: string; provider: string; erpVersion?: string | null; erpType: string; connectionMethod: string; branchCount: number; warehouseCount: number; businessActivity?: string | null; operationsVolume?: string | null; technicalContact?: Record<string, unknown>; readiness?: Record<string, unknown>; merchantNote?: string | null;
}) {
  return db.transaction(async (tx) => {
    const [store] = await tx.select({ id: stores.id, merchantId: stores.merchantId }).from(stores).where(eq(stores.id, input.storeId)).limit(1);
    if (!store) throw new ApiError("المتجر غير موجود", 404);
    if (store.merchantId !== input.merchantId) throw new ApiError("لا يمكنك طلب ربط ERP لمتجر لا تملكه", 403);
    const [active] = await tx.select({ id: erpIntegrationRequests.id, status: erpIntegrationRequests.status }).from(erpIntegrationRequests).where(and(eq(erpIntegrationRequests.storeId, input.storeId), inArray(erpIntegrationRequests.status, ["pending_review", "under_review", "needs_information", "approved_for_setup", "agent_connected", "mapping_in_progress", "ready_for_certification"]))).orderBy(desc(erpIntegrationRequests.createdAt)).limit(1);
    if (active) throw new ApiError("يوجد طلب ربط ERP مفتوح لهذا المتجر بالفعل", 409);
    const [request] = await tx.insert(erpIntegrationRequests).values({
      requestNumber: requestNumber(), storeId: input.storeId, merchantId: input.merchantId, provider: input.provider.trim(), erpVersion: input.erpVersion?.trim() || null,
      erpType: input.erpType, connectionMethod: input.connectionMethod, branchCount: Math.max(0, Math.floor(input.branchCount)), warehouseCount: Math.max(0, Math.floor(input.warehouseCount)), businessActivity: input.businessActivity?.trim() || null, operationsVolume: input.operationsVolume?.trim() || null,
      technicalContact: input.technicalContact || {}, readiness: input.readiness || {}, merchantNote: input.merchantNote?.trim() || null, status: "pending_review"
    }).returning();
    await appendRequestEvent(tx, { requestId: request.id, actorId: input.merchantId, action: "merchant_requested", toStatus: request.status, data: { provider: request.provider, erpType: request.erpType, connectionMethod: request.connectionMethod } });
    return request;
  });
}

export async function getMerchantErpIntegrationRequests(merchantId: string) {
  const [requests, connectors] = await Promise.all([
    db.select({ request: erpIntegrationRequests, storeName: stores.name, storeNumber: stores.storeNumber, connector: erpConnectorCatalog, clientKey: integrationClients.clientKey, clientName: integrationClients.name, certificationStatus: erpConnectorCertifications.status }).from(erpIntegrationRequests).innerJoin(stores, eq(erpIntegrationRequests.storeId, stores.id)).leftJoin(erpConnectorCatalog, eq(erpIntegrationRequests.connectorCatalogId, erpConnectorCatalog.id)).leftJoin(integrationClients, eq(erpIntegrationRequests.integrationClientId, integrationClients.id)).leftJoin(erpConnectorCertifications, eq(erpIntegrationRequests.certificationId, erpConnectorCertifications.id)).where(eq(erpIntegrationRequests.merchantId, merchantId)).orderBy(desc(erpIntegrationRequests.createdAt)).limit(100),
    (async () => { await ensureGenericErpConnectors(); return db.select().from(erpConnectorCatalog).where(eq(erpConnectorCatalog.status, "active")).orderBy(erpConnectorCatalog.provider, erpConnectorCatalog.displayName).limit(100); })()
  ]);
  const events = requests.length ? await db.select().from(erpIntegrationRequestEvents).where(inArray(erpIntegrationRequestEvents.requestId, requests.map((row) => row.request.id))).orderBy(desc(erpIntegrationRequestEvents.createdAt)).limit(500) : [];
  const eventsByRequest = new Map<string, typeof events>();
  for (const event of events) eventsByRequest.set(event.requestId, [...(eventsByRequest.get(event.requestId) || []), event]);
  return { requests: requests.map((row) => ({ ...row, events: eventsByRequest.get(row.request.id) || [] })), connectors };
}

export async function getAdminErpIntegrationRequests() {
  await ensureGenericErpConnectors();
  const [requests, connectors, certifications] = await Promise.all([
    db.select({ request: erpIntegrationRequests, storeName: stores.name, storeNumber: stores.storeNumber, merchantName: users.fullName, merchantEmail: users.email, connector: erpConnectorCatalog, client: integrationClients, certification: erpConnectorCertifications }).from(erpIntegrationRequests).innerJoin(stores, eq(erpIntegrationRequests.storeId, stores.id)).innerJoin(users, eq(erpIntegrationRequests.merchantId, users.id)).leftJoin(erpConnectorCatalog, eq(erpIntegrationRequests.connectorCatalogId, erpConnectorCatalog.id)).leftJoin(integrationClients, eq(erpIntegrationRequests.integrationClientId, integrationClients.id)).leftJoin(erpConnectorCertifications, eq(erpIntegrationRequests.certificationId, erpConnectorCertifications.id)).orderBy(desc(erpIntegrationRequests.createdAt)).limit(300),
    db.select().from(erpConnectorCatalog).orderBy(desc(erpConnectorCatalog.updatedAt)).limit(300),
    db.select({ id: erpConnectorCertifications.id, integrationClientId: erpConnectorCertifications.integrationClientId, storeId: erpConnectorCertifications.storeId, status: erpConnectorCertifications.status, certifiedAt: erpConnectorCertifications.certifiedAt }).from(erpConnectorCertifications).where(eq(erpConnectorCertifications.status, "certified")).orderBy(desc(erpConnectorCertifications.certifiedAt)).limit(300)
  ]);
  const events = requests.length ? await db.select().from(erpIntegrationRequestEvents).where(inArray(erpIntegrationRequestEvents.requestId, requests.map((row) => row.request.id))).orderBy(desc(erpIntegrationRequestEvents.createdAt)).limit(1_000) : [];
  const eventsByRequest = new Map<string, typeof events>();
  for (const event of events) eventsByRequest.set(event.requestId, [...(eventsByRequest.get(event.requestId) || []), event]);
  return { requests: requests.map((row) => ({ ...row, events: eventsByRequest.get(row.request.id) || [] })), connectors, certifications };
}

export async function upsertErpConnectorCatalog(input: { id?: string | null; code: string; provider: string; displayName: string; version: string; systemType: string; connectionModes: string[]; capabilities: Record<string, boolean>; supportOwner?: string | null; documentationUrl?: string | null; agentPackageUrl?: string | null; packageChecksum?: string | null; status: "draft" | "active" | "deprecated" | "disabled"; actorId: string; metadata?: Record<string, unknown> }) {
  const now = new Date();
  if (input.id) {
    const [before] = await db.select().from(erpConnectorCatalog).where(eq(erpConnectorCatalog.id, input.id)).limit(1);
    if (!before) throw new ApiError("الموصل غير موجود", 404);
    const [connector] = await db.update(erpConnectorCatalog).set({
      code: input.code, provider: input.provider, displayName: input.displayName, version: input.version, systemType: input.systemType,
      connectionModes: input.connectionModes, capabilities: input.capabilities, supportOwner: input.supportOwner || null,
      documentationUrl: input.documentationUrl || null, agentPackageUrl: input.agentPackageUrl || null, packageChecksum: input.packageChecksum || null,
      status: input.status, metadata: input.metadata || before.metadata, updatedBy: input.actorId, updatedAt: now
    }).where(eq(erpConnectorCatalog.id, before.id)).returning();
    return { before, connector };
  }
  const [connector] = await db.insert(erpConnectorCatalog).values({ code: input.code, provider: input.provider, displayName: input.displayName, version: input.version, systemType: input.systemType, connectionModes: input.connectionModes, capabilities: input.capabilities, supportOwner: input.supportOwner || null, documentationUrl: input.documentationUrl || null, agentPackageUrl: input.agentPackageUrl || null, packageChecksum: input.packageChecksum || null, status: input.status, metadata: input.metadata || {}, createdBy: input.actorId, updatedBy: input.actorId }).returning();
  return { before: null, connector };
}

export async function reviewErpIntegrationRequest(input: { requestId: string; actorId: string; action: "start_review" | "request_information" | "assign_connector" | "mark_ready_for_certification" | "reject" | "activate"; connectorCatalogId?: string | null; certificationId?: string | null; assignedTo?: string | null; note?: string | null }) {
  const [before] = await db.select().from(erpIntegrationRequests).where(eq(erpIntegrationRequests.id, input.requestId)).limit(1);
  if (!before) throw new ApiError("طلب الربط غير موجود", 404);
  try { assertErpOnboardingAction(before.status, input.action); }
  catch (error) { throw new ApiError(error instanceof Error ? error.message : "انتقال حالة طلب ERP غير مسموح", 409); }
  const now = new Date();

  if (input.action === "assign_connector") {
    if (!input.connectorCatalogId) throw new ApiError("اختر موصل ERP قبل اعتماد الإعداد", 422);
    const [connector] = await db.select().from(erpConnectorCatalog).where(and(eq(erpConnectorCatalog.id, input.connectorCatalogId), eq(erpConnectorCatalog.status, "active"))).limit(1);
    if (!connector) throw new ApiError("الموصل غير موجود أو غير مفعل", 409);
    let client = before.integrationClientId ? (await db.select().from(integrationClients).where(eq(integrationClients.id, before.integrationClientId)).limit(1))[0] : null;
    let apiKey: string | null = null;
    if (!client) {
      const created = await createIntegrationClient({ clientKey: clientKey(before.storeId), name: `${connector.displayName} — ${before.requestNumber}`, provider: connector.provider, systemType: connector.systemType, storeIds: [before.storeId], scopes: ["products:read", "inventory:read", "inventory:write", "orders:read", "orders:write", "invoices:read", "invoices:write", "events:read", "events:write", "sales_reports:write"], metadata: { onboardingRequestId: before.id, connectorCatalogId: connector.id, providerRequested: before.provider } });
      client = created.client; apiKey = created.apiKey;
    }
    const [request] = await db.update(erpIntegrationRequests).set({ connectorCatalogId: connector.id, integrationClientId: client.id, assignedTo: input.assignedTo || before.assignedTo, reviewedBy: input.actorId, reviewedAt: now, status: "approved_for_setup", adminNote: input.note || before.adminNote, updatedAt: now }).where(eq(erpIntegrationRequests.id, before.id)).returning();
    await db.transaction(async (tx) => appendRequestEvent(tx, { requestId: request.id, actorId: input.actorId, action: "connector_assigned", fromStatus: before.status, toStatus: request.status, note: input.note, data: { connectorId: connector.id, connector: connector.displayName, integrationClientId: client!.id, apiKeyReturnedOnce: Boolean(apiKey) } }));
    return { before, request, client, apiKey, connector };
  }

  if (input.action === "activate") {
    if (!input.certificationId) throw new ApiError("اختر شهادة ERP معتمدة قبل التفعيل", 422);
    const [certification] = await db.select().from(erpConnectorCertifications).where(and(eq(erpConnectorCertifications.id, input.certificationId), eq(erpConnectorCertifications.status, "certified"))).limit(1);
    if (!certification || !before.integrationClientId || certification.integrationClientId !== before.integrationClientId) throw new ApiError("الشهادة المعتمدة لا تطابق عميل التكامل لهذا الطلب", 409);
    if (certification.storeId && certification.storeId !== before.storeId) throw new ApiError("الشهادة لا تتبع المتجر المطلوب", 403);
    const [client] = await db.select().from(integrationClients).where(eq(integrationClients.id, before.integrationClientId)).limit(1);
    if (!client || client.status !== "active") throw new ApiError("عميل التكامل غير فعال", 409);
    const settings = { integrationEnabled: true, integrationMode: "ERP", erpAccess: "admin_enabled", erpProvider: client.provider, integrationClientKey: client.clientKey, certificationId: certification.id, sourceOfTruth: sourceOfTruthForMode("ERP"), agentCapabilities: agentCapabilitiesForMode("ERP"), featureAccess: { code: "erp_connector", state: "admin_grant", billing: "future_paid" }, activatedViaRequestId: before.id, modeChangedBy: input.actorId, modeChangedAt: now.toISOString(), note: input.note || null };
    const result = await db.transaction(async (tx) => {
      await tx.insert(systemSettings).values({ group: `store:${before.storeId}`, key: "integration_settings", value: settings, isPublic: false, updatedBy: input.actorId }).onConflictDoUpdate({ target: [systemSettings.group, systemSettings.key], set: { value: settings, updatedBy: input.actorId, updatedAt: now } });
      const [request] = await tx.update(erpIntegrationRequests).set({ certificationId: certification.id, status: "activated", reviewedBy: input.actorId, reviewedAt: now, activatedBy: input.actorId, activatedAt: now, adminNote: input.note || before.adminNote, updatedAt: now }).where(eq(erpIntegrationRequests.id, before.id)).returning();
      await appendRequestEvent(tx, { requestId: request.id, actorId: input.actorId, action: "erp_mode_activated", fromStatus: before.status, toStatus: request.status, note: input.note, data: { certificationId: certification.id, integrationClientId: client.id } });
      return request;
    });
    return { before, request: result, client, apiKey: null, connector: null };
  }

  if (input.action === "mark_ready_for_certification") {
    const summary = asRecord(before.mappingSummary);
    if (Number(summary.mappedProducts || 0) <= 0 || Number(summary.unmappedProducts || 0) > 0 || Number(summary.warehouses || 0) <= 0) {
      throw new ApiError("لا يمكن إرسال الطلب للشهادة قبل اكتمال mapping المنتجات ووجود مخزن واحد على الأقل وعدم وجود أصناف غير مربوطة", 409);
    }
  }
  const transition: Record<string, ErpRequestStatus> = { start_review: "under_review", request_information: "needs_information", mark_ready_for_certification: "ready_for_certification", reject: "rejected" };
  const nextStatus = transition[input.action];
  if (!nextStatus) throw new ApiError("إجراء الطلب غير مدعوم", 422);
  const [request] = await db.update(erpIntegrationRequests).set({ status: nextStatus, assignedTo: input.assignedTo || before.assignedTo, reviewedBy: input.actorId, reviewedAt: now, adminNote: input.note || before.adminNote, updatedAt: now }).where(eq(erpIntegrationRequests.id, before.id)).returning();
  await db.transaction(async (tx) => appendRequestEvent(tx, { requestId: request.id, actorId: input.actorId, action: input.action, fromStatus: before.status, toStatus: request.status, note: input.note }));
  return { before, request, client: null, apiKey: null, connector: null };
}

export async function markErpRequestAgentConnected(input: { clientKey: string; storeId: string; deviceId: string }) {
  const [request] = await db.select().from(erpIntegrationRequests).innerJoin(integrationClients, eq(erpIntegrationRequests.integrationClientId, integrationClients.id)).where(and(eq(erpIntegrationRequests.storeId, input.storeId), eq(integrationClients.clientKey, input.clientKey), inArray(erpIntegrationRequests.status, ["approved_for_setup", "agent_connected", "mapping_in_progress", "ready_for_certification"]))).orderBy(desc(erpIntegrationRequests.updatedAt)).limit(1).then((rows: any[]) => rows.map((row) => row.erp_integration_requests));
  if (!request) return null;
  if (request.status === "approved_for_setup") {
    const now = new Date();
    const [updated] = await db.update(erpIntegrationRequests).set({ status: "agent_connected", updatedAt: now, readiness: { ...asRecord(request.readiness), agentConnectedAt: now.toISOString(), deviceId: input.deviceId } }).where(eq(erpIntegrationRequests.id, request.id)).returning();
    await db.transaction(async (tx) => appendRequestEvent(tx, { requestId: request.id, action: "agent_connected", fromStatus: request.status, toStatus: updated.status, data: { deviceId: input.deviceId } }));
    return updated;
  }
  return request;
}

export async function recordErpOnboardingMapping(input: { clientKey: string; storeId: string; requestId: string; links: Array<{ entityType: string; platformEntityId?: string | null; externalEntityId: string; externalCode?: string | null; metadata?: Record<string, unknown> }>; summary: { mappedProducts: number; unmappedProducts: number; duplicateProducts?: number; warehouses: number; branches: number; note?: string | null } }) {
  const [request] = await db.select().from(erpIntegrationRequests).innerJoin(integrationClients, eq(erpIntegrationRequests.integrationClientId, integrationClients.id)).where(and(eq(erpIntegrationRequests.id, input.requestId), eq(erpIntegrationRequests.storeId, input.storeId), eq(integrationClients.clientKey, input.clientKey), inArray(erpIntegrationRequests.status, ["agent_connected", "mapping_in_progress", "ready_for_certification"]))).limit(1).then((rows: any[]) => rows.map((row) => row.erp_integration_requests));
  if (!request) throw new ApiError("طلب الإعداد غير صالح لعميل التكامل أو لم يصل إلى مرحلة mapping", 403);
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const link of input.links.slice(0, 500)) {
      if (!link.externalEntityId?.trim()) throw new ApiError("External ID مطلوب لكل عنصر mapping", 422);
      await tx.insert(integrationEntityLinks).values({ provider: "accounting", clientKey: input.clientKey, storeId: input.storeId, entityType: link.entityType, platformEntityId: link.platformEntityId || null, externalEntityId: link.externalEntityId.trim(), externalCode: link.externalCode?.trim() || null, status: "active", lastSyncedAt: now, metadata: link.metadata || {} }).onConflictDoUpdate({ target: [integrationEntityLinks.clientKey, integrationEntityLinks.entityType, integrationEntityLinks.externalEntityId], set: { platformEntityId: link.platformEntityId || null, externalCode: link.externalCode?.trim() || null, metadata: link.metadata || {}, lastSyncedAt: now, updatedAt: now } });
    }
    const ready = Number(input.summary.unmappedProducts || 0) === 0 && Number(input.summary.mappedProducts || 0) > 0 && Number(input.summary.warehouses || 0) > 0;
    const nextStatus: ErpRequestStatus = ready ? "ready_for_certification" : "mapping_in_progress";
    const [updated] = await tx.update(erpIntegrationRequests).set({ status: nextStatus, mappingSummary: { mappedProducts: Math.max(0, input.summary.mappedProducts), unmappedProducts: Math.max(0, input.summary.unmappedProducts), duplicateProducts: Math.max(0, input.summary.duplicateProducts || 0), warehouses: Math.max(0, input.summary.warehouses), branches: Math.max(0, input.summary.branches), note: input.summary.note || null, receivedAt: now.toISOString() }, updatedAt: now }).where(eq(erpIntegrationRequests.id, request.id)).returning();
    await appendRequestEvent(tx, { requestId: request.id, action: "mapping_readiness_received", fromStatus: request.status, toStatus: updated.status, data: { linksReceived: input.links.length, summary: input.summary } });
  });
}
