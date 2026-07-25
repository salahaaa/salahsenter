import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import {
  adCampaigns,
  adminWorkAssignments,
  db,
  erpConnectorCertifications,
  integrationFailedSyncs,
  merchantApplications,
  merchantApplicationDocumentRequirements,
  merchantContracts,
  merchantPayoutRequests,
  merchantPlatformStatements,
  merchantSalesReports,
  platformEmployees,
  securityAlerts,
  storeOfferCollections,
  storeLaunchReadiness,
  storeRentalInvoices,
  stores,
  users
} from "@/lib/db";

type Priority = "critical" | "high" | "normal" | "low";

export type AdminWorkItem = {
  workKey: string;
  queue: string;
  priority: Priority;
  entityType: string;
  entityId: string;
  title: string;
  description: string;
  href: string;
  createdAt: Date;
  dueAt: Date;
  assignment: typeof adminWorkAssignments.$inferSelect | null;
};

function deadline(createdAt: Date, hours: number) {
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
}

function makeItem(input: Omit<AdminWorkItem, "workKey" | "assignment">) {
  return { ...input, workKey: `${input.entityType}:${input.entityId}` };
}

export async function getAssignableAdminUsers() {
  return db
    .select({ id: users.id, name: users.fullName, email: users.email })
    .from(platformEmployees)
    .innerJoin(users, eq(platformEmployees.userId, users.id))
    .where(eq(platformEmployees.status, "active"))
    .orderBy(asc(users.fullName))
    .limit(200);
}

