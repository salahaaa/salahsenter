import crypto from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { ApiError } from "@/lib/api";
import {
  db,
  mediaAssets,
  merchantApplicationDocumentRequirements,
  merchantApplicationDocuments,
  merchantApplications
} from "@/lib/db";
import { createDocumentsManifestPdfArchive } from "@/lib/onboarding/application-pdf-archive";
import { documentPlanForIndependentStore } from "@/lib/merchant/independent-store-policy";

type DbLike = any;

export const defaultMerchantDocumentRequirements = [
  { documentType: "identity", title: "إثبات الهوية", isRequired: true },
  { documentType: "commercial_register", title: "السجل التجاري", isRequired: true },
  { documentType: "tax_card", title: "البطاقة الضريبية", isRequired: true }
] as const;

export async function ensureMerchantApplicationDocumentRequirements(applicationId: string, requestedBy?: string | null, tx: DbLike = db, options: { reuseIdentityFromApplicationId?: string | null } = {}) {
  const requirements = options.reuseIdentityFromApplicationId
    ? documentPlanForIndependentStore(options.reuseIdentityFromApplicationId).map((requirement) => ({
        ...requirement,
        title: requirement.documentType === "identity" ? "إثبات هوية التاجر (معاد استخدامه من ملف معتمد)" : requirement.documentType === "commercial_register" ? "السجل التجاري للنشاط/المتجر الجديد" : "البطاقة الضريبية للنشاط/المتجر الجديد"
      }))
    : defaultMerchantDocumentRequirements.map((requirement) => ({ ...requirement, status: "requested" as const, note: null }));
  for (const requirement of requirements) {
    await tx.insert(merchantApplicationDocumentRequirements).values({ applicationId, ...requirement, requestedBy: requestedBy || null }).onConflictDoNothing({ target: [merchantApplicationDocumentRequirements.applicationId, merchantApplicationDocumentRequirements.documentType] });
  }
  return tx.select().from(merchantApplicationDocumentRequirements).where(eq(merchantApplicationDocumentRequirements.applicationId, applicationId));
}

export async function getMerchantApplicationDocuments(applicationId: string) {
  const [requirements, documents] = await Promise.all([
    db.select().from(merchantApplicationDocumentRequirements).where(eq(merchantApplicationDocumentRequirements.applicationId, applicationId)),
    db.select().from(merchantApplicationDocuments).where(eq(merchantApplicationDocuments.applicationId, applicationId))
  ]);
  const enrichedDocuments = documents.map((document) => ({ ...document, downloadUrl: `/api/merchant-applications/${applicationId}/documents/${document.id}/download` }));
  const documentById = new Map(enrichedDocuments.map((document) => [document.id, document]));
  return { requirements: requirements.map((requirement) => ({ requirement, document: requirement.documentId ? documentById.get(requirement.documentId) || null : null })), documents: enrichedDocuments };
}

export async function assertApplicationDocumentGate(applicationId: string, tx: DbLike = db) {
  const requirements = await tx.select().from(merchantApplicationDocumentRequirements).where(eq(merchantApplicationDocumentRequirements.applicationId, applicationId));
  const unresolved = (requirements as Array<typeof merchantApplicationDocumentRequirements.$inferSelect>).filter((requirement) => requirement.isRequired && !["approved", "waived"].includes(requirement.status));
  if (unresolved.length) throw new ApiError(`لا يمكن متابعة الاعتماد قبل اعتماد الوثائق المطلوبة: ${unresolved.map((item) => item.title).join("، ")}`, 409);
  return requirements;
}

