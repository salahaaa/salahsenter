import crypto from "node:crypto";
import path from "node:path";
import { readFile } from "node:fs/promises";
import PDFDocument from "pdfkit";
import { and, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { ApiError } from "@/lib/api";
import {
  db,
  mediaAssets,
  merchantContractAddendums,
  merchantContractArchives,
  merchantContracts,
  merchantRevenueTerms,
  notifications,
  storeBranchProfiles,
  storeIdentityChangeRequests,
  storeRentalAgreements,
  stores
} from "@/lib/db";
import { uploadInlineImageDataUrl } from "@/lib/media/data-url";
import { uploadMediaFile } from "@/lib/media";
import { createSecureToken, safeCompareHash, sha256 } from "@/lib/security";
import { addendumTitleForIdentityChange, protectedStoreValue, type ProtectedStoreIdentityField } from "@/lib/contracts/identity-policy";
import { createOrUpdateRentalAgreement } from "@/lib/rentals/service";
import { canActivateBranchFinancialCycle, isBranchRevenueModel } from "@/lib/branches/financial-policy";

type DbLike = any;
const fontPath = path.join(process.cwd(), "assets", "fonts", "DejaVuSans.ttf");

export function buildIdentityChangeAddendum(input: { contractNumber: string; storeNumber: string; storeName: string; fieldKey: ProtectedStoreIdentityField; currentValue: string; requestedValue: string; reason: string; version: string }) {
  const label = input.fieldKey === "store_name" ? "الاسم التجاري للمتجر" : "البريد الإلكتروني المعتمد للمتجر";
  return `ملحق عقد لتعديل بيانات متجر

العقد الأصلي: ${input.contractNumber}
رقم المتجر: ${input.storeNumber}
اسم المتجر الحالي: ${input.storeName}
إصدار الملحق: ${input.version}

موضوع الملحق: تعديل ${label}.
القيمة الحالية: ${input.currentValue}.
القيمة المطلوبة: ${input.requestedValue}.
سبب الطلب: ${input.reason}.

لا يسري هذا التعديل إلا بعد توقيع التاجر واعتماد إدارة المنصة للملحق. لا يغير هذا الملحق رقم المتجر أو مالكه أو مستحقات المنصة أو أي بند آخر من العقد الأصلي.

إقرار:
يقر التاجر بأنه راجع التعديل المقترح ويوافق على تطبيقه بعد الاعتماد النهائي.`;
}

function contentHash(value: string) { return crypto.createHash("sha256").update(value, "utf8").digest("hex"); }
function amendmentNumber(contractNumber: string) { return `${contractNumber}-ADD-${nanoid(7).toUpperCase()}`; }

async function renderAddendumPdf(addendum: typeof merchantContractAddendums.$inferSelect, contract: typeof merchantContracts.$inferSelect, store: typeof stores.$inferSelect) {
  const font = await readFile(fontPath);
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 46, info: { Creator: "Yemeni Trade Center", Title: addendum.title } });
    const buffers: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => buffers.push(chunk)); doc.on("end", () => resolve(Buffer.concat(buffers))); doc.on("error", reject);
    doc.registerFont("Arabic", font); doc.font("Arabic");
    const right = (text: string, size = 11, color = "#0f172a") => { doc.font("Arabic").fontSize(size).fillColor(color).text(text, { align: "right", lineGap: 3 }); };
    right(addendum.title, 20, "#0f3b70");
    right(`رقم الملحق: ${addendum.amendmentNumber}`, 12);
    right(`العقد الأصلي: ${contract.contractNumber}`);
    right(`رقم المتجر: ${store.storeNumber}`);
    right(`نسخة الملحق: ${addendum.version}`);
    right(`بصمة المحتوى SHA-256: ${addendum.contentHash}`, 8, "#475569");
    doc.moveDown(1);
    for (const line of addendum.bodySnapshot.split(/\r?\n/)) right(line || " ", 10);
    if (addendum.signedAt) {
      doc.addPage(); right("إقرار التوقيع", 16, "#0f3b70"); right(`الموقّع: ${addendum.signerName || "-"}`); right(`وقت التوقيع: ${addendum.signedAt.toISOString()}`); right("هذه النسخة PDF أرشيفية للملحق الموقع.", 9, "#475569");
    }
    doc.end();
  });
}

