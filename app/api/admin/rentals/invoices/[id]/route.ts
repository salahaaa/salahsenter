export const dynamic = "force-dynamic";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { markRentalInvoicePaid, rejectRentalInvoicePaymentProof } from "@/lib/rentals/service";
import { assertAdmin } from "@/lib/rbac";

const schema = z.object({
  action: z.enum(["mark_paid", "approve_proof", "reject_proof"]),
  paymentReference: z.string().trim().max(180).optional().nullable(),
  reviewNote: z.string().trim().max(1_500).optional().nullable()
}).superRefine((value, context) => {
  if (value.action === "reject_proof" && !value.reviewNote) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["reviewNote"], message: "سبب رفض الإثبات مطلوب للتاجر" });
  }
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "contracts.manage");
    const payload = schema.parse(await request.json());

    if (payload.action === "reject_proof") {
      const result = await rejectRentalInvoicePaymentProof({ invoiceId: id, actorId: session.userId, reviewNote: payload.reviewNote });
      await writeAuditLog({ actorId: session.userId, action: "update", category: "financial", entityType: "rental.invoice_payment_proof_rejected", entityId: id, beforeData: result.before, afterData: result.invoice });
      return ok({ invoice: result.invoice, message: "تم رفض إثبات السداد وإتاحة رفع إثبات بديل للتاجر" });
    }

    const result = await markRentalInvoicePaid({
      invoiceId: id,
      paymentReference: payload.paymentReference,
      actorId: session.userId,
      reviewNote: payload.reviewNote,
      requirePaymentProof: payload.action === "approve_proof"
    });
    await writeAuditLog({
      actorId: session.userId,
      action: "update",
      category: "financial",
      entityType: payload.action === "approve_proof" ? "rental.invoice_payment_proof_approved" : "rental.invoice_paid_manually",
      entityId: id,
      beforeData: result.before,
      afterData: result.invoice
    });
    return ok({ invoice: result.invoice, message: payload.action === "approve_proof" ? "تم اعتماد إثبات السداد وتفعيل الاتفاق" : "تم تأكيد سداد فاتورة الإيجار" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث فاتورة الإيجار");
  }
}
