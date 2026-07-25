import { and, eq, lte, sql } from "drizzle-orm";
import { contractEvents, db, merchantContracts, notifications, stores } from "@/lib/db";

export async function createContractEvent(input: { contractId: string; storeId?: string | null; actorId?: string | null; action: string; reason?: string; beforeData?: unknown; afterData?: unknown }) {
  await db.insert(contractEvents).values({
    contractId: input.contractId,
    storeId: input.storeId || null,
    actorId: input.actorId || null,
    action: input.action,
    reason: input.reason,
    beforeData: (input.beforeData ?? null) as Record<string, unknown> | null,
    afterData: (input.afterData ?? null) as Record<string, unknown> | null
  });
}

export function daysUntil(date: Date) {
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export async function scanContractsForExpiry(actorId?: string | null) {
  const now = new Date();
  const contracts = await db
    .select({ contract: merchantContracts, store: stores })
    .from(merchantContracts)
    .innerJoin(stores, eq(merchantContracts.storeId, stores.id))
    .where(sql`${merchantContracts.status} in ('active', 'near_expiry', 'grace')`);

  const alerts = [];
  for (const row of contracts) {
    const remaining = daysUntil(row.contract.endAt);
    if (remaining < 0 && row.contract.status !== "expired") {
      const [updated] = await db.update(merchantContracts).set({ status: "expired", updatedAt: now }).where(eq(merchantContracts.id, row.contract.id)).returning();
      await createContractEvent({ contractId: row.contract.id, storeId: row.contract.storeId, actorId, action: "expired", beforeData: row.contract, afterData: updated });
      alerts.push(updated);
      continue;
    }
    if (remaining <= row.contract.alertBeforeDays && row.contract.status === "active") {
      const [updated] = await db.update(merchantContracts).set({ status: "near_expiry", updatedAt: now }).where(eq(merchantContracts.id, row.contract.id)).returning();
      await db.insert(notifications).values({
        userId: row.contract.merchantId,
        storeId: row.contract.storeId,
        title: "تنبيه قرب انتهاء عقد المتجر",
        body: `العقد رقم ${row.contract.contractNumber} سينتهي خلال ${remaining} يوم.`,
        type: "contract_near_expiry",
        data: { contractId: row.contract.id, contractNumber: row.contract.contractNumber, daysRemaining: remaining }
      });
      await createContractEvent({ contractId: row.contract.id, storeId: row.contract.storeId, actorId, action: "near_expiry_alert", beforeData: row.contract, afterData: updated });
      alerts.push(updated);
    }
  }
  return alerts;
}