async function archiveAddendumPdf(input: { addendum: typeof merchantContractAddendums.$inferSelect; contract: typeof merchantContracts.$inferSelect; store: typeof stores.$inferSelect; generatedBy?: string | null; tx?: DbLike }) {
  const tx = input.tx || db;
  const pdf = await renderAddendumPdf(input.addendum, input.contract, input.store);
  const sha = crypto.createHash("sha256").update(pdf).digest("hex");
  const file = new File([new Uint8Array(pdf)], `contract-addendum-${input.addendum.id}-${input.addendum.version}.pdf`, { type: "application/pdf" });
  const uploaded = await uploadMediaFile(file, `merchant-contract-archives/${input.contract.id}`);
  const [asset] = await tx.insert(mediaAssets).values({ ownerId: input.addendum.merchantId, storeId: input.store.id, provider: uploaded.provider, fileName: uploaded.fileName, mimeType: uploaded.mimeType, sizeBytes: uploaded.sizeBytes, url: uploaded.url, storageKey: uploaded.storageKey, metadata: { ...(uploaded.metadata || {}), contractId: input.contract.id, addendumId: input.addendum.id, sha256: sha, generated: true } }).returning();
  const [archive] = await tx.insert(merchantContractArchives).values({ contractId: input.contract.id, addendumId: input.addendum.id, kind: "signed_addendum_pdf", version: input.addendum.version, status: "ready", mediaAssetId: asset.id, url: asset.url, storageKey: asset.storageKey, sha256: sha, snapshot: { amendmentNumber: input.addendum.amendmentNumber, contentHash: input.addendum.contentHash, signedAt: input.addendum.signedAt?.toISOString() || null }, generatedBy: input.generatedBy || null, generatedAt: new Date(), updatedAt: new Date() }).onConflictDoUpdate({ target: [merchantContractArchives.addendumId, merchantContractArchives.kind, merchantContractArchives.version], set: { status: "ready", mediaAssetId: asset.id, url: asset.url, storageKey: asset.storageKey, sha256: sha, error: null, snapshot: { amendmentNumber: input.addendum.amendmentNumber, contentHash: input.addendum.contentHash, signedAt: input.addendum.signedAt?.toISOString() || null }, generatedBy: input.generatedBy || null, generatedAt: new Date(), updatedAt: new Date() } }).returning();
  return { archive, asset };
}

export function buildBranchFinancialAddendum(input: { contractNumber: string; parentStoreNumber: string; branchStoreNumber: string; branchName: string; address?: string | null; revenueModel: string; monthlyRent: number; commissionRate: number; currency: string; dueDays: number; graceDays: number; startAt: Date; endAt: Date; version: string }) {
  const modelLabel = input.revenueModel === "sales_commission" ? "عمولة مبيعات" : input.revenueModel === "hybrid" ? "إيجار وعمولة" : "إيجار شهري";
  return `ملحق عقد لتشغيل فرع ودورته المالية

العقد الأصلي: ${input.contractNumber}
رقم المتجر الرئيسي: ${input.parentStoreNumber}
رقم الفرع: ${input.branchStoreNumber}
اسم الفرع: ${input.branchName}
العنوان التشغيلي: ${input.address || "يحدد في ملف الفرع"}
إصدار الملحق: ${input.version}

موضوع الملحق: اعتماد تشغيل الفرع وشروط إيراد المنصة المستقلة.
نموذج الإيراد: ${modelLabel}.
الإيجار الشهري: ${input.monthlyRent} ${input.currency}.
نسبة العمولة: ${input.commissionRate}%.
مهلة الاستحقاق: ${input.dueDays} يوم.
فترة السماح: ${input.graceDays} يوم.
بداية شروط الفرع: ${input.startAt.toISOString().slice(0, 10)}.
نهاية شروط الفرع: ${input.endAt.toISOString().slice(0, 10)}.

لا يسري تشغيل الفرع أو استحقاقاته الموحدة إلا بعد توقيع التاجر واعتماد الإدارة لهذا الملحق. تظل مبيعات العملاء وأموالهم للتاجر مباشرة؛ هذا الملحق ينظم فقط استحقاقات المنصة الخاصة بالفرع.`;
}

