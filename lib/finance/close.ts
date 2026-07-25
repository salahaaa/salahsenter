import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, financialCloseRuns, integrationFailedSyncs, merchantLedgerEntries, merchantPayoutRequests, orders, paymentReceipts, paymentRefunds, storeRentalInvoices } from "@/lib/db";

type DbLike = any;

export function utcDayRange(value = new Date()) {
  const end = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { start, end };
}

function amount(value: unknown) {
  const result = Number(value || 0);
  return Number.isFinite(result) ? result : 0;
}

export async function calculateFinancialCloseSnapshot(input: { periodStart: Date; periodEnd: Date; tx?: DbLike }) {
  const tx = input.tx || db;
  const within = (column: any) => and(gte(column, input.periodStart), lt(column, input.periodEnd));
  const [sales, payouts, ledger, refunds, pendingReceipts, rentalExposure, failedSyncs] = await Promise.all([
    tx.select({ total: sql<string>`coalesce(sum(${orders.grandTotal}), 0)`, count: sql<number>`count(*)::int` }).from(orders).where(and(inArray(orders.paymentStatus, ["paid"]), within(orders.createdAt))),
    tx.select({ total: sql<string>`coalesce(sum(${merchantPayoutRequests.amount}), 0)`, count: sql<number>`count(*)::int` }).from(merchantPayoutRequests).where(and(eq(merchantPayoutRequests.status, "paid"), within(merchantPayoutRequests.paidAt))),
    tx.select({ credits: sql<string>`coalesce(sum(case when ${merchantLedgerEntries.direction} = 'credit' then ${merchantLedgerEntries.amount} else 0 end), 0)`, debits: sql<string>`coalesce(sum(case when ${merchantLedgerEntries.direction} = 'debit' then ${merchantLedgerEntries.amount} else 0 end), 0)` }).from(merchantLedgerEntries).where(within(merchantLedgerEntries.createdAt)),
    tx.select({ total: sql<string>`coalesce(sum(${paymentRefunds.amount}), 0)`, count: sql<number>`count(*)::int` }).from(paymentRefunds).where(and(eq(paymentRefunds.status, "completed"), within(paymentRefunds.processedAt))),
    tx.select({ count: sql<number>`count(*)::int` }).from(paymentReceipts).where(inArray(paymentReceipts.status, ["pending"])),
    tx.select({ overdue: sql<number>`count(*)::int`, submitted: sql<number>`count(*) filter (where ${storeRentalInvoices.status} = 'payment_submitted')::int` }).from(storeRentalInvoices).where(inArray(storeRentalInvoices.status, ["overdue", "payment_submitted"])),
    tx.select({ count: sql<number>`count(*)::int` }).from(integrationFailedSyncs).where(inArray(integrationFailedSyncs.status, ["open", "retrying"]))
  ]);
  const salesRow = sales[0] || { total: "0", count: 0 };
  const payoutRow = payouts[0] || { total: "0", count: 0 };
  const ledgerRow = ledger[0] || { credits: "0", debits: "0" };
  const refundRow = refunds[0] || { total: "0", count: 0 };
  const totals = {
    paidOrderSales: amount(salesRow.total),
    paidOrders: Number(salesRow.count || 0),
    payoutsPaid: amount(payoutRow.total),
    payoutsCount: Number(payoutRow.count || 0),
    ledgerCredits: amount(ledgerRow.credits),
    ledgerDebits: amount(ledgerRow.debits),
    refundsCompleted: amount(refundRow.total),
    refundsCount: Number(refundRow.count || 0),
    netPlatformObserved: amount(ledgerRow.credits) - amount(ledgerRow.debits)
  };
  const discrepancies = {
    pendingPaymentReceipts: Number(pendingReceipts[0]?.count || 0),
    overdueRentalInvoices: Number(rentalExposure[0]?.overdue || 0),
    rentalProofsPendingReview: Number(rentalExposure[0]?.submitted || 0),
    failedErpSyncs: Number(failedSyncs[0]?.count || 0)
  };
  return { totals, discrepancies };
}

export async function createFinancialCloseRun(input: { periodStart: Date; periodEnd: Date; actorId?: string | null; note?: string | null }) {
  const snapshot = await calculateFinancialCloseSnapshot(input);
  const [run] = await db.insert(financialCloseRuns).values({ periodStart: input.periodStart, periodEnd: input.periodEnd, status: "draft", totals: snapshot.totals, discrepancies: snapshot.discrepancies, note: input.note || null, preparedBy: input.actorId }).onConflictDoUpdate({ target: [financialCloseRuns.periodStart, financialCloseRuns.periodEnd], set: { totals: snapshot.totals, discrepancies: snapshot.discrepancies, note: input.note || null, preparedBy: input.actorId, status: "draft", updatedAt: new Date() } }).returning();
  return run;
}

export async function transitionFinancialCloseRun(input: { id: string; action: "review" | "close" | "reopen"; actorId: string; note?: string | null }) {
  const [before] = await db.select().from(financialCloseRuns).where(eq(financialCloseRuns.id, input.id)).limit(1);
  if (!before) throw new Error("دورة الإقفال المالي غير موجودة");
  if (input.action === "review" && before.status !== "draft") throw new Error("لا يمكن مراجعة الإقفال إلا من حالة draft");
  if (input.action === "close" && before.status !== "reviewed") throw new Error("لا يمكن إقفال الفترة قبل المراجعة");
  if (input.action === "reopen" && before.status !== "closed") throw new Error("إعادة الفتح متاحة لفترة مقفلة فقط");
  const now = new Date();
  const status = input.action === "review" ? "reviewed" : input.action === "close" ? "closed" : "draft";
  const [run] = await db.update(financialCloseRuns).set({
    status,
    note: input.note || before.note,
    reviewedBy: input.action === "review" ? input.actorId : before.reviewedBy,
    reviewedAt: input.action === "review" ? now : before.reviewedAt,
    closedBy: input.action === "close" ? input.actorId : input.action === "reopen" ? null : before.closedBy,
    closedAt: input.action === "close" ? now : input.action === "reopen" ? null : before.closedAt,
    updatedAt: now
  }).where(eq(financialCloseRuns.id, before.id)).returning();
  return { before, run };
}
