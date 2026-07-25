export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db, mediaAssets } from "@/lib/db";
import { checkIpRateLimit } from "@/lib/rate-limit";
import { submitRentalInvoicePaymentProof } from "@/lib/rentals/service";
import { requiredUrlOrPathSchema } from "@/lib/validators";

const proofSchema = z.object({
  proofUrl: requiredUrlOrPathSchema,
  paymentReference: z.string().trim().max(180).optional().nullable(),
  note: z.string().trim().max(1_500).optional().nullable()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const rate = await checkIpRateLimit("rental:payment-proof", 15, 15 * 60 * 1000);
    if (!rate.allowed) return fail("تم تجاوز حد إرسال إثباتات السداد مؤقتًا. حاول لاحقًا.", 429);

    const payload = proofSchema.parse(await request.json());
    const [asset] = await db
      .select({ id: mediaAssets.id, url: mediaAssets.url, storageKey: mediaAssets.storageKey, mimeType: mediaAssets.mimeType })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.ownerId, session.userId), eq(mediaAssets.url, payload.proofUrl)))
      .limit(1);

    if (!asset || !asset.storageKey?.startsWith("rental-payment-proofs/")) {
      return fail("ارفع الإثبات من حقل الرفع المخصص لهذه الفاتورة قبل الإرسال", 422);
    }
    if (!(asset.mimeType?.startsWith("image/") || asset.mimeType === "application/pdf")) {
      return fail("صيغة إثبات السداد يجب أن تكون صورة أو PDF", 422);
    }

    const result = await submitRentalInvoicePaymentProof({
      invoiceId: id,
      merchantId: session.userId,
      assetId: asset.id,
      proofUrl: asset.url,
      storageKey: asset.storageKey,
      paymentReference: payload.paymentReference,
      note: payload.note
    });
    await writeAuditLog({
      actorId: session.userId,
      action: "create",
      category: "financial",
      entityType: "rental.invoice_payment_proof_submitted",
      entityId: result.invoice.id,
      beforeData: result.before,
      afterData: { invoice: result.invoice, mediaAssetId: asset.id }
    });
    return created({ invoice: result.invoice, message: "تم إرسال إثبات السداد للإدارة للمراجعة" });
  } catch (error) {
    return handleApiError(error, "تعذر إرسال إثبات سداد الإيجار");
  }
}
