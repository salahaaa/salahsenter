export const dynamic = "force-dynamic";

import { desc, eq, sql } from "drizzle-orm";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, merchantFinancialAccounts, merchantLedgerEntries, merchantPayoutRequests, paymentReceipts, stores } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { customerMoneyMode } from "@/lib/platform-revenue/customer-money-policy";

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "finance.reports.view");
    if (customerMoneyMode() === "merchant_collects") return ok({ customerMoneyMode: "merchant_collects", accounts: [], payouts: [], ledger: [], receiptStats: [], totals: { available: 0, lifetime: 0, payouts: 0 }, message: "دفعات العملاء مباشرة للتجار؛ راجع إيرادات المنصة الموحدة بدلاً من تسويات التجار." });
    const [accounts, payouts, ledger, receiptStats] = await Promise.all([
      db.select({ account: merchantFinancialAccounts, storeName: stores.name }).from(merchantFinancialAccounts).innerJoin(stores, eq(merchantFinancialAccounts.storeId, stores.id)).orderBy(desc(merchantFinancialAccounts.updatedAt)).limit(100),
      db.select({ payout: merchantPayoutRequests, storeName: stores.name }).from(merchantPayoutRequests).innerJoin(stores, eq(merchantPayoutRequests.storeId, stores.id)).orderBy(desc(merchantPayoutRequests.createdAt)).limit(100),
      db.select().from(merchantLedgerEntries).orderBy(desc(merchantLedgerEntries.createdAt)).limit(100),
      db.select({ status: paymentReceipts.status, count: sql<number>`count(*)::int` }).from(paymentReceipts).groupBy(paymentReceipts.status)
    ]);
    const totals = accounts.reduce((acc, row) => ({ available: acc.available + Number(row.account.availableBalance || 0), lifetime: acc.lifetime + Number(row.account.lifetimeEarnings || 0), payouts: acc.payouts + Number(row.account.lifetimePayouts || 0) }), { available: 0, lifetime: 0, payouts: 0 });
    return ok({ customerMoneyMode: customerMoneyMode(), accounts, payouts, ledger, receiptStats, totals });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل المالية");
  }
}