export async function createBranchFinancialAddendum(input: { branchId: string; actorId: string; revenueModel: "monthly_rent" | "sales_commission" | "hybrid"; monthlyRent: number; commissionRate: number; currency?: string; dueDays?: number; graceDays?: number; note?: string | null }) {
  const [row] = await db.select({ branch: storeBranchProfiles, branchStore: stores }).from(storeBranchProfiles).innerJoin(stores, eq(storeBranchProfiles.storeId, stores.id)).where(eq(storeBranchProfiles.id, input.branchId)).limit(1);
  if (!row) throw new ApiError("طلب الفرع غير موجود", 404);
  const branch = row.branch; const branchStore = row.branchStore;
  if (branch.approvalStatus !== "pending_approval") throw new ApiError("لا يمكن إنشاء ملحق لهذه حالة الفرع", 409);
  if (branch.contractAddendumId) throw new ApiError("يوجد ملحق عقد مرتبط بهذا الفرع بالفعل", 409);
  const parentStoreId = branch.parentStoreId;
  if (!parentStoreId) throw new ApiError("لا يوجد متجر رئيسي للفرع", 409);
  const [[parentStore], [contract]] = await Promise.all([
    db.select().from(stores).where(eq(stores.id, parentStoreId)).limit(1),
    db.select().from(merchantContracts).where(and(eq(merchantContracts.storeId, parentStoreId), eq(merchantContracts.status, "active"))).orderBy(desc(merchantContracts.createdAt)).limit(1)
  ]);
  if (!parentStore || !contract) throw new ApiError("لا يوجد عقد رئيسي فعال يمكن إنشاء ملحق للفرع تحته", 409);
  const now = new Date(); const token = createSecureToken("branch-addendum"); const version = `branch.${Date.now()}`;
  const currency = input.currency || "YER"; const dueDays = Math.max(1, Math.min(90, Math.floor(input.dueDays ?? 7))); const graceDays = Math.max(0, Math.min(90, Math.floor(input.graceDays ?? 7)));
  const body = buildBranchFinancialAddendum({ contractNumber: contract.contractNumber, parentStoreNumber: parentStore.storeNumber, branchStoreNumber: branchStore.storeNumber, branchName: branch.branchName, address: branch.address, revenueModel: input.revenueModel, monthlyRent: Math.max(0, input.monthlyRent), commissionRate: Math.max(0, input.commissionRate), currency, dueDays, graceDays, startAt: now, endAt: contract.endAt, version });
  const result = await db.transaction(async (tx) => {
    const [addendum] = await tx.insert(merchantContractAddendums).values({ contractId: contract.id, storeId: branchStore.id, merchantId: branchStore.merchantId, amendmentNumber: amendmentNumber(contract.contractNumber), version, title: `ملحق تشغيل الفرع: ${branch.branchName}`, reason: input.note || "اعتماد فرع وشروط إيرادات منصة مستقلة", changes: { kind: "branch_financial_terms", branchId: branch.id, branchStoreId: branchStore.id, parentStoreId, parentContractId: contract.id, revenueModel: input.revenueModel, monthlyRent: Math.max(0, input.monthlyRent), commissionRate: Math.max(0, input.commissionRate), currency, dueDays, graceDays, startsAt: now.toISOString(), endsAt: contract.endAt.toISOString() }, bodySnapshot: body, contentHash: contentHash(body), status: "pending_signature", accessTokenHash: sha256(token), createdBy: input.actorId }).returning();
    const [updatedBranch] = await tx.update(storeBranchProfiles).set({ approvalStatus: "awaiting_addendum_signature", financialMode: "platform_revenue", revenueModel: input.revenueModel, rentAmount: Math.max(0, input.monthlyRent).toString(), rentCurrency: currency, commissionRate: Math.max(0, input.commissionRate).toString(), dueDays, graceDays, parentContractId: contract.id, contractAddendumId: addendum.id, adminNote: input.note || null, approvedBy: input.actorId, approvedAt: now, updatedAt: now }).where(eq(storeBranchProfiles.id, branch.id)).returning();
    return { addendum, branch: updatedBranch };
  });
  await db.insert(notifications).values({ userId: branchStore.merchantId, storeId: branchStore.id, title: "ملحق عقد فرع بانتظار توقيعك", body: `راجِع ووقّع ملحق تشغيل الفرع ${branch.branchName} لإكمال تفعيله ودورته المالية.`, type: "branch_contract_addendum_signature_requested", data: { branchId: branch.id, addendumId: result.addendum.id, url: `/merchant/contract-addendums/${result.addendum.id}?token=${encodeURIComponent(token)}` } });
  return { ...result, accessToken: token };
}