export async function getAdminWorkQueue(input: { includeResolved?: boolean; limit?: number } = {}) {
  const now = new Date();
  const contractsSoon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [applications, offers, ads, invoices, payouts, salesReports, platformStatements, documentRequirements, launchReadiness, failedSyncs, alerts, contracts, certifications, assignments] = await Promise.all([
    db.select({ id: merchantApplications.id, storeName: merchantApplications.storeName, status: merchantApplications.status, createdAt: merchantApplications.createdAt }).from(merchantApplications).where(inArray(merchantApplications.status, ["new", "pending", "under_review", "documents_required", "contract_signed", "waiting_final_approval"])).orderBy(merchantApplications.createdAt).limit(200),
    db.select({ id: storeOfferCollections.id, title: storeOfferCollections.title, storeName: stores.name, createdAt: storeOfferCollections.createdAt }).from(storeOfferCollections).innerJoin(stores, eq(storeOfferCollections.storeId, stores.id)).where(eq(storeOfferCollections.status, "pending_review")).orderBy(storeOfferCollections.createdAt).limit(200),
    db.select({ id: adCampaigns.id, name: adCampaigns.name, storeName: stores.name, createdAt: adCampaigns.createdAt }).from(adCampaigns).innerJoin(stores, eq(adCampaigns.storeId, stores.id)).where(inArray(adCampaigns.status, ["pending_review", "submitted", "draft"])).orderBy(adCampaigns.createdAt).limit(200),
    db.select({ id: storeRentalInvoices.id, invoiceNumber: storeRentalInvoices.invoiceNumber, status: storeRentalInvoices.status, storeName: stores.name, createdAt: storeRentalInvoices.createdAt, dueAt: storeRentalInvoices.dueAt }).from(storeRentalInvoices).innerJoin(stores, eq(storeRentalInvoices.storeId, stores.id)).where(inArray(storeRentalInvoices.status, ["payment_submitted", "overdue"])).orderBy(storeRentalInvoices.dueAt).limit(200),
    db.select({ id: merchantPayoutRequests.id, amount: merchantPayoutRequests.amount, currency: merchantPayoutRequests.currency, status: merchantPayoutRequests.status, storeName: stores.name, createdAt: merchantPayoutRequests.createdAt }).from(merchantPayoutRequests).innerJoin(stores, eq(merchantPayoutRequests.storeId, stores.id)).where(inArray(merchantPayoutRequests.status, ["requested", "approved"])).orderBy(merchantPayoutRequests.createdAt).limit(200),
    db.select({ id: merchantSalesReports.id, salesTotal: merchantSalesReports.salesTotal, currency: merchantSalesReports.currency, storeName: stores.name, createdAt: merchantSalesReports.createdAt }).from(merchantSalesReports).innerJoin(stores, eq(merchantSalesReports.storeId, stores.id)).where(eq(merchantSalesReports.status, "submitted")).orderBy(merchantSalesReports.submittedAt).limit(200),
    db.select({ id: merchantPlatformStatements.id, statementNumber: merchantPlatformStatements.statementNumber, status: merchantPlatformStatements.status, storeName: stores.name, createdAt: merchantPlatformStatements.createdAt, dueAt: merchantPlatformStatements.dueAt }).from(merchantPlatformStatements).innerJoin(stores, eq(merchantPlatformStatements.storeId, stores.id)).where(inArray(merchantPlatformStatements.status, ["payment_submitted", "overdue", "awaiting_sales_report"])).orderBy(merchantPlatformStatements.dueAt).limit(200),
    db.select({ id: merchantApplicationDocumentRequirements.id, applicationId: merchantApplicationDocumentRequirements.applicationId, title: merchantApplicationDocumentRequirements.title, status: merchantApplicationDocumentRequirements.status, storeName: merchantApplications.storeName, createdAt: merchantApplicationDocumentRequirements.createdAt }).from(merchantApplicationDocumentRequirements).innerJoin(merchantApplications, eq(merchantApplicationDocumentRequirements.applicationId, merchantApplications.id)).where(inArray(merchantApplicationDocumentRequirements.status, ["uploaded", "rejected"])).orderBy(merchantApplicationDocumentRequirements.updatedAt).limit(200),
    db.select({ id: storeLaunchReadiness.id, storeId: storeLaunchReadiness.storeId, status: storeLaunchReadiness.status, storeName: stores.name, createdAt: storeLaunchReadiness.createdAt, submittedAt: storeLaunchReadiness.submittedAt }).from(storeLaunchReadiness).innerJoin(stores, eq(storeLaunchReadiness.storeId, stores.id)).where(eq(storeLaunchReadiness.status, "submitted")).orderBy(storeLaunchReadiness.submittedAt).limit(200),
    db.select({ id: integrationFailedSyncs.id, resource: integrationFailedSyncs.resource, failureType: integrationFailedSyncs.failureType, status: integrationFailedSyncs.status, createdAt: integrationFailedSyncs.createdAt }).from(integrationFailedSyncs).where(inArray(integrationFailedSyncs.status, ["open", "retrying"])).orderBy(integrationFailedSyncs.createdAt).limit(200),
    db.select({ id: securityAlerts.id, severity: securityAlerts.severity, title: securityAlerts.title, createdAt: securityAlerts.createdAt }).from(securityAlerts).where(eq(securityAlerts.status, "open")).orderBy(desc(securityAlerts.createdAt)).limit(200),
    db.select({ id: merchantContracts.id, contractNumber: merchantContracts.contractNumber, storeName: stores.name, endAt: merchantContracts.endAt, createdAt: merchantContracts.createdAt }).from(merchantContracts).innerJoin(stores, eq(merchantContracts.storeId, stores.id)).where(and(inArray(merchantContracts.status, ["active", "near_expiry", "grace"]), lte(merchantContracts.endAt, contractsSoon))).orderBy(merchantContracts.endAt).limit(200),
    db.select({ id: erpConnectorCertifications.id, status: erpConnectorCertifications.status, createdAt: erpConnectorCertifications.createdAt }).from(erpConnectorCertifications).where(inArray(erpConnectorCertifications.status, ["draft", "ready_for_sandbox", "rejected"])).orderBy(erpConnectorCertifications.updatedAt).limit(200),
    db.select().from(adminWorkAssignments).orderBy(desc(adminWorkAssignments.updatedAt)).limit(2_000)
  ]);

  const assignmentByKey = new Map(assignments.map((assignment) => [assignment.workKey, assignment]));
  const items: AdminWorkItem[] = [
    ...applications.map((row) => makeItem({ queue: "merchant_onboarding", priority: row.status === "waiting_final_approval" ? "high" : "normal", entityType: "merchant_application", entityId: row.id, title: `طلب متجر: ${row.storeName}`, description: `الحالة: ${row.status}`, href: "/admin/merchant-applications", createdAt: row.createdAt, dueAt: deadline(row.createdAt, 24) })),
    ...offers.map((row) => makeItem({ queue: "content_approval", priority: "normal", entityType: "store_offer", entityId: row.id, title: `عرض بانتظار الاعتماد: ${row.title}`, description: row.storeName, href: "/admin/offers", createdAt: row.createdAt, dueAt: deadline(row.createdAt, 24) })),
    ...ads.map((row) => makeItem({ queue: "content_approval", priority: "normal", entityType: "ad_campaign", entityId: row.id, title: `إعلان بانتظار المراجعة: ${row.name}`, description: row.storeName, href: "/admin/ads", createdAt: row.createdAt, dueAt: deadline(row.createdAt, 12) })),
    ...invoices.map((row) => makeItem({ queue: "collections", priority: row.status === "overdue" ? "high" : "normal", entityType: "rental_invoice", entityId: row.id, title: `فاتورة إيجار ${row.invoiceNumber}`, description: `${row.storeName} — ${row.status}`, href: "/admin/rentals", createdAt: row.createdAt, dueAt: row.dueAt || deadline(row.createdAt, 24) })),
    ...payouts.map((row) => makeItem({ queue: "finance", priority: row.status === "approved" ? "high" : "normal", entityType: "merchant_payout", entityId: row.id, title: `طلب سحب ${row.amount} ${row.currency}`, description: `${row.storeName} — ${row.status}`, href: "/admin/finance", createdAt: row.createdAt, dueAt: deadline(row.createdAt, 24) })),
    ...salesReports.map((row) => makeItem({ queue: "platform_revenue", priority: "high", entityType: "merchant_sales_report", entityId: row.id, title: `تقرير مبيعات بانتظار الاعتماد: ${row.storeName}`, description: `إجمالي مُعلن ${row.salesTotal} ${row.currency}`, href: "/admin/platform-revenue", createdAt: row.createdAt, dueAt: deadline(row.createdAt, 24) })),
    ...platformStatements.map((row) => makeItem({ queue: "platform_revenue", priority: row.status === "overdue" ? "high" : "normal", entityType: "platform_revenue_statement", entityId: row.id, title: `كشف منصة ${row.statementNumber}`, description: `${row.storeName} — ${row.status}`, href: "/admin/platform-revenue", createdAt: row.createdAt, dueAt: row.dueAt || deadline(row.createdAt, 24) })),
    ...documentRequirements.map((row) => makeItem({ queue: "merchant_onboarding", priority: row.status === "uploaded" ? "high" : "normal", entityType: "merchant_application_document_requirement", entityId: row.id, title: `وثيقة تحتاج مراجعة: ${row.title}`, description: `${row.storeName} — ${row.status}`, href: `/admin/merchant-applications/${row.applicationId}`, createdAt: row.createdAt, dueAt: deadline(row.createdAt, 24) })),
    ...launchReadiness.map((row) => makeItem({ queue: "merchant_onboarding", priority: "high", entityType: "store_launch_readiness", entityId: row.id, title: `متجر جاهز لمراجعة الإطلاق: ${row.storeName}`, description: "تم إرسال checklist الإطلاق", href: "/admin/store-launch-readiness", createdAt: row.createdAt, dueAt: row.submittedAt || deadline(row.createdAt, 24) })),
    ...failedSyncs.map((row) => makeItem({ queue: "erp_operations", priority: "high", entityType: "integration_failed_sync", entityId: row.id, title: `فشل مزامنة ERP: ${row.resource}`, description: `${row.failureType} — ${row.status}`, href: "/admin/integrations/reconciliation", createdAt: row.createdAt, dueAt: deadline(row.createdAt, 4) })),
    ...alerts.map((row) => makeItem({ queue: "security", priority: row.severity === "critical" ? "critical" : row.severity === "high" ? "high" : "normal", entityType: "security_alert", entityId: row.id, title: row.title, description: `تنبيه أمني: ${row.severity}`, href: "/admin/security", createdAt: row.createdAt, dueAt: deadline(row.createdAt, row.severity === "critical" ? 1 : 8) })),
    ...contracts.map((row) => makeItem({ queue: "contracts", priority: row.endAt <= now ? "high" : "normal", entityType: "merchant_contract", entityId: row.id, title: `عقد قريب الانتهاء: ${row.contractNumber}`, description: `${row.storeName} — ينتهي ${row.endAt.toISOString().slice(0, 10)}`, href: "/admin/contracts?report=near-expiry", createdAt: row.createdAt, dueAt: row.endAt })),
    ...certifications.map((row) => makeItem({ queue: "erp_certification", priority: "normal", entityType: "erp_certification", entityId: row.id, title: "شهادة موصل ERP تحتاج مراجعة", description: `الحالة: ${row.status}`, href: "/admin/integrations/certification", createdAt: row.createdAt, dueAt: deadline(row.createdAt, 48) }))
  ].map((item) => ({ ...item, assignment: assignmentByKey.get(item.workKey) || null }));

  const filtered = input.includeResolved ? items : items.filter((item) => item.assignment?.status !== "resolved" && item.assignment?.status !== "dismissed");
  const priorityRank: Record<Priority, number> = { critical: 0, high: 1, normal: 2, low: 3 };
  return filtered
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.dueAt.getTime() - b.dueAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, Math.max(1, Math.min(input.limit || 500, 1_000)));
}

