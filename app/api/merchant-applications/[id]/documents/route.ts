export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { getCurrentSession, hasRole, requireAuth } from "@/lib/auth";
import { db, merchantApplications, notifications } from "@/lib/db";
import { merchantApplicationDocumentSchema } from "@/lib/validators";
import { safeCompareHash } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";
import { checkIpRateLimit } from "@/lib/rate-limit";
import { attachApplicationDocument, getMerchantApplicationDocuments } from "@/lib/onboarding/merchant-application-documents";

async function canAccessApplication(applicationId: string, token?: string | null) {
  const session = await getCurrentSession();
  const [application] = await db.select().from(merchantApplications).where(eq(merchantApplications.id, applicationId)).limit(1);
  if (!application) return { ok: false as const, status: 404, message: "طلب فتح المتجر غير موجود" };
  if (session && hasRole(session, "super_admin")) return { ok: true as const, session, application };
  if (session?.userId && application.applicantUserId === session.userId) return { ok: true as const, session, application };
  if (safeCompareHash(token, application.contractAccessTokenHash)) return { ok: true as const, session, application };
  return { ok: false as const, status: 403, message: "لا تملك صلاحية الوصول إلى مستندات هذا الطلب" };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const token = new URL(request.url).searchParams.get("token");
    const access = await canAccessApplication(id, token);
    if (!access.ok) return fail(access.message, access.status);
    return ok(await getMerchantApplicationDocuments(id));
  } catch (error) { return handleApiError(error, "تعذر تحميل مستندات الطلب"); }
}

/** Legal onboarding documents must be an owned PDF uploaded to the application folder. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const rate = await checkIpRateLimit("merchant-application:documents", 20, 60 * 60 * 1000);
    if (!rate.allowed) return fail("تم تجاوز حد رفع المستندات مؤقتاً", 429);
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = merchantApplicationDocumentSchema.parse(await request.json());
    const access = await canAccessApplication(id, null);
    if (!access.ok) return fail(access.message, access.status);
    if (!hasRole(session, "super_admin") && access.application.applicantUserId !== session.userId) return fail("لا تملك صلاحية رفع مستندات لهذا الطلب", 403);
    if (!["documents_required", "under_review", "waiting_for_data"].includes(access.application.status)) return fail("لا يمكن رفع الوثائق في حالة الطلب الحالية", 409);
    const result = await attachApplicationDocument({ applicationId: id, userId: session.userId, documentType: payload.documentType, fileUrl: payload.fileUrl, title: payload.title, note: payload.note });
    await db.insert(notifications).values({ userId: access.application.applicantUserId, title: "تم رفع وثيقة لطلب فتح المتجر", body: `تم رفع وثيقة PDF: ${result.requirement.title}. وهي بانتظار مراجعة الإدارة.`, type: "merchant_application_document_uploaded", data: { applicationId: id, documentId: result.document.id, requirementId: result.requirement.id } });
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "merchant_application_document", entityId: result.document.id, afterData: result.document });
    return created({ document: result.document, requirement: result.requirement, message: "تم حفظ وثيقة PDF وهي بانتظار اعتماد الإدارة" });
  } catch (error) { return handleApiError(error, "تعذر رفع المستند"); }
}