export async function activateSignedBranchFinancialAddendum(input: { addendumId: string; actorId: string; note?: string | null }) {
  const [before] = await db.select().from(merchantContractAddendums).where(eq(merchantContractAddendums.id, input.addendumId)).limit(1);
  if (!before) throw new ApiError("ملحق العقد غير موجود", 404);
  if (before.status !== "signed") throw new ApiError("لا يمكن اعتماد ملحق فرع غير موقع", 409);
  const [archive] = await db.select({ id: merchantContractArchives.id }).from(merchantContractArchives).where(and(eq(merchantContractArchives.addendumId, before.id), eq(merchantContractArchives.kind, "signed_addendum_pdf"), eq(merchantContractArchives.version, before.version), eq(merchantContractArchives.status, "ready"))).limit(1);
  if (!archive) throw new ApiError("أرشيف PDF للملحق الموقع غير جاهز", 409);
  const changes = before.changes || {}; if (changes.kind !== "branch_financial_terms" || typeof changes.branchId !== "string") throw new ApiError("هذا الملحق ليس ملحقاً مالياً لفرع", 422);
  const branchId = changes.branchId; const model = String(changes.revenueModel || "monthly_rent"); if (!isBranchRevenueModel(model)) throw new ApiError("نموذج إيراد الفرع غير صالح", 422);
  const now = new Date();
  return db.transaction(async (tx) => {
    const [branch] = await tx.select().from(storeBranchProfiles).where(and(eq(storeBranchProfiles.id, branchId), eq(storeBranchProfiles.contractAddendumId, before.id))).limit(1);
    if (!branch || !canActivateBranchFinancialCycle({ branchStatus: branch.approvalStatus, addendumStatus: before.status, signedPdfReady: Boolean(archive) })) throw new ApiError("حالة الفرع أو ملحقه لا تسمح بتفعيل الدورة المالية", 409);
    const [branchStore] = await tx.select().from(stores).where(eq(stores.id, branch.storeId)).limit(1);
    if (!branchStore) throw new ApiError("متجر الفرع غير موجود", 404);
    const monthlyRent = Math.max(0, Number(changes.monthlyRent || 0)); const commissionRate = Math.max(0, Number(changes.commissionRate || 0)); const currency = String(changes.currency || "YER"); const dueDays = Math.max(1, Math.min(90, Number(changes.dueDays || 7))); const graceDays = Math.max(0, Math.min(90, Number(changes.graceDays || 7))); const contractEndsAt = typeof changes.endsAt === "string" && !Number.isNaN(new Date(changes.endsAt).getTime()) ? new Date(changes.endsAt) : null;
    const [existingTerms] = await tx.select().from(merchantRevenueTerms).where(eq(merchantRevenueTerms.storeId, branchStore.id)).limit(1);
    const termValues = { merchantId: branchStore.merchantId, contractId: before.contractId, model, monthlyRent: monthlyRent.toFixed(2), commissionRate: commissionRate.toFixed(3), currency, dueDays, graceDays, status: "active", startsAt: now, endsAt: contractEndsAt, version: existingTerms ? existingTerms.version + 1 : 1, metadata: { source: "branch_contract_addendum", branchId, addendumId: before.id, consolidatedBilling: true }, createdBy: existingTerms?.createdBy || input.actorId, updatedBy: input.actorId, updatedAt: now };
    const [terms] = existingTerms ? await tx.update(merchantRevenueTerms).set(termValues).where(eq(merchantRevenueTerms.id, existingTerms.id)).returning() : await tx.insert(merchantRevenueTerms).values({ storeId: branchStore.id, ...termValues }).returning();
    const rental = await createOrUpdateRentalAgreement({ storeId: branchStore.id, merchantId: branchStore.merchantId, contractId: before.contractId, baseRent: monthlyRent, currency, billingCycle: "monthly", graceDays, startsAt: now, endsAt: contractEndsAt, status: "active", createdBy: input.actorId, tx });
    await tx.update(storeRentalAgreements).set({ consolidatedBilling: true, metadata: { ...(rental.metadata || {}), source: "branch_contract_addendum", addendumId: before.id }, updatedAt: now }).where(eq(storeRentalAgreements.id, rental.id));
    const [updatedBranch] = await tx.update(storeBranchProfiles).set({ approvalStatus: "approved", rentStatus: "active", rentStartsAt: now, nextRentDueAt: null, revenueTermsId: terms.id, approvedBy: input.actorId, approvedAt: now, adminNote: input.note || branch.adminNote, updatedAt: now }).where(eq(storeBranchProfiles.id, branch.id)).returning();
    const [store] = await tx.update(stores).set({ status: "active", isActive: true, updatedAt: now }).where(eq(stores.id, branchStore.id)).returning();
    const [addendum] = await tx.update(merchantContractAddendums).set({ status: "active", approvedBy: input.actorId, approvedAt: now, updatedAt: now }).where(eq(merchantContractAddendums.id, before.id)).returning();
    return { before, addendum, branch: updatedBranch, store, terms, rental };
  });
}

