import { and, eq, inArray, sql } from "drizzle-orm";
import { adBilling, adBudgetReservations, adCampaigns, adCreditNotes, adInvoiceLines, adInvoices, db } from "@/lib/db";

function money(value: unknown) { const n = Number(value || 0); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; }

/** Read-only reconciliation; operators decide remediation from a reviewed alert. */
export async function reconcileAdFinancialState(limit = 300) {
  const campaigns = await db.select().from(adCampaigns).limit(Math.max(1, Math.min(limit, 500)));
  const mismatches: Array<Record<string, unknown>> = [];
  for (const campaign of campaigns) {
    const [[ledger], [reservation], [openCredits]] = await Promise.all([
      db.select({ total: sql<string>`coalesce(sum(${adBilling.amount}), 0)` }).from(adBilling).where(andCampaign(campaign.id)),
      db.select().from(adBudgetReservations).where(eq(adBudgetReservations.campaignId, campaign.id)).limit(1),
      db.select({ count: sql<number>`count(*)::int` }).from(adCreditNotes).where(andCredit(campaign.id))
    ]);
    const ledgerTotal = money(ledger?.total);
    const campaignSpent = money(campaign.spentAmount);
    const reservationConsumed = money(reservation?.consumedAmount);
    if (Math.abs(ledgerTotal - campaignSpent) > 0.01 || reservation && Math.abs(reservationConsumed - campaignSpent) > 0.01 || Number(openCredits?.count || 0) > 0) {
      mismatches.push({ campaignId: campaign.id, campaignName: campaign.name, storeId: campaign.storeId, campaignSpent, ledgerTotal, reservationConsumed: reservation ? reservationConsumed : null, openCreditNotes: Number(openCredits?.count || 0) });
    }
  }
  const invoices = await db.select({ invoiceId: adInvoices.id, totalAmount: adInvoices.totalAmount, linesTotal: sql<string>`coalesce(sum(${adInvoiceLines.totalAmount}), 0)` }).from(adInvoices).leftJoin(adInvoiceLines, eq(adInvoiceLines.invoiceId, adInvoices.id)).groupBy(adInvoices.id).limit(500);
  const invoiceMismatches = invoices.filter((row) => Math.abs(money(row.totalAmount) - money(row.linesTotal)) > 0.01).map((row) => ({ invoiceId: row.invoiceId, invoiceTotal: money(row.totalAmount), linesTotal: money(row.linesTotal) }));
  return { scannedCampaigns: campaigns.length, campaignMismatches: mismatches, invoiceMismatches, ok: !mismatches.length && !invoiceMismatches.length };
}

function andCampaign(campaignId: string) {
  return and(eq(adBilling.campaignId, campaignId), inArray(adBilling.status, ["accrued", "invoiced", "paid", "credited", "credit_issued"]));
}
function andCredit(campaignId: string) {
  return and(eq(adCreditNotes.campaignId, campaignId), eq(adCreditNotes.status, "issued"));
}
