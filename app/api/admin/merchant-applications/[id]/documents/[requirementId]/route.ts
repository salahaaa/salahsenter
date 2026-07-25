export const dynamic = "force-dynamic";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { reviewApplicationDocument } from "@/lib/onboarding/merchant-application-documents";
import { writeAuditLog } from "@/lib/audit";
import { db, merchantApplications, notifications } from "@/lib/db";
import { eq } from "drizzle-orm";

const schema = z.object({ action: z.enum(["approve", "reject", "waive"]), note: z.string().trim().min(3).max(2_000).optional() });
export async function PATCH(request: Request, context: { params: Promise<{ id: string; requirementId: string }> }) {
  try {
    const { id, requirementId } = await context.params; const session = await requireAuth(); await assertAdmin(session, ["merchant_applications.documents.review", "merchant_applications.manage"]);
    const payload = schema.parse(await request.json()); const result = await reviewApplicationDocument({ applicationId: id, requirementId, actorId: session.userId, action: payload.action, note: payload.note });
    const [application] = await db.select().from(merchantApplications).where(eq(merchantApplications.id, id)).limit(1);
    if (application?.applicantUserId) await db.insert(notifications).values({ userId: application.applicantUserId, title: payload.action === "approve" ? "تم اعتماد وثيقة الطلب" : payload.action === "waive" ? "تم إعفاء متطلب وثيقة" : "تم رفض وثيقة الطلب", body: payload.note || `حالة الوثيقة: ${result.requirement.status}`, type: "merchant_application_document_reviewed", data: { applicationId: id, requirementId, status: result.requirement.status } });
    await writeAuditLog({ actorId: session.userId, action: payload.action === "approve" ? "approve" : payload.action === "reject" ? "reject" : "update", entityType: "merchant_application_document_requirement", entityId: requirementId, beforeData: result.before, afterData: result.requirement });
    return ok({ requirement: result.requirement, message: "تم تحديث مراجعة الوثيقة وإنشاء/تحديث فهرس PDF للوثائق" });
  } catch (error) { return handleApiError(error, "تعذر مراجعة وثيقة الطلب"); }
}