export async function createIdentityChangeAddendum(input: { requestId: string; actorId: string; note?: string | null }) {
  const [request] = await db.select().from(storeIdentityChangeRequests).where(eq(storeIdentityChangeRequests.id, input.requestId)).limit(1);
  if (!request) throw new ApiError("طلب تعديل هوية المتجر غير موجود", 404);
  if (request.status !== "pending_review") throw new ApiError("لا يمكن إنشاء ملحق لهذه الحالة", 409);
  const [store] = await db.select().from(stores).where(eq(stores.id, request.storeId)).limit(1);
  if (!store) throw new ApiError("المتجر غير موجود", 404);
  const [contract] = await db.select().from(merchantContracts).where(and(eq(merchantContracts.storeId, store.id), eq(merchantContracts.status, "active"))).orderBy(desc(merchantContracts.createdAt)).limit(1);
  if (!contract) throw new ApiError("لا يوجد عقد متجر فعال لإنشاء ملحق", 409);
  const fieldKey = request.fieldKey as ProtectedStoreIdentityField;
  if (!(["store_name", "contact_email"] as string[]).includes(fieldKey)) throw new ApiError("حقل هوية متجر غير مدعوم", 422);
  const token = createSecureToken("addendum"); const version = `1.${Date.now()}`;
  const body = buildIdentityChangeAddendum({ contractNumber: contract.contractNumber, storeNumber: store.storeNumber, storeName: store.name, fieldKey, currentValue: String((request.currentValue || {}).value || ""), requestedValue: String((request.requestedValue || {}).value || ""), reason: request.reason, version });
  const result = await db.transaction(async (tx) => {
    const [addendum] = await tx.insert(merchantContractAddendums).values({ contractId: contract.id, storeId: store.id, merchantId: store.merchantId, amendmentNumber: amendmentNumber(contract.contractNumber), version, title: addendumTitleForIdentityChange(fieldKey), reason: input.note || request.reason, changes: { fieldKey, currentValue: request.currentValue, requestedValue: request.requestedValue, identityRequestId: request.id }, bodySnapshot: body, contentHash: contentHash(body), status: "pending_signature", accessTokenHash: sha256(token), createdBy: input.actorId }).returning();
    const [updatedRequest] = await tx.update(storeIdentityChangeRequests).set({ status: "awaiting_addendum_signature", addendumId: addendum.id, reviewedBy: input.actorId, reviewedAt: new Date(), adminNote: input.note || null, updatedAt: new Date() }).where(eq(storeIdentityChangeRequests.id, request.id)).returning();
    return { addendum, request: updatedRequest };
  });
  await db.insert(notifications).values({ userId: request.merchantId, storeId: request.storeId, title: "ملحق عقد بانتظار توقيعك", body: "راجِع ملحق تعديل بيانات المتجر ووقّعه لإكمال الطلب.", type: "contract_addendum_signature_requested", data: { addendumId: result.addendum.id, requestId: request.id, url: `/merchant/contract-addendums/${result.addendum.id}?token=${encodeURIComponent(token)}` } });
  return { ...result, accessToken: token };
}

