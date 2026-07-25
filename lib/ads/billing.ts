import { and, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import {
  adBilling,
  adBudgetReservations,
  adCampaigns,
  adInvoiceLines,
  adInvoices,
  db,
  stores
} from "@/lib/db";
import { utcDayRange } from "@/lib/ads/performance";

type DbLike = any;
type Campaign = typeof adCampaigns.$inferSelect;

function amount(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : 0;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

/**
 * Creates the operational cap record exactly once. This is deliberately not a
 * payment hold or merchant balance debit; it only makes the campaign's allowed
 * spend auditable and safe to consume under a per-campaign transaction lock.
 */
export async function ensureCampaignOperationalReservation(input: { tx: DbLike; campaign: Campaign; now?: Date }) {
  const now = input.now || new Date();
  const reservedAmount = amount(input.campaign.budget);
  if (reservedAmount <= 0) return null;
  const reservationKey = `ad-budget:${input.campaign.id}`;
  await input.tx
    .insert(adBudgetReservations)
    .values({
      campaignId: input.campaign.id,
      storeId: input.campaign.storeId,
      reservationKey,
      currency: "YER",
      reservedAmount: reservedAmount.toFixed(2),
      consumedAmount: amount(input.campaign.spentAmount).toFixed(2),
      status: amount(input.campaign.spentAmount) >= reservedAmount ? "exhausted" : "active",
      metadata: { kind: "operational_budget_cap", createdFromCampaignStatus: input.campaign.status },
      reservedAt: now,
      updatedAt: now
    })
    .onConflictDoNothing({ target: adBudgetReservations.campaignId });

  const [reservation] = await input.tx
    .select()
    .from(adBudgetReservations)
    .where(eq(adBudgetReservations.campaignId, input.campaign.id))
    .limit(1);
  return reservation || null;
}

export async function consumeCampaignOperationalReservation(input: { tx: DbLike; campaign: Campaign; charge: number; now?: Date }) {
  const charge = amount(input.charge);
  if (charge <= 0) return ensureCampaignOperationalReservation(input);
  const now = input.now || new Date();
  const reservation = await ensureCampaignOperationalReservation({ ...input, now });
  if (!reservation) return null;
  const nextConsumed = Math.min(amount(reservation.reservedAmount), amount(reservation.consumedAmount) + charge);
  const exhausted = nextConsumed >= amount(reservation.reservedAmount);
  const [updated] = await input.tx
    .update(adBudgetReservations)
    .set({
      consumedAmount: nextConsumed.toFixed(2),
      status: exhausted ? "exhausted" : "active",
      updatedAt: now
    })
    .where(eq(adBudgetReservations.id, reservation.id))
    .returning();
  return updated || reservation;
}

/** Reverses an operational consumption after a reviewed fraud credit. This is
 * not a merchant payment refund; the immutable credit note handles that. */
export async function reverseCampaignOperationalReservation(input: { tx: DbLike; campaignId: string; amount: number; now?: Date }) {
  const credit = amount(input.amount);
  if (credit <= 0) return null;
  const now = input.now || new Date();
  const [updated] = await input.tx.update(adBudgetReservations).set({
    consumedAmount: sql`greatest(${adBudgetReservations.consumedAmount} - ${credit}, 0)`,
    status: "active",
    updatedAt: now
  }).where(eq(adBudgetReservations.campaignId, input.campaignId)).returning();
  return updated || null;
}

/** Releases only the unused operational cap. Historical costs and invoices are never deleted. */
export async function releaseCampaignOperationalReservation(input: { tx: DbLike; campaign: Campaign; reason: string; now?: Date }) {
  const now = input.now || new Date();
  const [reservation] = await input.tx
    .select()
    .from(adBudgetReservations)
    .where(eq(adBudgetReservations.campaignId, input.campaign.id))
    .limit(1);
  if (!reservation || ["released", "exhausted"].includes(reservation.status)) return reservation || null;
  const release = Math.max(0, amount(reservation.reservedAmount) - amount(reservation.consumedAmount));
  const [updated] = await input.tx
    .update(adBudgetReservations)
    .set({
      releasedAmount: release.toFixed(2),
      status: "released",
      releasedAt: now,
      updatedAt: now,
      metadata: { ...(reservation.metadata || {}), releaseReason: input.reason, releasedAt: now.toISOString() }
    })
    .where(eq(adBudgetReservations.id, reservation.id))
    .returning();
  return updated || reservation;
}

export function adInvoiceSourceKey(input: { storeId: string; currency: string; periodStart: Date }) {
  return `ads:${input.storeId}:${input.currency}:${input.periodStart.toISOString().slice(0, 10)}`;
}

/**
 * Issues one idempotent invoice per store/currency for a completed UTC day.
 * It intentionally covers only accrued ledger lines and never marks a bill as
 * paid; payment confirmation remains an audited admin action.
 */
export async function issueAdInvoicesForDay(input: { date?: Date; limit?: number } = {}) {
  const { start, end } = utcDayRange(input.date || new Date(Date.now() - 24 * 60 * 60 * 1000));
  const limit = Math.max(1, Math.min(input.limit || 200, 500));
  const rows = await db
    .select({ billing: adBilling, campaign: adCampaigns, merchantId: stores.merchantId })
    .from(adBilling)
    .innerJoin(adCampaigns, eq(adBilling.campaignId, adCampaigns.id))
    .innerJoin(stores, eq(adBilling.storeId, stores.id))
    .where(and(eq(adBilling.status, "accrued"), isNull(adBilling.invoiceId), gte(adBilling.createdAt, start), lt(adBilling.createdAt, end)))
    .limit(limit * 50);

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.billing.storeId || !row.merchantId) continue;
    const key = `${row.billing.storeId}:${row.billing.currency}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  }

  const issued: Array<{ invoiceId: string; invoiceNumber: string; storeId: string; totalAmount: number; billingCount: number }> = [];
  for (const group of [...groups.values()].slice(0, limit)) {
    const first = group[0];
    if (!first.billing.storeId || !first.merchantId) continue;
    const storeId = first.billing.storeId;
    const merchantId = first.merchantId;
    if (!storeId || !merchantId) continue;
    const sourceKey = adInvoiceSourceKey({ storeId, currency: first.billing.currency, periodStart: start });
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ad-invoice:${sourceKey}`}))`);
      const [existing] = await tx.select().from(adInvoices).where(eq(adInvoices.sourceKey, sourceKey)).limit(1);
      if (existing) return null;

      const billingIds = group.map((row) => row.billing.id);
      const fresh = await tx
        .select()
        .from(adBilling)
        .where(and(inArray(adBilling.id, billingIds), eq(adBilling.status, "accrued"), isNull(adBilling.invoiceId)));
      if (!fresh.length) return null;

      const total = fresh.reduce((sum: number, row: any) => sum + amount(row.amount), 0);
      if (total <= 0) return null;
      const invoiceNumber = `ADS-${dayKey(start)}-${storeId.slice(0, 8).toUpperCase()}`;
      const now = new Date();
      const [invoice] = await tx
        .insert(adInvoices)
        .values({
          storeId,
          merchantId,
          sourceKey,
          invoiceNumber,
          periodStart: start,
          periodEnd: end,
          currency: first.billing.currency,
          totalAmount: total.toFixed(2),
          status: "issued",
          dueAt: new Date(end.getTime() + 7 * 24 * 60 * 60 * 1000),
          issuedAt: now,
          metadata: { billingCount: fresh.length, source: "ads_daily_ledger" },
          updatedAt: now
        })
        .returning();
      await tx.insert(adInvoiceLines).values(fresh.map((billing: any) => ({
        invoiceId: invoice.id,
        billingId: billing.id,
        campaignId: billing.campaignId,
        description: billing.description || `${billing.billingType.toUpperCase()} ad delivery`,
        quantity: 1,
        unitAmount: billing.amount,
        totalAmount: billing.amount
      })));
      await tx
        .update(adBilling)
        .set({ invoiceId: invoice.id, status: "invoiced", updatedAt: now })
        .where(inArray(adBilling.id, fresh.map((row: any) => row.id)));
      return { invoiceId: invoice.id, invoiceNumber, storeId: invoice.storeId, totalAmount: total, billingCount: fresh.length };
    });
    if (result) issued.push(result);
  }
  return { periodStart: start, periodEnd: end, candidates: rows.length, issuedCount: issued.length, issued };
}

export async function settleAdInvoice(input: { invoiceId: string; actorId: string; action: "mark_paid" | "void"; note?: string | null }) {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(adInvoices).where(eq(adInvoices.id, input.invoiceId)).limit(1);
    if (!before) throw Object.assign(new Error("فاتورة الإعلان غير موجودة"), { statusCode: 404 });
    if (!["issued", "pending", "payment_submitted"].includes(before.status)) throw Object.assign(new Error("لا يمكن تسوية فاتورة بهذه الحالة"), { statusCode: 409 });
    const now = new Date();
    const nextStatus = input.action === "mark_paid" ? "paid" : "void";
    const [invoice] = await tx
      .update(adInvoices)
      .set({
        status: nextStatus,
        paidAt: input.action === "mark_paid" ? now : null,
        settledBy: input.actorId,
        note: input.note?.trim() || before.note,
        updatedAt: now
      })
      .where(eq(adInvoices.id, before.id))
      .returning();
    await tx
      .update(adBilling)
      .set({ status: input.action === "mark_paid" ? "paid" : "void", updatedAt: now })
      .where(eq(adBilling.invoiceId, before.id));
    return { before, invoice };
  });
}
