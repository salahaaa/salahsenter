export const dynamic = "force-dynamic";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, merchantFinancialAccounts, merchantLedgerEntries, merchantPayoutRequests } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { assertPlatformSettlementEnabled } from "@/lib/platform-revenue/customer-money-policy";

const schema = z.object({ status: z.enum(["approved", "paid", "rejected", "cancelled"]), note: z.string().optional() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    assertPlatformSettlementEnabled();
    const session = await requireAuth();
    await assertAdminOperation(session, "finance.withdrawals.manage");
    const payload = schema.parse(await request.json());
    const [before] = await db.select().from(merchantPayoutRequests).where(eq(merchantPayoutRequests.id, id)).limit(1);
    if (!before) return fail("طلب السحب غير موجود", 404);
    const transitions: Record<string, string[]> = { requested: ["approved", "rejected", "cancelled"], approved: ["paid", "rejected", "cancelled"] };
    if (!transitions[before.status]?.includes(payload.status)) return fail("انتقال حالة السحب غير مسموح؛ يجب اعتماد الطلب قبل تسجيل التحويل", 409);
    const result = await db.transaction(async (tx) => {
      const [payout] = await tx.update(merchantPayoutRequests).set({ status: payload.status, note: payload.note || before.note, reviewedBy: session.userId, reviewedAt: ["approved", "rejected", "cancelled"].includes(payload.status) ? new Date() : before.reviewedAt, paidAt: payload.status === "paid" ? new Date() : before.paidAt, updatedAt: new Date() }).where(eq(merchantPayoutRequests.id, id)).returning();
      if (payload.status === "paid" && before.status !== "paid") {
        const [account] = await tx.select().from(merchantFinancialAccounts).where(eq(merchantFinancialAccounts.storeId, before.storeId)).limit(1);
        if (!account) throw new Error("حساب التاجر المالي غير موجود");
        const amount = Number(before.amount || 0);
        if (Number(account.availableBalance || 0) < amount) throw new Error("الرصيد المتاح غير كافٍ لإتمام السحب");
        await tx.insert(merchantLedgerEntries).values({ accountId: account.id, storeId: before.storeId, merchantId: before.merchantId, payoutRequestId: before.id, type: "payout", direction: "debit", amount: before.amount, currency: before.currency, description: "Merchant payout paid" }).onConflictDoNothing();
        await tx.update(merchantFinancialAccounts).set({ availableBalance: sql`${merchantFinancialAccounts.availableBalance} - ${amount}`, lifetimePayouts: sql`${merchantFinancialAccounts.lifetimePayouts} + ${amount}`, updatedAt: new Date() }).where(eq(merchantFinancialAccounts.id, account.id));
      }
      return { payout };
    });
    await writeAuditLog({ actorId: session.userId, action: "update", category: "financial", entityType: "financial.merchant_payout_request", entityId: id, beforeData: before, afterData: result });
    return ok({ ...result, message: "تم تحديث طلب السحب" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث طلب السحب");
  }
}