export async function signContractAddendum(input: { addendumId: string; merchantId: string | null; token?: string | null; signerName: string; signatureDataUrl: string; version: string }) {
  const [before] = await db.select().from(merchantContractAddendums).where(eq(merchantContractAddendums.id, input.addendumId)).limit(1);
  if (!before) throw new ApiError("ملحق العقد غير موجود", 404);
  const hasAccess = input.merchantId === before.merchantId || safeCompareHash(input.token, before.accessTokenHash);
  if (!hasAccess) throw new ApiError("لا تملك صلاحية توقيع هذا الملحق", 403);
  if (before.status !== "pending_signature") throw new ApiError("لا يمكن توقيع الملحق بهذه الحالة", 409);
  if (input.version !== before.version) throw new ApiError("نسخة الملحق لا تطابق النسخة الصادرة من الإدارة", 409);
  const uploadedSignature = await uploadInlineImageDataUrl({ dataUrl: input.signatureDataUrl, folder: `contracts/addendums/${before.id}`, fileNamePrefix: `addendum-signature-${before.id}` });
  const now = new Date();
  const [addendum] = await db.update(merchantContractAddendums).set({ status: "signed", signerName: input.signerName, signatureUrl: uploadedSignature.url, signedAt: now, signedSnapshot: { signerName: input.signerName, signatureUrl: uploadedSignature.url, signedAt: now.toISOString(), contentHash: before.contentHash, version: before.version }, updatedAt: now }).where(eq(merchantContractAddendums.id, before.id)).returning();
  const [contract] = await db.select().from(merchantContracts).where(eq(merchantContracts.id, addendum.contractId)).limit(1);
  const [store] = await db.select().from(stores).where(eq(stores.id, addendum.storeId)).limit(1);
  if (contract && store) await createAddendumPdfArchive({ addendumId: addendum.id, generatedBy: input.merchantId });
  return { before, addendum };
}

export async function createAddendumPdfArchive(input: { addendumId: string; generatedBy?: string | null }) {
  const [addendum] = await db.select().from(merchantContractAddendums).where(eq(merchantContractAddendums.id, input.addendumId)).limit(1);
  if (!addendum) throw new ApiError("ملحق العقد غير موجود", 404);
  const [[contract], [store]] = await Promise.all([
    db.select().from(merchantContracts).where(eq(merchantContracts.id, addendum.contractId)).limit(1),
    db.select().from(stores).where(eq(stores.id, addendum.storeId)).limit(1)
  ]);
  if (!contract || !store) throw new ApiError("بيانات العقد أو المتجر غير مكتملة", 409);
  try {
    return await archiveAddendumPdf({ addendum, contract, store, generatedBy: input.generatedBy });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.insert(merchantContractArchives).values({ contractId: contract.id, addendumId: addendum.id, kind: "signed_addendum_pdf", version: addendum.version, status: "failed", error: message.slice(0, 2000), snapshot: { amendmentNumber: addendum.amendmentNumber, contentHash: addendum.contentHash }, generatedBy: input.generatedBy || null, updatedAt: new Date() }).onConflictDoUpdate({ target: [merchantContractArchives.addendumId, merchantContractArchives.kind, merchantContractArchives.version], set: { status: "failed", error: message.slice(0, 2000), updatedAt: new Date() } });
    throw error;
  }
}

