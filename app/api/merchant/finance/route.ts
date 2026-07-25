export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, merchantFinancialAccounts, merchantLedgerEntries, merchantPayoutRequests, stores } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { writeAuditLog } from "@/lib/audit";
import { userHasStoreOperation } from "@/lib/rbac";
import { assertPlatformSettlementEnabled, customerMoneyMode } from "@/lib/platform-revenue/customer-money-policy";

const payoutSchema = z.object({ amount: z.coerce.number().positive(), method: z.enum(["bank_transfer", "wallet", "remittance", "cash"]).default("bank_transfer"), destination: z.record(z.unknown()).default({}), note: z.string().optional() });

async function ensureAccount(storeId: string, merchantId: string, currency = "YER") {
  const [existing] = await db.select().from(merchantFinancialAccounts).where(eq(merchantFinancialAccounts.storeId, storeId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(merchantFinancialAccounts).values({ storeId, merchantId, currency }).returning();
  return created;
}

export async function GET() {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return ok({ account: null, ledger: [], payouts: [], customerMoneyMode: customerMoneyMode() });
    if (customerMoneyMode() === "merchant_collects") return ok({ account: null, ledger: [], payouts: [], store: { id: store.id, name: store.name }, customerMoneyMode: "merchant_collects", message: "العميل يدفع للتاجر مباشرة؛ لا يوجد رصيد أو سحب تاجر داخل المنصة." });
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية المتجر", 403);
    if (!(await userHasStoreOperation(session.userId, store.id, "finance.view"))) return fail("لا تملك صلاحية مالية المتجر", 403);
    const account = await ensureAccount(store.id, store.merchantId);
    const [ledger, payouts] = await Promise.all([
      db.select().from(merchantLedgerEntries).where(eq(merchantLedgerEntries.storeId, store.id)).orderBy(desc(merchantLedgerEntries.createdAt)).limit(100),
      db.select().from(merchantPayoutRequests).where(eq(merchantPayoutRequests.storeId, store.id)).orderBy(desc(merchantPayoutRequests.createdAt)).limit(50)
    ]);
    return ok({ account, ledger, payouts, store: { id: store.id, name: store.name } });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل مالية المتجر");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    assertPlatformSettlementEnabled();
    const payload = payoutSchema.parse(await request.json());
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return fail("لا يوجد متجر", 403);
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية المتجر", 403);
    if (!(await userHasStoreOperation(session.userId, store.id, "finance.withdrawals"))) return fail("لا تملك صلاحية مالية المتجر", 403);
    const account = await ensureAccount(store.id, store.merchantId);
    const available = Number(account.availableBalance || 0);
    if (payload.amount > available) return fail("المبلغ المطلوب أكبر من الرصيد المتاح", 409);
    const [payout] = await db.insert(merchantPayoutRequests).values({ storeId: store.id, merchantId: store.merchantId, amount: payload.amount.toString(), currency: account.currency, method: payload.method, destination: payload.destination, note: payload.note }).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "merchant_payout_request", entityId: payout.id, afterData: payout });
    return created({ payout, message: "تم إرسال طلب السحب للإدارة" });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء طلب السحب");
  }
}
