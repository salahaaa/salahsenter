import crypto from "node:crypto";
import path from "node:path";
import { readFile } from "node:fs/promises";
import PDFDocument from "pdfkit";
import { and, eq } from "drizzle-orm";
import {
  db,
  mediaAssets,
  merchantApplicationArchives,
  merchantApplicationDocumentRequirements,
  merchantApplications,
  merchantApplicationDocuments
} from "@/lib/db";
import { privateDocumentKeyFromUrl, readPrivateDocument, uploadPrivateDocumentBuffer } from "@/lib/private-documents-storage";

type DbLike = any;
const fontPath = path.join(process.cwd(), "assets", "fonts", "DejaVuSans.ttf");

async function renderPdf(draw: (doc: PDFKit.PDFDocument) => Promise<void> | void) {
  const font = await readFile(fontPath);
  return new Promise<Buffer>(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 46, info: { Creator: "Yemeni Trade Center", Producer: "Yemeni Trade Center Onboarding Archive" } });
      const parts: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => parts.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(parts)));
      doc.on("error", reject);
      doc.registerFont("Arabic", font);
      doc.font("Arabic");
      await draw(doc);
      doc.end();
    } catch (error) { reject(error); }
  });
}

function rightText(doc: PDFKit.PDFDocument, value: string, options: Record<string, unknown> = {}) {
  doc.font("Arabic").fontSize(Number(options.fontSize || 11)).fillColor(String(options.color || "#0f172a"));
  doc.text(value, { align: "right", ...options });
}

function safeText(value: unknown) { return String(value || "-").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " "); }

async function signatureBuffer(url: string | null | undefined) {
  if (!url) return null;
  try {
    const privateKey = privateDocumentKeyFromUrl(url);
    if (privateKey) return await readPrivateDocument(privateKey);
    if (url.startsWith("/uploads/")) return await readFile(path.join(process.cwd(), "public", url));
    if (/^https:\/\//.test(url)) {
      const response = await fetch(url);
      if (response.ok) return Buffer.from(await response.arrayBuffer());
    }
  } catch {
    // A missing preview image must never make the signed text archive disappear.
  }
  return null;
}

export async function renderSignedContractPdf(input: { application: typeof merchantApplications.$inferSelect; contractBody: string }) {
  const application = input.application;
  const signedSnapshot = application.signedContractSnapshot || {};
  const snapshotHash = crypto.createHash("sha256").update(JSON.stringify(signedSnapshot)).digest("hex");
  const signature = await signatureBuffer(application.contractSignatureDataUrl);
  return renderPdf(async (doc) => {
    rightText(doc, "العقد الموقّع لفتح متجر", { fontSize: 20, color: "#0f3b70" });
    rightText(doc, `رقم عقد الطلب: ${safeText(application.onboardingContractNumber)}`, { fontSize: 12 });
    rightText(doc, `اسم المتجر: ${safeText(application.storeName)}`);
    rightText(doc, `مقدم الطلب: ${safeText(application.applicantName)}`);
    rightText(doc, `البريد المعتمد: ${safeText(application.applicantEmail)}`);
    rightText(doc, `إصدار العقد: ${safeText(application.contractVersion)}`);
    rightText(doc, `تاريخ التوقيع: ${application.contractAcceptedAt ? application.contractAcceptedAt.toISOString() : "-"}`);
    rightText(doc, `بصمة نسخة التوقيع SHA-256: ${snapshotHash}`, { fontSize: 8, color: "#475569" });
    doc.moveDown(1);
    rightText(doc, "نص العقد", { fontSize: 15, color: "#0f3b70" });
    for (const line of input.contractBody.split(/\r?\n/)) {
      rightText(doc, line || " ", { fontSize: 10, lineGap: 3 });
    }
    doc.addPage();
    rightText(doc, "إقرار التوقيع", { fontSize: 16, color: "#0f3b70" });
    rightText(doc, `الموقّع: ${safeText((signedSnapshot as Record<string, unknown>).signerName || application.applicantName)}`);
    rightText(doc, `تم حفظ التوقيع في: ${application.contractAcceptedAt ? application.contractAcceptedAt.toISOString() : "-"}`);
    if (signature) {
      try { doc.image(signature, 190, 180, { fit: [220, 120], align: "center" }); }
      catch { rightText(doc, "تم حفظ التوقيع الإلكتروني، وتعذر تضمين معاينته في هذه الصفحة."); }
    } else rightText(doc, "تم حفظ مرجع التوقيع الإلكتروني ضمن بيانات العقد.");
    rightText(doc, "هذه النسخة أرشيف تشغيلي للعقد الموقّع. تعتمد سلامتها على snapshot وبصمة المحتوى أعلاه وسياسة الاحتفاظ المعتمدة.", { fontSize: 9, color: "#475569", lineGap: 4 });
  });
}

