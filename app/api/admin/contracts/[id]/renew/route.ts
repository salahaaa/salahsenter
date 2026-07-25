export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { contractEvents, db, merchantContracts, notifications, stores } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ days: z.coerce.number().int().positive().default(365), reason: z.string().optional() });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "contracts.manage");
    const payload = schema.parse(await request.json().catch(() => ({})));
    const [before] = await db.select().from(merchantContracts).where(eq(merchantContracts.id, id)).limit(1);
    if (!before) return fail("العقد غير موجود", 404);
    const base = before.endAt > new Date() ? before.endAt : new Date();
    const newEnd = new Date(base);
    newEnd.setDate(newEnd.getDate() + payload.days);
    const [contract] = await db.update(merchantContracts).set({ status: "active", endAt: newEnd, graceEndsAt: null, lastRenewedAt: new Date(), updatedAt: new Date() }).where(eq(merchantContracts.id, id)).returning();
    await db.update(stores).set({ status: "active", isActive: true, updatedAt: new Date() }).where(eq(stores.id, contract.storeId));
    await db.insert(contractEvents).values({ contractId: id, storeId: contract.storeId, actorId: session.userId, action: "renewed", reason: payload.reason, beforeData: before, afterData: contract });
    await db.insert(notifications).values({ userId: contract.merchantId, storeId: contract.storeId, title: "تم تجديد عقد المتجر", body: `تم تجديد العقد ${contract.contractNumber} حتى ${newEnd.toISOString()}`, type: "contract_renewed", data: { contractId: id, endAt: newEnd.toISOString() } });
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "merchant_contract", entityId: id, beforeData: before, afterData: contract });
    return ok({ contract, message: "تم تجديد العقد بنجاح" });
  } catch (error) { return handleApiError(error, "تعذر تجديد العقد"); }
}
