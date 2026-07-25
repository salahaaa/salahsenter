export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, merchantApplications, notifications } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { merchantApplicationReviewSchema } from "@/lib/validators";
import { buildDefaultContract } from "@/lib/contracts";
import { assertApplicationDocumentGate, ensureMerchantApplicationDocumentRequirements } from "@/lib/onboarding/merchant-application-documents";
import { writeAuditLog } from "@/lib/audit";
import { createSecureToken, sha256 } from "@/lib/security";

type Status = typeof merchantApplications.$inferSelect.status;

const transition: Record<string, { from: Status[]; to: Status }> = {
  start_review: { from: ["pending", "new", "waiting_for_data"], to: "under_review" },
  request_documents: { from: ["pending", "new", "under_review", "pre_approved"], to: "documents_required" },
  request_changes: { from: ["pending", "new", "under_review", "pre_approved", "contract_created"], to: "waiting_for_data" },
  pre_approve: { from: ["under_review", "documents_required", "waiting_for_data"], to: "pre_approved" },
  create_contract: { from: ["pre_approved"], to: "contract_created" },
  reject: { from: ["pending", "new", "under_review", "documents_required", "waiting_for_data", "pre_approved", "contract_created", "contract_signed", "waiting_final_approval"], to: "rejected" }
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "merchant_applications.manage");
    const payload = merchantApplicationReviewSchema.parse(await request.json());
    const [before] = await db.select().from(merchantApplications).where(eq(merchantApplications.id, id)).limit(1);
    if (!before) return fail("طلب فتح المتجر غير موجود", 404);

    const rule = transition[payload.action];
    if (!rule.from.includes(before.status)) {
      return fail(`لا يمكن تنفيذ هذا الانتقال من الحالة الحالية: ${before.status}`, 409);
    }

    if (["start_review", "request_documents", "pre_approve"].includes(payload.action)) await ensureMerchantApplicationDocumentRequirements(before.id, session.userId);
    if (["pre_approve", "create_contract"].includes(payload.action)) await assertApplicationDocumentGate(before.id);

    const patch: Partial<typeof merchantApplications.$inferInsert> = {
      status: rule.to,
      adminNote: payload.adminNote,
      reviewedBy: session.userId,
      reviewedAt: new Date(),
      updatedAt: new Date()
    };

    let contractAccessToken: string | null = null;
    if (payload.action === "create_contract") {
      const startAt = new Date();
      const endAt = new Date(startAt);
      endAt.setDate(endAt.getDate() + payload.contractDurationDays);
      patch.onboardingContractNumber = before.onboardingContractNumber || `CTR-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
      patch.contractStartAt = startAt;
      patch.contractEndAt = endAt;
      patch.contractDurationDays = payload.contractDurationDays;
      patch.revenueModel = payload.revenueModel;
      patch.monthlyRent = payload.monthlyRent.toString();
      patch.commissionRate = payload.commissionRate.toString();
      patch.dueDays = payload.dueDays;
      patch.graceDays = payload.graceDays;
      // Legacy subscription fee mirrors monthly rent for old read-only views only.
      patch.subscriptionFee = payload.monthlyRent.toString();
      const contractInput = { ...before, ...patch } as typeof before;
      patch.contractBody = payload.contractBody || before.contractBody || buildDefaultContract(contractInput);
      contractAccessToken = createSecureToken("contract");
      patch.contractAccessTokenHash = sha256(contractAccessToken);
    }

    const [application] = await db.update(merchantApplications).set(patch).where(eq(merchantApplications.id, id)).returning();

    if (application.applicantUserId) {
      const messages: Record<string, string> = {
        start_review: "تم بدء مراجعة طلب فتح المتجر.",
        request_documents: "تحتاج الإدارة إلى مستندات إضافية لإكمال الطلب.",
        request_changes: "يرجى تعديل بيانات طلب فتح المتجر حسب ملاحظات الإدارة.",
        pre_approve: "تم قبول طلبك مبدئياً وسيتم إنشاء العقد.",
        create_contract: "تم إنشاء العقد وإرساله للتوقيع. يرجى مراجعته وتوقيعه إلكترونياً من صفحة العقد.",
        reject: "تم رفض طلب فتح المتجر."
      };
      await db.insert(notifications).values({
        userId: application.applicantUserId,
        title: "تحديث حالة طلب فتح المتجر",
        body: messages[payload.action] || `تم تحديث حالة الطلب إلى ${application.status}`,
        type: "merchant_application_status_updated",
        data: { applicationId: id, status: application.status, action: payload.action, adminNote: payload.adminNote, url: payload.action === "create_contract" ? `/apply-store/${id}/contract${contractAccessToken ? `?token=${encodeURIComponent(contractAccessToken)}` : ""}` : `/apply-store/${id}` }
      });
    }

    await writeAuditLog({ actorId: session.userId, action: payload.action === "reject" ? "reject" : "status_change", entityType: "merchant_application", entityId: id, beforeData: before, afterData: application });
    return ok({ application, contractUrl: contractAccessToken ? `/apply-store/${id}/contract?token=${encodeURIComponent(contractAccessToken)}` : undefined, message: "تم تحديث طلب فتح المتجر بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر مراجعة طلب فتح المتجر");
  }
}
