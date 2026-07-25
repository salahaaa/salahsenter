export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, merchantApplications } from "@/lib/db";
import { merchantApplicationRevisionSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { resolveActivityTemplateForWing } from "@/lib/onboarding/wing-template-assignment";

/** Merchant resubmission is permitted only after an admin explicitly requested data changes. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const session = await requireAuth(); const payload = merchantApplicationRevisionSchema.parse(await request.json());
    const wingTemplate = await resolveActivityTemplateForWing(payload.wingId);
    if (!wingTemplate.ok) return fail(wingTemplate.message, 422);
    const [before] = await db.select().from(merchantApplications).where(and(eq(merchantApplications.id, id), eq(merchantApplications.applicantUserId, session.userId))).limit(1);
    if (!before) return fail("طلب فتح المتجر غير موجود أو لا تملكه", 404);
    if (before.status !== "waiting_for_data") return fail("لا يمكن تعديل الطلب إلا بعد طلب الإدارة تعديلات عليه", 409);
    const [application] = await db.update(merchantApplications).set({ ...payload, activityTemplateKey: wingTemplate.template.key, status: "under_review", adminNote: null, reviewedBy: null, reviewedAt: null, updatedAt: new Date() }).where(eq(merchantApplications.id, before.id)).returning();
    await notifyAdmins({ title: "تمت إعادة إرسال بيانات طلب متجر", body: `أعاد التاجر إرسال بيانات متجر ${application.storeName} بعد طلب التعديل.`, type: "merchant_application_resubmitted", data: { applicationId: application.id, storeName: application.storeName, url: `/admin/merchant-applications/${application.id}` } });
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "merchant_application_resubmitted", entityId: application.id, beforeData: before, afterData: application });
    return ok({ application, message: "تم حفظ التعديل وإعادة الطلب إلى المراجعة" });
  } catch (error) { return handleApiError(error, "تعذر تعديل وإعادة إرسال طلب المتجر"); }
}
