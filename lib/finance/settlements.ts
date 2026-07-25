import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { commissionRules, db, merchantFinancialAccounts, merchantLedgerEntries, orderPayments, orders, stores } from "@/lib/db";

type DbLike = any;

async function ensureAccount(tx: DbLike, input: { storeId: string; merchantId: string; currency: string }) {
  const [existing] = await tx.select().from(merchantFinancialAccounts).where(eq(merchantFinancialAccounts.storeId, input.storeId)).limit(1);
  if (existing) return existing;
  const [created] = await tx.insert(merchantFinancialAccounts).values({ storeId: input.storeId, merchantId: input.merchantId, currency: input.currency }).returning();
  return created;
}

async function getCommissionRule(tx: DbLike, storeId: string) {
  const now = new Date();
  const [store] = await tx.select({ primaryWingId: stores.primaryWingId }).from(stores).where(eq(stores.id, storeId)).limit(1);
  const [rule] = await tx
    .select()
    .from(commissionRules)
    .where(and(
      eq(commissionRules.isActive, true),
      or(eq(commissionRules.storeId, storeId), store?.primaryWingId ? eq(commissionRules.wingId, store.primaryWingId) : sql`false`, eq(commissionRules.scope, "platform")),
      or(isNull(commissionRules.startsAt), lte(commissionRules.startsAt, now)),
      or(isNull(commissionRules.endsAt), gte(commissionRules.endsAt, now))
    ))
    .orderBy(desc(commissionRules.priority))
    .limit(1);
  return rule || null;
}

function clampCommission(amount: number, rule: any) {
  const rateAmount = amount * (Number(rule?.rate || 0) / 100);
  let commission = rateAmount + Number(rule?.fixedFee || 0);
  if (rule?.minCommission != null) commission = Math.max(commission, Number(rule.minCommission));
  if (rule?.maxCommission != null) commission = Math.min(commission, Number(rule.maxCommission));
  return Math.max(0, Number(commission.toFixed(2)));
}

export async function settleClosedPaidOrder(tx: DbLike, orderId: string, actorId?: string | null) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.statusCode !== "closed" || order.paymentStatus !== "paid") return { settled: false, reason: "not_closed_paid" };
  const [existing] = await tx.select({ id: merchantLedgerEntries.id }).from(merchantLedgerEntries).where(and(eq(merchantLedgerEntries.orderId, order.id), eq(merchantLedgerEntries.type, "order_net"))).limit(1);
  if (existing) return { settled: false, reason: "already_settled" };
  const [store] = await tx.select({ merchantId: stores.merchantId }).from(stores).where(eq(stores.id, order.storeId)).limit(1);
  if (!store) return { settled: false, reason: "store_missing" };
  const [payment] = await tx.select().from(orderPayments).where(eq(orderPayments.orderId, order.id)).limit(1);
  const gross = Number(order.grandTotal || 0);
  const rule = await getCommissionRule(tx, order.storeId);
  const commission = clampCommission(gross, rule);
  const net = Number((gross - commission).toFixed(2));
  const account = await ensureAccount(tx, { storeId: order.storeId, merchantId: store.merchantId, currency: order.currency });

  await tx.insert(merchantLedgerEntries).values([
    { accountId: account.id, storeId: order.storeId, merchantId: store.merchantId, orderId: order.id, orderPaymentId: payment?.id || null, type: "order_gross", direction: "credit", amount: gross.toString(), currency: order.currency, description: `Gross order ${order.orderNumber}`, metadata: { actorId } },
    { accountId: account.id, storeId: order.storeId, merchantId: store.merchantId, orderId: order.id, orderPaymentId: payment?.id || null, type: "commission", direction: "debit", amount: commission.toString(), currency: order.currency, description: `Platform commission for ${order.orderNumber}`, metadata: { ruleId: rule?.id || null } },
    { accountId: account.id, storeId: order.storeId, merchantId: store.merchantId, orderId: order.id, orderPaymentId: payment?.id || null, type: "order_net", direction: "credit", amount: net.toString(), currency: order.currency, description: `Net settlement ${order.orderNumber}` }
  ]).onConflictDoNothing();

  await tx.update(merchantFinancialAccounts).set({ availableBalance: sql`${merchantFinancialAccounts.availableBalance} + ${net}`, lifetimeEarnings: sql`${merchantFinancialAccounts.lifetimeEarnings} + ${gross}`, updatedAt: new Date() }).where(eq(merchantFinancialAccounts.id, account.id));
  return { settled: true, gross, commission, net, accountId: account.id };
}

export async function recordRefundLedger(tx: DbLike, input: { orderId: string; amount: number; reason?: string }) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (!order) return { recorded: false, reason: "order_missing" };
  const [store] = await tx.select({ merchantId: stores.merchantId }).from(stores).where(eq(stores.id, order.storeId)).limit(1);
  if (!store) return { recorded: false, reason: "store_missing" };
  const account = await ensureAccount(tx, { storeId: order.storeId, merchantId: store.merchantId, currency: order.currency });
  const amount = Math.max(0, Number(input.amount || 0));
  if (!amount) return { recorded: false, reason: "zero_amount" };
  await tx.insert(merchantLedgerEntries).values({ accountId: account.id, storeId: order.storeId, merchantId: store.merchantId, orderId: order.id, type: "refund", direction: "debit", amount: amount.toString(), currency: order.currency, description: input.reason || `Refund for ${order.orderNumber}` }).onConflictDoNothing();
  await tx.update(merchantFinancialAccounts).set({ availableBalance: sql`${merchantFinancialAccounts.availableBalance} - ${amount}`, updatedAt: new Date() }).where(eq(merchantFinancialAccounts.id, account.id));
  return { recorded: true, amount };
}
