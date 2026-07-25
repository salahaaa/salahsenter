import { and, eq, inArray, sql } from "drizzle-orm";
import { adBilling, adCampaigns, adClicks, adCreditNotes, adFraudSignals, adImpressions } from "@/lib/db";
import { reverseCampaignOperationalReservation } from "@/lib/ads/billing";

type DbLike = any;

function amount(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0;
}

/**
 * Reviews fraud without deleting the original event. A billed event receives
 * one immutable credit note and a negative ledger adjustment; any invoice
 * remains historically intact and the credit is handled separately.
 */
export async function reviewAdFraudSignal(input: {
  tx: DbLike;
  signalId: string;
  actorId: string;
  action: "confirm_clean" | "invalidate";
  note: string;
}) {
  const [signal] = await input.tx.select().from(adFraudSignals).where(eq(adFraudSignals.id, input.signalId)).limit(1);
  if (!signal) throw Object.assign(new Error("إشارة الاحتيال غير موجودة"), { statusCode: 404 });
  if (signal.reviewedAt) throw Object.assign(new Error("تمت مراجعة إشارة الاحتيال مسبقاً"), { statusCode: 409 });
  const now = new Date();

  if (input.action === "confirm_clean") {
    if (signal.clickId) await input.tx.update(adClicks).set({ fraudStatus: "clean" }).where(eq(adClicks.id, signal.clickId));
    else await input.tx.update(adImpressions).set({ qualityStatus: "clean" }).where(eq(adImpressions.eventKey, signal.eventKey));
    const [updated] = await input.tx.update(adFraudSignals).set({ status: "confirmed_clean", reviewedBy: input.actorId, reviewedAt: now, evidence: { ...signal.evidence, reviewNote: input.note, reviewedAction: "confirm_clean" } }).where(eq(adFraudSignals.id, signal.id)).returning();
    return { signal: updated, credit: null };
  }

  if (signal.clickId) await input.tx.update(adClicks).set({ fraudStatus: "invalid", cost: "0" }).where(eq(adClicks.id, signal.clickId));
  else await input.tx.update(adImpressions).set({ qualityStatus: "invalid", cost: "0" }).where(eq(adImpressions.eventKey, signal.eventKey));
  const [billing] = await input.tx.select().from(adBilling).where(and(eq(adBilling.eventKey, signal.eventKey), inArray(adBilling.status, ["accrued", "invoiced", "paid"]))).limit(1);
  let credit = null;
  if (billing && amount(billing.amount) > 0) {
    const [existingCredit] = await input.tx.select().from(adCreditNotes).where(eq(adCreditNotes.billingId, billing.id)).limit(1);
    if (!existingCredit) {
      const [note] = await input.tx.insert(adCreditNotes).values({
        billingId: billing.id,
        campaignId: billing.campaignId,
        storeId: billing.storeId!,
        invoiceId: billing.invoiceId,
        amount: billing.amount,
        currency: billing.currency,
        status: "issued",
        reason: input.note,
        reviewedBy: input.actorId
      }).returning();
      await input.tx.insert(adBilling).values({
        campaignId: billing.campaignId,
        storeId: billing.storeId,
        invoiceId: null,
        eventKey: `fraud-credit:${billing.id}`,
        billingType: "fraud_credit",
        amount: (-amount(billing.amount)).toFixed(2),
        currency: billing.currency,
        status: "credit_issued",
        description: `Fraud credit for ${billing.billingType} event`,
        metadata: { originalBillingId: billing.id, fraudSignalId: signal.id, creditNoteId: note.id }
      }).onConflictDoNothing({ target: adBilling.eventKey });
      await input.tx.update(adCampaigns).set({ spentAmount: sql`greatest(${adCampaigns.spentAmount} - ${amount(billing.amount)}, 0)`, updatedAt: now }).where(eq(adCampaigns.id, billing.campaignId));
      await reverseCampaignOperationalReservation({ tx: input.tx, campaignId: billing.campaignId, amount: amount(billing.amount), now });
      await input.tx.update(adBilling).set({ status: "credited", updatedAt: now }).where(eq(adBilling.id, billing.id));
      credit = note;
    }
  }
  const [updated] = await input.tx.update(adFraudSignals).set({ status: "invalidated", reviewedBy: input.actorId, reviewedAt: now, evidence: { ...signal.evidence, reviewNote: input.note, reviewedAction: "invalidate", creditNoteId: credit?.id || null } }).where(eq(adFraudSignals.id, signal.id)).returning();
  return { signal: updated, credit };
}