export async function updateAdminWorkAssignment(input: {
  workKey: string;
  entityType: string;
  entityId: string;
  queue: string;
  priority: Priority;
  status: "open" | "assigned" | "resolved" | "dismissed";
  assignedTo?: string | null;
  actorId: string;
  dueAt?: Date | null;
}) {
  const now = new Date();
  const [assignment] = await db
    .insert(adminWorkAssignments)
    .values({
      workKey: input.workKey,
      entityType: input.entityType,
      entityId: input.entityId,
      queue: input.queue,
      priority: input.priority,
      status: input.status,
      assignedTo: input.assignedTo || null,
      assignedBy: input.assignedTo ? input.actorId : null,
      assignedAt: input.assignedTo ? now : null,
      dueAt: input.dueAt || null,
      resolvedAt: ["resolved", "dismissed"].includes(input.status) ? now : null,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: adminWorkAssignments.workKey,
      set: {
        queue: input.queue,
        priority: input.priority,
        status: input.status,
        assignedTo: input.assignedTo || null,
        assignedBy: input.assignedTo ? input.actorId : null,
        assignedAt: input.assignedTo ? now : null,
        dueAt: input.dueAt || null,
        resolvedAt: ["resolved", "dismissed"].includes(input.status) ? now : null,
        updatedAt: now
      }
    })
    .returning();
  return assignment;
}
