export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { getCurrentSession, hasRole } from "@/lib/auth";
import { db, merchantApplications, notifications } from "@/lib/db";
import { buildDefaultContract, contractBodyHash } from "@/lib/contracts";
import { createSignedContractPdfArchive } from "@/lib/onboarding/application-pdf-archive";
import { contractSignatureSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";
import { safeCompareHash } from "@/lib/security";
import { checkIpRateLimit } from "@/lib/rate-limit";
import { uploadPrivateInlineImageDataUrl } from "@/lib/media/data-url";

function canAccessContract(input: {
  token?: string | null;
  tokenHash?: string | null;
  applicantUserId?: string | null;
  session: Awaited<ReturnType<typeof getCurrentSession>>;
}) {
  if (input.session && hasRole(input.session, "super_admin")) return true;
  if (input.session?.userId && input.applicantUserId && input.session.userId === input.applicantUserId) return true;
  return safeCompareHash(input.token, input.tokenHash);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getCurrentSession();
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const [application] = await db.select().from(merchantApplications).where(eq(merchantApplications.id, params.id)).limit(1);
    if (!application) return fail("طلب فتح المتجر غير موجود", 404);
    if (!canAccessContract({ token, tokenHash: application.contractAccessTokenHash, applicantUserId: application.applicantUserId, session })) {
      return fail("لا تملك صلاحية الوصول إلى هذا العقد", 403);
    }
    if (!["contract_created", "contract_signed", "waiting_final_approval", "approved", "active"].includes(application.status)) {
      return fail("لم يتم إرسال العقد للتوقيع بعد", 409);
    }
    const contractBody = application.contractBody || buildDefaultContract(application);
    return ok({
      application: {
        id: application.id,
        storeName: application.storeName,
        applicantName: application.applicantName,
        applicantEmail: application.applicantEmail,
        businessActivity: application.businessActivity,
        status: application.status,
        contractTitle: application.contractTitle,
        contractVersion: application.contractVersion,
        contractAcceptedAt: application.contractAcceptedAt,
        contractSignatureDataUrl: application.contractSignatureDataUrl
      },
      contractBody
    });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل العقد");
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const rate = await checkIpRateLimit("merchant-contract:sign", 10, 60 * 60 * 1000);
    if (!rate.allowed) return fail("تم تجاوز حد محاولات توقيع العقد مؤقتاً", 429);
    const session = await getCurrentSession();
    const raw = await request.json();
    const token = raw.token as string | undefined;
    const payload = contractSignatureSchema.parse(raw);
    const [application] = await db.select().from(merchantApplications).where(eq(merchantApplications.id, params.id)).limit(1);
    if (!application) return fail("طلب فتح المتجر غير موجود", 404);
    if (!canAccessContract({ token, tokenHash: application.contractAccessTokenHash, applicantUserId: application.applicantUserId, session })) {
      return fail("لا تملك صلاحية توقيع هذا العقد", 403);
    }
    if (application.status !== "contract_created") return fail("لا يمكن توقيع العقد في هذه المرحلة؛ اطلب من الإدارة إصدار نسخة جديدة عند الحاجة", 409);
    if (payload.contractVersion !== application.contractVersion) return fail("نسخة العقد المرسلة للتوقيع لا تطابق النسخة الصادرة من الإدارة", 409);

    const contractBody = application.contractBody || buildDefaultContract(application);
    const contractHash = contractBodyHash(contractBody);
    const uploadedSignature = await uploadPrivateInlineImageDataUrl({
      dataUrl: payload.signatureDataUrl,
      folder: `contracts/${application.id}`,
      fileNamePrefix: `signature-${application.id}-${Date.now()}`
    });
    const signatureUrl = uploadedSignature.url;
    const snapshot = {
      applicationId: application.id,
      storeName: application.storeName,
      applicantName: application.applicantName,
      applicantEmail: application.applicantEmail,
      applicantPhone: application.applicantPhone,
      businessActivity: application.businessActivity,
      wingId: application.wingId,
      location: {
        countryId: application.countryId,
        governorateId: application.governorateId,
        cityId: application.cityId,
        districtId: application.districtId
      },
      contractTitle: application.contractTitle,
      contractVersion: payload.contractVersion,
      contractBody,
      contractHash,
      signerName: payload.signerName,
      signatureUrl,
      signedAt: new Date().toISOString()
    };

    const [updated] = await db
      .update(merchantApplications)
      .set({
        status: "waiting_final_approval",
        contractBody,
        contractVersion: payload.contractVersion,
        contractAcceptedAt: new Date(),
        contractSignatureDataUrl: signatureUrl,
        signedContractSnapshot: snapshot,
        updatedAt: new Date()
      })
      .where(eq(merchantApplications.id, application.id))
      .returning();

    if (application.applicantUserId) {
      await db.insert(notifications).values({
        userId: application.applicantUserId,
        title: "تم توقيع عقد فتح المتجر",
        body: "تم استلام العقد الموقّع، والطلب الآن بانتظار الموافقة النهائية من الأدمن.",
        type: "merchant_contract_signed",
        data: { applicationId: application.id, status: "waiting_final_approval" }
      });
    }

    let archive: { archive?: unknown } | null = null;
    try { archive = await createSignedContractPdfArchive({ applicationId: application.id, generatedBy: session?.userId || application.applicantUserId }); }
    catch (archiveError) { console.error("Signed contract PDF archive generation failed", archiveError); }
    await writeAuditLog({ actorId: session?.userId || null, action: "update", entityType: "merchant_application_contract", entityId: application.id, beforeData: application, afterData: { application: updated, signedContractPdfArchiveReady: Boolean(archive?.archive) } });
    return ok({ application: updated, archive: archive?.archive || null, message: archive?.archive ? "تم حفظ العقد والتوقيع وأرشيف PDF محلياً، والطلب الآن بانتظار الموافقة النهائية." : "تم حفظ العقد والتوقيع. أرشيف PDF قيد إعادة المحاولة من الإدارة." });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ العقد الموقّع");
  }
}