export async function renderDocumentsManifestPdf(input: { application: typeof merchantApplications.$inferSelect; requirements: Array<typeof merchantApplicationDocumentRequirements.$inferSelect>; documents: Array<typeof merchantApplicationDocuments.$inferSelect> }) {
  return renderPdf((doc) => {
    rightText(doc, "فهرس الوثائق الثبوتية لطلب فتح متجر", { fontSize: 19, color: "#0f3b70" });
    rightText(doc, `المتجر: ${safeText(input.application.storeName)}`);
    rightText(doc, `مقدم الطلب: ${safeText(input.application.applicantName)}`);
    rightText(doc, `رقم الطلب: ${input.application.id}`, { fontSize: 9, color: "#475569" });
    doc.moveDown(1);
    for (const requirement of input.requirements) {
      const document = requirement.documentId ? input.documents.find((item) => item.id === requirement.documentId) : null;
      rightText(doc, `${requirement.title} — ${requirement.status}`, { fontSize: 12, color: requirement.status === "approved" ? "#047857" : "#92400e" });
      rightText(doc, `النوع: ${requirement.documentType} | إلزامي: ${requirement.isRequired ? "نعم" : "لا"}`, { fontSize: 9 });
      if (document) {
        rightText(doc, `الملف: ${safeText(document.fileName || document.storageKey || document.fileUrl)}`, { fontSize: 9 });
        rightText(doc, `SHA-256: ${safeText(document.sha256 || "غير متاح")}`, { fontSize: 8, color: "#475569" });
      }
      if (requirement.note) rightText(doc, `ملاحظة: ${requirement.note}`, { fontSize: 9 });
      doc.moveDown(0.6);
    }
    rightText(doc, "الوثائق الأصلية تحفظ كملفات PDF منفصلة في storage المنصة. هذا الملف فهرس تدقيقي يثبت المتطلبات وحالاتها وبصمات الملفات.", { fontSize: 9, color: "#475569" });
  });
}

async function persistArchive(input: { application: typeof merchantApplications.$inferSelect; kind: "signed_contract_pdf" | "documents_manifest_pdf"; version: string; pdf: Buffer; snapshot: Record<string, unknown>; generatedBy?: string | null; tx?: DbLike }) {
  const tx = input.tx || db;
  const sha256 = crypto.createHash("sha256").update(input.pdf).digest("hex");
  const uploaded = await uploadPrivateDocumentBuffer({ buffer: input.pdf, fileName: `${input.kind}-${input.application.id}-${input.version}.pdf`, mimeType: "application/pdf", folder: `merchant-application-archives/${input.application.id}` });
  const [asset] = await tx.insert(mediaAssets).values({ ownerId: input.application.applicantUserId || null, storeId: null, provider: uploaded.provider, fileName: uploaded.fileName, mimeType: uploaded.mimeType, sizeBytes: uploaded.sizeBytes, url: uploaded.url, storageKey: uploaded.storageKey, metadata: { applicationId: input.application.id, archiveKind: input.kind, sha256, generated: true, privateDocument: true } }).returning();
  const [archive] = await tx.insert(merchantApplicationArchives).values({ applicationId: input.application.id, kind: input.kind, version: input.version, status: "ready", mediaAssetId: asset.id, url: asset.url, storageKey: asset.storageKey, sha256, snapshot: input.snapshot, generatedBy: input.generatedBy || null, generatedAt: new Date(), updatedAt: new Date() }).onConflictDoUpdate({ target: [merchantApplicationArchives.applicationId, merchantApplicationArchives.kind, merchantApplicationArchives.version], set: { status: "ready", mediaAssetId: asset.id, url: asset.url, storageKey: asset.storageKey, sha256, snapshot: input.snapshot, error: null, generatedBy: input.generatedBy || null, generatedAt: new Date(), updatedAt: new Date() } }).returning();
  return { archive, asset };
}

export async function createSignedContractPdfArchive(input: { applicationId: string; generatedBy?: string | null }) {
  const [application] = await db.select().from(merchantApplications).where(eq(merchantApplications.id, input.applicationId)).limit(1);
  if (!application || !application.contractAcceptedAt || !application.contractSignatureDataUrl) throw new Error("لا يمكن أرشفة PDF قبل حفظ العقد والتوقيع");
  const contractBody = application.contractBody || "";
  try {
    const pdf = await renderSignedContractPdf({ application, contractBody });
    return await persistArchive({ application, kind: "signed_contract_pdf", version: application.contractVersion, pdf, snapshot: { contractVersion: application.contractVersion, signedAt: application.contractAcceptedAt.toISOString(), signedSnapshot: application.signedContractSnapshot || {} }, generatedBy: input.generatedBy });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.insert(merchantApplicationArchives).values({ applicationId: application.id, kind: "signed_contract_pdf", version: application.contractVersion, status: "failed", error: message.slice(0, 2_000), snapshot: { contractVersion: application.contractVersion }, generatedBy: input.generatedBy || null, updatedAt: new Date() }).onConflictDoUpdate({ target: [merchantApplicationArchives.applicationId, merchantApplicationArchives.kind, merchantApplicationArchives.version], set: { status: "failed", error: message.slice(0, 2_000), updatedAt: new Date() } });
    throw error;
  }
}

export async function createDocumentsManifestPdfArchive(input: { applicationId: string; generatedBy?: string | null }) {
  const [application] = await db.select().from(merchantApplications).where(eq(merchantApplications.id, input.applicationId)).limit(1);
  if (!application) throw new Error("طلب فتح المتجر غير موجود");
  const [requirements, documents] = await Promise.all([
    db.select().from(merchantApplicationDocumentRequirements).where(eq(merchantApplicationDocumentRequirements.applicationId, application.id)),
    db.select().from(merchantApplicationDocuments).where(eq(merchantApplicationDocuments.applicationId, application.id))
  ]);
  const version = String(Math.max(1, requirements.length));
  const pdf = await renderDocumentsManifestPdf({ application, requirements, documents });
  return persistArchive({ application, kind: "documents_manifest_pdf", version, pdf, snapshot: { generatedAt: new Date().toISOString(), requirements: requirements.map((item) => ({ id: item.id, type: item.documentType, status: item.status, documentId: item.documentId })), documentIds: documents.map((item) => item.id) }, generatedBy: input.generatedBy });
}