export async function attachApplicationDocument(input: { applicationId: string; userId: string; documentType: string; fileUrl: string; title?: string | null; note?: string | null }) {
  const folderPrefix = `merchant-application-documents/${input.applicationId}/`;
  return db.transaction(async (tx) => {
    const [application] = await tx.select().from(merchantApplications).where(eq(merchantApplications.id, input.applicationId)).limit(1);
    if (!application) throw new ApiError("طلب فتح المتجر غير موجود", 404);
    const [requirement] = await tx.select().from(merchantApplicationDocumentRequirements).where(and(eq(merchantApplicationDocumentRequirements.applicationId, input.applicationId), eq(merchantApplicationDocumentRequirements.documentType, input.documentType))).limit(1);
    if (!requirement) throw new ApiError("نوع الوثيقة غير مطلوب لهذا الطلب", 422);
    if (!["requested", "rejected"].includes(requirement.status)) throw new ApiError("لا يمكن رفع بديل لوثيقة معتمدة أو معفاة", 409);
    const [asset] = await tx.select().from(mediaAssets).where(and(eq(mediaAssets.ownerId, input.userId), eq(mediaAssets.url, input.fileUrl))).limit(1);
    if (!asset || !asset.storageKey?.startsWith(folderPrefix) || asset.mimeType !== "application/pdf") {
      throw new ApiError("ارفع الوثيقة بصيغة PDF من حقل الوثائق المخصص لهذا الطلب", 422);
    }
    const sha256 = typeof asset.metadata?.sha256 === "string" ? asset.metadata.sha256 : crypto.createHash("sha256").update(`${asset.storageKey}:${asset.sizeBytes}:${asset.url}`).digest("hex");
    const [document] = await tx.insert(merchantApplicationDocuments).values({ applicationId: input.applicationId, documentType: input.documentType, title: input.title?.trim() || requirement.title, fileUrl: asset.url, fileName: asset.fileName, note: input.note?.trim() || null, requirementId: requirement.id, mediaAssetId: asset.id, storageKey: asset.storageKey, mimeType: asset.mimeType, sha256, status: "uploaded", uploadedBy: input.userId }).returning();
    const [updatedRequirement] = await tx.update(merchantApplicationDocumentRequirements).set({ status: "uploaded", documentId: document.id, note: null, updatedAt: new Date() }).where(eq(merchantApplicationDocumentRequirements.id, requirement.id)).returning();
    return { application, document, requirement: updatedRequirement };
  });
}

export async function reviewApplicationDocument(input: { applicationId: string; requirementId: string; actorId: string; action: "approve" | "reject" | "waive"; note?: string | null }) {
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [requirement] = await tx.select().from(merchantApplicationDocumentRequirements).where(and(eq(merchantApplicationDocumentRequirements.id, input.requirementId), eq(merchantApplicationDocumentRequirements.applicationId, input.applicationId))).limit(1);
    if (!requirement) throw new ApiError("متطلب الوثيقة غير موجود", 404);
    if (input.action === "approve" && (!requirement.documentId || requirement.status !== "uploaded")) throw new ApiError("لا توجد وثيقة PDF مرفوعة وجاهزة للاعتماد", 409);
    if (input.action === "reject" && !requirement.documentId) throw new ApiError("لا توجد وثيقة مرفوعة لرفضها", 409);
    const nextStatus = input.action === "approve" ? "approved" : input.action === "waive" ? "waived" : "rejected";
    const [updated] = await tx.update(merchantApplicationDocumentRequirements).set({ status: nextStatus, reviewedBy: input.actorId, reviewedAt: now, note: input.note?.trim() || null, updatedAt: now }).where(eq(merchantApplicationDocumentRequirements.id, requirement.id)).returning();
    if (requirement.documentId) await tx.update(merchantApplicationDocuments).set({ status: nextStatus === "approved" ? "approved" : nextStatus === "rejected" ? "rejected" : "waived", reviewedBy: input.actorId, reviewedAt: now, note: input.note?.trim() || null, updatedAt: now }).where(eq(merchantApplicationDocuments.id, requirement.documentId));
    return { before: requirement, requirement: updated };
  });
  // Generates a fresh audit manifest only after the database decision commits.
  await createDocumentsManifestPdfArchive({ applicationId: input.applicationId, generatedBy: input.actorId }).catch(() => undefined);
  return result;
}
