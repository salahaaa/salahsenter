export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { contractEvents, db, merchantContracts } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";

const schema = z.object({ note: z.string().optional(), requestedDays: z.coerce.number().int().positive().optional().default(365) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = schema.parse(await request.json().catch(() => ({})));
    const [before] = await db.select().from(merchantContracts).where(eq(merchantContracts.id, id)).limit(1);
    if (!before) return fail("العقد غير موجود", 404);
    if (before.merchantId !== session.userId && !hasStoreAccess(session, before.storeId)) return fail("لا تملك صلاحية طلب تجديد هذا العقد", 403);
    if (["terminated", "frozen", "renewal_requested"].includes(before.status)) return fail("لا يمكن طلب التجديد في الحالة الحالية", 409);

    const [contract] = await db
      .update(merchantContracts)
      .set({ status: "renewal_requested", metadata: { ...(before.metadata || {}), renewalRequest: { note: payload.note || "", requestedDays: payload.requestedDays, requestedAt: new Date().toISOString(), requestedBy: session.userId } }, updatedAt: new Date() })
      .where(eq(merchantContracts.id, id))
      .returning();

    await db.insert(contractEvents).values({ contractId: id, storeId: before.storeId, actorId: session.userId, action: "renewal_requested", reason: payload.note, beforeData: before, afterData: contract });
    await notifyAdmins({ title: "طلب تجديد عقد من تاجر", body: `طلب التاجر تجديد العقد ${before.contractNumber}`, type: "contract_renewal_requested", data: { contractId: id, storeId: before.storeId, contractNumber: before.contractNumber, requestedDays: payload.requestedDays, note: payload.note } });
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "contract_renewal_request", entityId: id, beforeData: before, afterData: contract });
    return ok({ contract, message: "تم إرسال طلب تجديد العقد للإدارة" });
  } catch (error) {
    return handleApiError(error, "تعذر إرسال طلب تجديد العقد");
  }
}