export async function activateSignedIdentityAddendum(input: { addendumId: string; actorId: string; note?: string | null }) {
  const [before] = await db.select().from(merchantContractAddendums).where(eq(merchantContractAddendums.id, input.addendumId)).limit(1);
  if (!before) throw new ApiError("ملحق العقد غير موجود", 404);
  if (before.status !== "signed") throw new ApiError("لا يمكن اعتماد ملحق غير موقع", 409);
  const [archive] = await db.select({ id: merchantContractArchives.id }).from(merchantContractArchives).where(and(eq(merchantContractArchives.addendumId, before.id), eq(merchantContractArchives.kind, "signed_addendum_pdf"), eq(merchantContractArchives.version, before.version), eq(merchantContractArchives.status, "ready"))).limit(1);
  if (!archive) throw new ApiError("أرشيف PDF للملحق الموقع غير جاهز. أعد توليد الأرشيف قبل اعتماد التعديل.", 409);
  const changes = before.changes || {}; const requestId = typeof changes.identityRequestId === "string" ? changes.identityRequestId : null; const fieldKey = changes.fieldKey as ProtectedStoreIdentityField; const requestedValue = String((changes.requestedValue as any)?.value || "").trim();
  if (!requestId || !requestedValue || !(["store_name", "contact_email"] as string[]).includes(fieldKey)) throw new ApiError("بيانات ملحق الهوية غير مكتملة", 409);
  const now = new Date();
  return db.transaction(async (tx) => {
    const [request] = await tx.select().from(storeIdentityChangeRequests).where(and(eq(storeIdentityChangeRequests.id, requestId), eq(storeIdentityChangeRequests.addendumId, before.id))).limit(1);
    if (!request || request.status !== "awaiting_addendum_signature") throw new ApiError("طلب تغيير الهوية لا يطابق حالة الملحق", 409);
    const [store] = await tx.select().from(stores).where(eq(stores.id, before.storeId)).limit(1);
    if (!store) throw new ApiError("المتجر غير موجود", 404);
    const [updatedStore] = fieldKey === "store_name"
      ? await tx.update(stores).set({ name: requestedValue, updatedAt: now }).where(eq(stores.id, store.id)).returning()
      : await tx.update(stores).set({ contactEmail: requestedValue.toLowerCase(), updatedAt: now }).where(eq(stores.id, store.id)).returning();
    const [addendum] = await tx.update(merchantContractAddendums).set({ status: "active", approvedBy: input.actorId, approvedAt: now, updatedAt: now }).where(eq(merchantContractAddendums.id, before.id)).returning();
    const [updatedRequest] = await tx.update(storeIdentityChangeRequests).set({ status: "approved", reviewedBy: input.actorId, reviewedAt: now, adminNote: input.note || request.adminNote, updatedAt: now }).where(eq(storeIdentityChangeRequests.id, request.id)).returning();
    return { before, addendum, request: updatedRequest, store: updatedStore };
  });
}

export async function getMerchantIdentityChangeRequests(merchantId: string) {
  const rows = await db.select({ request: storeIdentityChangeRequests, storeName: stores.name, storeNumber: stores.storeNumber, addendum: merchantContractAddendums }).from(storeIdentityChangeRequests).innerJoin(stores, eq(storeIdentityChangeRequests.storeId, stores.id)).leftJoin(merchantContractAddendums, eq(storeIdentityChangeRequests.addendumId, merchantContractAddendums.id)).where(eq(storeIdentityChangeRequests.merchantId, merchantId)).orderBy(desc(storeIdentityChangeRequests.createdAt)).limit(100);
  return { requests: rows };
}

export async function getAdminIdentityChangeRequests() {
  return db.select({ request: storeIdentityChangeRequests, storeName: stores.name, storeNumber: stores.storeNumber, addendum: merchantContractAddendums }).from(storeIdentityChangeRequests).innerJoin(stores, eq(storeIdentityChangeRequests.storeId, stores.id)).leftJoin(merchantContractAddendums, eq(storeIdentityChangeRequests.addendumId, merchantContractAddendums.id)).orderBy(desc(storeIdentityChangeRequests.createdAt)).limit(300);
}

export async function createStoreIdentityChangeRequest(input: { storeId: string; merchantId: string; fieldKey: ProtectedStoreIdentityField; requestedValue: string; reason: string }) {
  const [store] = await db.select().from(stores).where(and(eq(stores.id, input.storeId), eq(stores.merchantId, input.merchantId))).limit(1);
  if (!store) throw new ApiError("المتجر غير موجود أو لا تملكه", 404);
  const current = protectedStoreValue({ fieldKey: input.fieldKey, store });
  if (current.trim().toLowerCase() === input.requestedValue.trim().toLowerCase()) throw new ApiError("القيمة المطلوبة مطابقة للقيمة الحالية", 422);
  const [open] = await db.select({ id: storeIdentityChangeRequests.id }).from(storeIdentityChangeRequests).where(and(eq(storeIdentityChangeRequests.storeId, store.id), eq(storeIdentityChangeRequests.fieldKey, input.fieldKey), inArray(storeIdentityChangeRequests.status, ["pending_review", "awaiting_addendum_signature"]))).limit(1);
  if (open) throw new ApiError("يوجد طلب مفتوح لتعديل هذا الحقل بالفعل", 409);
  const [request] = await db.insert(storeIdentityChangeRequests).values({ storeId: store.id, merchantId: input.merchantId, fieldKey: input.fieldKey, currentValue: { value: current }, requestedValue: { value: input.requestedValue.trim() }, reason: input.reason, status: "pending_review" }).returning();
  return { request, store };
}
