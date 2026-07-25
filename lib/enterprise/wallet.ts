import { and, desc, eq, sql } from "drizzle-orm";
import { db, cashbackTransactions, rewardPoints, rewardTransactions, systemSettings, walletTransactions, wallets } from "@/lib/db";

export type LoyaltySettings = {
  earnPointsPerAmount: number;
  earnAmountStep: number;
  pointToWalletRate: number;
  cashbackPercent: number;
};

export const defaultLoyaltySettings: LoyaltySettings = {
  earnPointsPerAmount: 10,
  earnAmountStep: 100,
  pointToWalletRate: 1,
  cashbackPercent: 0
};

export async function getLoyaltySettings(): Promise<LoyaltySettings> {
  try {
    const [setting] = await db.select().from(systemSettings).where(and(eq(systemSettings.group, "wallet"), eq(systemSettings.key, "loyalty_settings"))).limit(1);
    return { ...defaultLoyaltySettings, ...((setting?.value || {}) as Partial<LoyaltySettings>) };
  } catch {
    return defaultLoyaltySettings;
  }
}

export async function ensureWallet(userId: string) {
  const [existing] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(wallets).values({ userId, balance: "0", availableBalance: "0" }).returning();
  await db.insert(rewardPoints).values({ userId }).onConflictDoNothing();
  return created;
}

export async function getWalletDashboard(userId: string) {
  const wallet = await ensureWallet(userId);
  const [points] = await db.select().from(rewardPoints).where(eq(rewardPoints.userId, userId)).limit(1);
  const [transactions, rewards, settings] = await Promise.all([
    db.select().from(walletTransactions).where(eq(walletTransactions.walletId, wallet.id)).orderBy(desc(walletTransactions.createdAt)).limit(50),
    db.select().from(rewardTransactions).where(eq(rewardTransactions.userId, userId)).orderBy(desc(rewardTransactions.createdAt)).limit(50),
    getLoyaltySettings()
  ]);
  return { wallet, points: points || null, transactions, rewards, settings };
}

export async function creditWallet(input: { userId: string; amount: number; type: string; description?: string; referenceType?: string; referenceId?: string; metadata?: Record<string, unknown> }) {
  const wallet = await ensureWallet(input.userId);
  const amount = Number(input.amount || 0);
  if (amount <= 0) throw new Error("المبلغ يجب أن يكون أكبر من صفر");
  const [updated] = await db
    .update(wallets)
    .set({
      balance: sql`${wallets.balance} + ${amount}`,
      availableBalance: sql`${wallets.availableBalance} + ${amount}`,
      updatedAt: new Date()
    })
    .where(eq(wallets.id, wallet.id))
    .returning();
  await db.insert(walletTransactions).values({ walletId: wallet.id, userId: input.userId, amount: amount.toString(), type: input.type, description: input.description, referenceType: input.referenceType, referenceId: input.referenceId, metadata: input.metadata || {} });
  return updated;
}

export async function awardLoyaltyForOrder(input: { userId: string; orderId: string; amount: number; currency?: string }) {
  const settings = await getLoyaltySettings();
  const points = Math.floor((Number(input.amount || 0) / settings.earnAmountStep) * settings.earnPointsPerAmount);
  await db.insert(rewardPoints).values({ userId: input.userId, pointsBalance: points, lifetimeEarned: points }).onConflictDoUpdate({ target: rewardPoints.userId, set: { pointsBalance: sql`${rewardPoints.pointsBalance} + ${points}`, lifetimeEarned: sql`${rewardPoints.lifetimeEarned} + ${points}`, updatedAt: new Date() } });
  if (points > 0) await db.insert(rewardTransactions).values({ userId: input.userId, type: "earn_order", points, referenceType: "order", referenceId: input.orderId, description: "نقاط مكتسبة من عملية شراء" });
  if (settings.cashbackPercent > 0) {
    const wallet = await ensureWallet(input.userId);
    const cashback = Number(input.amount || 0) * (settings.cashbackPercent / 100);
    await db.insert(cashbackTransactions).values({ userId: input.userId, walletId: wallet.id, orderId: input.orderId, amount: cashback.toString(), currency: input.currency || wallet.currency, percentage: settings.cashbackPercent.toString(), status: "pending" });
  }
  return { points };
}

export async function redeemPointsToWallet(userId: string, pointsToRedeem: number) {
  const settings = await getLoyaltySettings();
  const [points] = await db.select().from(rewardPoints).where(eq(rewardPoints.userId, userId)).limit(1);
  if (!points || points.pointsBalance < pointsToRedeem) throw new Error("رصيد النقاط غير كافٍ");
  const walletAmount = pointsToRedeem * settings.pointToWalletRate;
  await db.update(rewardPoints).set({ pointsBalance: sql`${rewardPoints.pointsBalance} - ${pointsToRedeem}`, lifetimeRedeemed: sql`${rewardPoints.lifetimeRedeemed} + ${pointsToRedeem}`, updatedAt: new Date() }).where(eq(rewardPoints.userId, userId));
  await db.insert(rewardTransactions).values({ userId, type: "redeem_to_wallet", points: -Math.abs(pointsToRedeem), description: "استبدال نقاط إلى رصيد محفظة", metadata: { walletAmount } });
  return creditWallet({ userId, amount: walletAmount, type: "reward_redeem", description: "تحويل نقاط الولاء إلى رصيد محفظة" });
}
