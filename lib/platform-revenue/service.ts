import { and, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { ApiError } from "@/lib/api";
import { notifyAdmins } from "@/lib/notifications";
import {
  adBilling,
  adCampaigns,
  adInvoices,
  db,
  merchantContracts,
  merchantPlatformStatementLines,
  merchantPlatformStatements,
  merchantPromotionAgreements,
  merchantRevenueTerms,
  merchantSalesReports,
  notifications,
  rentalAddons,
  storeRentalAddonAssignments,
  storeRentalAgreements,
  stores
} from "@/lib/db";
import {
  addonIsDueInPeriod,
  calculatePlatformRevenueStatement,
  monthRange,
  periodKey,
  PLATFORM_REVENUE_MODELS,
  previousMonthRange,
  statementNeedsApprovedSalesReport,
  type PlatformRevenueModel,
  usesMonthlyRent,
  usesSalesCommission
} from "@/lib/platform-revenue/policy";

type DbLike = any;
type RevenueTerms = typeof merchantRevenueTerms.$inferSelect;
type PromotionAgreement = typeof merchantPromotionAgreements.$inferSelect;

function amount(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : 0;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function activeInPeriod(input: { startsAt: Date; endsAt?: Date | null; status: string }, start: Date, end: Date) {
  return input.status === "active" && input.startsAt < end && (!input.endsAt || input.endsAt > start);
}

function isRevenueModel(value: string): value is PlatformRevenueModel {
  return (PLATFORM_REVENUE_MODELS as readonly string[]).includes(value);
}

async function statementNumber(tx: DbLike) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const value = `PLT-${new Date().getFullYear()}-${nanoid(9).toUpperCase()}`;
    const [existing] = await tx.select({ id: merchantPlatformStatements.id }).from(merchantPlatformStatements).where(eq(merchantPlatformStatements.statementNumber, value)).limit(1);
    if (!existing) return value;
  }
  throw new Error("تعذر توليد رقم كشف إيراد منصة فريد");
}

export function platformStatementSourceKey(storeId: string, periodStart: Date) {
  return `platform-revenue:${storeId}:${periodKey(periodStart)}`;
}

/** Admin-controlled commercial terms. This is the source of truth for rent/commission, not order settlement. */
export async function upsertMerchantRevenueTerms(input: {
  storeId: string;
  merchantId: string;
  contractId?: string | null;
  model: PlatformRevenueModel;
  monthlyRent: number;
  commissionRate: number;
  currency?: string;
  dueDays?: number;
  graceDays?: number;
  status?: "draft" | "active" | "paused" | "suspended" | "terminated";
  startsAt?: Date;
  endsAt?: Date | null;
  actorId: string;
  note?: string | null;
}) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const [store] = await tx.select({ id: stores.id, merchantId: stores.merchantId }).from(stores).where(eq(stores.id, input.storeId)).limit(1);
    if (!store) throw new ApiError("المتجر غير موجود", 404);
    if (store.merchantId !== input.merchantId) throw new ApiError("التاجر لا يطابق مالك المتجر", 422);
    const [existing] = await tx.select().from(merchantRevenueTerms).where(eq(merchantRevenueTerms.storeId, input.storeId)).limit(1);
    const termsSnapshot = {
      model: input.model,
      monthlyRent: amount(input.monthlyRent),
      commissionRate: amount(input.commissionRate),
      currency: input.currency || "YER",
      dueDays: Math.max(1, Math.min(90, Math.floor(input.dueDays ?? 7))),
      graceDays: Math.max(0, Math.min(90, Math.floor(input.graceDays ?? 7))),
      updatedAt: now.toISOString(),
      note: input.note?.trim() || null
    };
    const values = {
      merchantId: input.merchantId,
      contractId: input.contractId || null,
      model: input.model,
      monthlyRent: termsSnapshot.monthlyRent.toFixed(2),
      commissionRate: termsSnapshot.commissionRate.toFixed(3),
      currency: termsSnapshot.currency,
      dueDays: termsSnapshot.dueDays,
      graceDays: termsSnapshot.graceDays,
      status: input.status || "active",
      startsAt: input.startsAt || existing?.startsAt || now,
      endsAt: input.endsAt || null,
      version: existing ? existing.version + 1 : 1,
      metadata: { ...(existing?.metadata || {}), termsSnapshot, consolidatedBilling: true },
      createdBy: existing?.createdBy || input.actorId,
      updatedBy: input.actorId,
      updatedAt: now
    };
    const [terms] = existing
      ? await tx.update(merchantRevenueTerms).set(values).where(eq(merchantRevenueTerms.id, existing.id)).returning()
      : await tx.insert(merchantRevenueTerms).values({ storeId: input.storeId, ...values }).returning();

    // Legacy rental data remains available for limits/add-ons, but must no
    // longer generate an independent rent invoice once the unified model is on.
    await tx
      .update(storeRentalAgreements)
      .set({ consolidatedBilling: true, metadata: sql`coalesce(${storeRentalAgreements.metadata}, '{}'::jsonb) || ${JSON.stringify({ consolidatedPlatformRevenue: true, updatedBy: input.actorId })}::jsonb`, updatedAt: now })
      .where(eq(storeRentalAgreements.storeId, input.storeId));

    if (terms.contractId) {
      const [contract] = await tx.select().from(merchantContracts).where(eq(merchantContracts.id, terms.contractId)).limit(1);
      if (contract) {
        await tx.update(merchantContracts).set({ metadata: { ...(contract.metadata || {}), platformRevenueTerms: termsSnapshot, platformRevenueTermsId: terms.id, platformRevenueTermsVersion: terms.version }, updatedAt: now }).where(eq(merchantContracts.id, contract.id));
      }
    }
    return { before: existing || null, terms };
  });
}

/** Separate agreement for campaign/visibility monetization; it never changes rent or commission terms. */
export async function upsertMerchantPromotionAgreement(input: {
  storeId: string;
  merchantId: string;
  contractId?: string | null;
  currency?: string;
  homepageBannerFee: number;
  featuredProductFee: number;
  featuredStoreFee: number;
  status?: "draft" | "active" | "paused" | "terminated";
  startsAt?: Date;
  endsAt?: Date | null;
  actorId: string;
  note?: string | null;
}) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const [store] = await tx.select({ id: stores.id, merchantId: stores.merchantId }).from(stores).where(eq(stores.id, input.storeId)).limit(1);
    if (!store) throw new ApiError("المتجر غير موجود", 404);
    if (store.merchantId !== input.merchantId) throw new ApiError("التاجر لا يطابق مالك المتجر", 422);
    const [existing] = await tx.select().from(merchantPromotionAgreements).where(eq(merchantPromotionAgreements.storeId, input.storeId)).limit(1);
    const values = {
      merchantId: input.merchantId,
      contractId: input.contractId || null,
      currency: input.currency || "YER",
      homepageBannerFee: amount(input.homepageBannerFee).toFixed(2),
      featuredProductFee: amount(input.featuredProductFee).toFixed(2),
      featuredStoreFee: amount(input.featuredStoreFee).toFixed(2),
      status: input.status || "active",
      startsAt: input.startsAt || existing?.startsAt || now,
      endsAt: input.endsAt || null,
      version: existing ? existing.version + 1 : 1,
      metadata: { ...(existing?.metadata || {}), note: input.note?.trim() || null, updatedAt: now.toISOString(), separateFromRental: true },
      createdBy: existing?.createdBy || input.actorId,
      updatedBy: input.actorId,
      updatedAt: now
    };
    const [agreement] = existing
      ? await tx.update(merchantPromotionAgreements).set(values).where(eq(merchantPromotionAgreements.id, existing.id)).returning()
      : await tx.insert(merchantPromotionAgreements).values({ storeId: input.storeId, ...values }).returning();
    return { before: existing || null, agreement };
  });
}

/** One immutable ledger charge per campaign promotion activation/rate-card version. */
export async function chargeCampaignPromotionPlacementFee(input: { tx: DbLike; campaign: typeof adCampaigns.$inferSelect; now?: Date }) {
  const now = input.now || new Date();
  const [agreement] = await input.tx
    .select()
    .from(merchantPromotionAgreements)
    .where(eq(merchantPromotionAgreements.storeId, input.campaign.storeId))
    .limit(1);
  if (!agreement || !activeInPeriod(agreement, now, new Date(now.getTime() + 1))) return null;

  let billingType: string | null = null;
  let fee = 0;
  if (input.campaign.type === "homepage_banner" && input.campaign.placementId === "homepage_marketplace_ads") {
    billingType = "homepage_banner_placement"; fee = amount(agreement.homepageBannerFee);
  } else if (["featured_products", "sponsored_products"].includes(input.campaign.type) && ["homepage_featured_products", "homepage_sponsored_products"].includes(input.campaign.placementId)) {
    billingType = "homepage_featured_product_placement"; fee = amount(agreement.featuredProductFee);
  }
  if (!billingType || fee <= 0) return null;
  const eventKey = `promotion:${input.campaign.id}:${billingType}:v${agreement.version}`;
  const inserted = await input.tx
    .insert(adBilling)
    .values({
      campaignId: input.campaign.id,
      storeId: input.campaign.storeId,
      eventKey,
      billingType,
      amount: fee.toFixed(2),
      currency: agreement.currency,
      status: "accrued",
      description: `Fixed promotion placement fee: ${billingType}`,
      metadata: { promotionAgreementId: agreement.id, promotionAgreementVersion: agreement.version, campaignId: input.campaign.id, separatePromotionAgreement: true }
    })
    .onConflictDoNothing({ target: adBilling.eventKey })
    .returning({ id: adBilling.id });
  return inserted[0] ? { billingId: inserted[0].id, billingType, amount: fee, agreement } : null;
}

export async function submitMerchantSalesReport(input: {
  storeId: string;
  merchantId: string;
  periodStart: Date;
  periodEnd: Date;
  salesTotal: number;
  currency?: string;
  source?: "merchant_manual" | "merchant_api" | "erp";
  externalReference?: string | null;
  note?: string | null;
}) {
  if (input.periodEnd <= input.periodStart) throw new ApiError("نهاية تقرير المبيعات يجب أن تكون بعد بدايته", 422);
  const result = await db.transaction(async (tx) => {
    const [terms] = await tx.select().from(merchantRevenueTerms).where(eq(merchantRevenueTerms.storeId, input.storeId)).limit(1);
    if (!terms || !activeInPeriod(terms, input.periodStart, input.periodEnd)) throw new ApiError("لا توجد شروط إيراد منصة فعالة لهذه الفترة", 409);
    const model = isRevenueModel(terms.model) ? terms.model : "monthly_rent";
    if (!usesSalesCommission(model)) throw new ApiError("نموذج متجرك لا يعتمد عمولة مبيعات ولا يحتاج تقرير مبيعات لهذه الفترة", 409);
    if (terms.currency !== (input.currency || "YER")) throw new ApiError("عملة تقرير المبيعات لا تطابق عملة شروط إيراد المنصة", 422);
    const sourceKey = platformStatementSourceKey(input.storeId, input.periodStart);
    const [statement] = await tx.select().from(merchantPlatformStatements).where(eq(merchantPlatformStatements.sourceKey, sourceKey)).limit(1);
    if (statement && !["draft", "awaiting_sales_report"].includes(statement.status)) throw new ApiError("لا يمكن تعديل تقرير الفترة بعد إصدار أو تسوية كشف المنصة", 409);
    const [existing] = await tx.select().from(merchantSalesReports).where(and(eq(merchantSalesReports.storeId, input.storeId), eq(merchantSalesReports.periodStart, input.periodStart), eq(merchantSalesReports.periodEnd, input.periodEnd))).limit(1);
    if (existing && !["submitted", "rejected", "draft"].includes(existing.status)) throw new ApiError("تقرير هذه الفترة قيد الاعتماد أو معتمد بالفعل", 409);
    const now = new Date();
    const values = {
      merchantId: input.merchantId,
      salesTotal: amount(input.salesTotal).toFixed(2),
      currency: input.currency || "YER",
      source: input.source || "merchant_manual",
      externalReference: input.externalReference?.trim() || null,
      status: "submitted",
      submittedAt: now,
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      metadata: { ...(existing?.metadata || {}), merchantNote: input.note?.trim() || null },
      updatedAt: now
    };
    const [report] = existing
      ? await tx.update(merchantSalesReports).set(values).where(eq(merchantSalesReports.id, existing.id)).returning()
      : await tx.insert(merchantSalesReports).values({ storeId: input.storeId, periodStart: input.periodStart, periodEnd: input.periodEnd, ...values }).returning();
    return { before: existing || null, report };
  });
  await notifyAdmins({
    title: "تقرير مبيعات بانتظار الاعتماد",
    body: `أرسل التاجر تقرير مبيعات لفترة ${result.report.periodStart.toISOString().slice(0, 10)} إلى ${result.report.periodEnd.toISOString().slice(0, 10)}.`,
    type: "merchant_sales_report_submitted",
    data: { reportId: result.report.id, storeId: result.report.storeId, url: "/admin/platform-revenue" }
  });
  return result;
}

export async function reviewMerchantSalesReport(input: { reportId: string; actorId: string; action: "approve" | "reject"; note?: string | null }) {
  const now = new Date();
  const [before] = await db.select().from(merchantSalesReports).where(eq(merchantSalesReports.id, input.reportId)).limit(1);
  if (!before) throw new ApiError("تقرير المبيعات غير موجود", 404);
  if (before.status !== "submitted") throw new ApiError("لا يمكن مراجعة التقرير بهذه الحالة", 409);
  const [report] = await db
    .update(merchantSalesReports)
    .set({ status: input.action === "approve" ? "approved" : "rejected", reviewedBy: input.actorId, reviewedAt: now, reviewNote: input.note?.trim() || null, updatedAt: now })
    .where(eq(merchantSalesReports.id, before.id))
    .returning();
  await db.insert(notifications).values({
    userId: report.merchantId,
    storeId: report.storeId,
    title: input.action === "approve" ? "تم اعتماد تقرير المبيعات" : "تم رفض تقرير المبيعات",
    body: input.action === "approve" ? "سيتم احتساب عمولة المنصة ضمن كشف الفترة الموحد." : (input.note?.trim() || "يرجى مراجعة التقرير وإرساله من جديد."),
    type: input.action === "approve" ? "merchant_sales_report_approved" : "merchant_sales_report_rejected",
    data: { reportId: report.id, url: "/merchant/platform-revenue" }
  });
  return { before, report };
}

type LineInput = { lineType: string; sourceType: string; sourceId: string; description: string; quantity: number; unitAmount: number; totalAmount: number; metadata?: Record<string, unknown> };

async function buildStatementLines(input: { tx: DbLike; terms: RevenueTerms; periodStart: Date; periodEnd: Date; salesReport: typeof merchantSalesReports.$inferSelect | null }) {
  const lines: LineInput[] = [];
  const [adInvoiceRows, addonRows] = await Promise.all([
    input.tx.select().from(adInvoices).where(and(eq(adInvoices.storeId, input.terms.storeId), inArray(adInvoices.status, ["issued", "pending"]), gte(adInvoices.periodStart, input.periodStart), lte(adInvoices.periodEnd, input.periodEnd))),
    input.tx
      .select({ assignment: storeRentalAddonAssignments, addon: rentalAddons })
      .from(storeRentalAddonAssignments)
      .innerJoin(storeRentalAgreements, eq(storeRentalAddonAssignments.agreementId, storeRentalAgreements.id))
      .innerJoin(rentalAddons, eq(storeRentalAddonAssignments.addonId, rentalAddons.id))
      .where(and(eq(storeRentalAgreements.storeId, input.terms.storeId), eq(storeRentalAgreements.consolidatedBilling, true), eq(storeRentalAddonAssignments.status, "active"), eq(rentalAddons.isActive, true), lt(storeRentalAddonAssignments.startsAt, input.periodEnd), or(isNull(storeRentalAddonAssignments.endsAt), gte(storeRentalAddonAssignments.endsAt, input.periodStart))))
  ]);

  const model = isRevenueModel(input.terms.model) ? input.terms.model : "monthly_rent";
  if (usesMonthlyRent(model)) {
    const total = amount(input.terms.monthlyRent);
    if (total > 0) lines.push({ lineType: "rent", sourceType: "revenue_terms", sourceId: `${input.terms.id}:${periodKey(input.periodStart)}`, description: "إيجار المنصة الشهري", quantity: 1, unitAmount: total, totalAmount: total, metadata: { termsVersion: input.terms.version } });
  }
  if (statementNeedsApprovedSalesReport(model) && input.salesReport) {
    const base = amount(input.salesReport.salesTotal); const rate = amount(input.terms.commissionRate); const total = Math.round((base * rate / 100) * 100) / 100;
    lines.push({ lineType: "commission", sourceType: "sales_report", sourceId: input.salesReport.id, description: `عمولة مبيعات معتمدة بنسبة ${rate}%`, quantity: 1, unitAmount: total, totalAmount: total, metadata: { salesTotal: base, commissionRate: rate, salesReportId: input.salesReport.id } });
  }
  for (const invoice of adInvoiceRows) {
    const total = amount(invoice.totalAmount);
    if (total > 0) lines.push({ lineType: "advertising", sourceType: "ad_invoice", sourceId: invoice.id, description: `إيرادات إعلانات: ${invoice.invoiceNumber}`, quantity: 1, unitAmount: total, totalAmount: total, metadata: { adInvoiceNumber: invoice.invoiceNumber } });
  }
  for (const row of addonRows) {
    if (!addonIsDueInPeriod({ startsAt: row.assignment.startsAt, periodStart: input.periodStart, billingCycle: row.addon.billingCycle })) continue;
    const total = amount(Number(row.assignment.unitPrice || 0) * Number(row.assignment.quantity || 1));
    if (total > 0) lines.push({ lineType: "addon", sourceType: "rental_addon_assignment", sourceId: `${row.assignment.id}:${periodKey(input.periodStart)}`, description: `إضافة: ${row.addon.name}`, quantity: Number(row.assignment.quantity || 1), unitAmount: amount(row.assignment.unitPrice), totalAmount: total, metadata: { addonId: row.addon.id, code: row.addon.code, cycle: row.addon.billingCycle } });
  }
  return { lines, adInvoiceRows };
}

/**
 * Creates/rebuilds a single platform-only statement. It refuses to issue a
 * commission/hybrid statement until the merchant report has an admin approval.
 */
export async function issueMerchantPlatformStatement(input: { storeId: string; periodStart?: Date; periodEnd?: Date; actorId?: string | null }) {
  const range = input.periodStart && input.periodEnd ? { start: input.periodStart, end: input.periodEnd } : previousMonthRange();
  const sourceKey = platformStatementSourceKey(input.storeId, range.start);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`platform-revenue:${sourceKey}`}))`);
    const [terms] = await tx.select().from(merchantRevenueTerms).where(eq(merchantRevenueTerms.storeId, input.storeId)).limit(1);
    if (!terms || !activeInPeriod(terms, range.start, range.end)) return { statement: null, reason: "terms_unavailable" as const };
    const model = isRevenueModel(terms.model) ? terms.model : "monthly_rent";
    const [salesReport, existing] = await Promise.all([
      tx.select().from(merchantSalesReports).where(and(eq(merchantSalesReports.storeId, input.storeId), eq(merchantSalesReports.periodStart, range.start), eq(merchantSalesReports.periodEnd, range.end), eq(merchantSalesReports.status, "approved"))).limit(1).then((rows: any[]) => rows[0] || null),
      tx.select().from(merchantPlatformStatements).where(eq(merchantPlatformStatements.sourceKey, sourceKey)).limit(1).then((rows: any[]) => rows[0] || null)
    ]);
    if (existing && !["draft", "awaiting_sales_report"].includes(existing.status)) return { statement: existing, reason: "already_finalized" as const };
    const needsReport = statementNeedsApprovedSalesReport(model) && !salesReport;
    const { lines, adInvoiceRows } = await buildStatementLines({ tx, terms, periodStart: range.start, periodEnd: range.end, salesReport });
    const computed = calculatePlatformRevenueStatement({
      model,
      monthlyRent: terms.monthlyRent,
      commissionRate: terms.commissionRate,
      approvedSalesTotal: salesReport?.salesTotal || 0,
      advertisingAmount: lines.filter((line) => line.lineType === "advertising").reduce((sum, line) => sum + line.totalAmount, 0),
      addonsAmount: lines.filter((line) => line.lineType === "addon").reduce((sum, line) => sum + line.totalAmount, 0)
    });
    const now = new Date();
    const dueAt = new Date(range.end); dueAt.setUTCDate(dueAt.getUTCDate() + Math.max(1, terms.dueDays));
    const graceEndsAt = new Date(dueAt); graceEndsAt.setUTCDate(graceEndsAt.getUTCDate() + Math.max(0, terms.graceDays));
    const values = {
      merchantId: terms.merchantId,
      revenueTermsId: terms.id,
      periodStart: range.start,
      periodEnd: range.end,
      currency: terms.currency,
      rentAmount: computed.rentAmount.toFixed(2),
      commissionBase: computed.commissionBase.toFixed(2),
      commissionRate: computed.commissionRate.toFixed(3),
      commissionAmount: computed.commissionAmount.toFixed(2),
      advertisingAmount: computed.advertisingAmount.toFixed(2),
      addonsAmount: computed.addonsAmount.toFixed(2),
      adjustmentAmount: computed.adjustmentAmount.toFixed(2),
      totalAmount: computed.totalAmount.toFixed(2),
      status: needsReport ? "awaiting_sales_report" : "issued",
      dueAt: needsReport ? null : dueAt,
      graceEndsAt: needsReport ? null : graceEndsAt,
      issuedAt: needsReport ? null : now,
      metadata: { termsSnapshot: { model, monthlyRent: terms.monthlyRent, commissionRate: terms.commissionRate, version: terms.version }, salesReportId: salesReport?.id || null, generatedBy: input.actorId || "cron", adInvoiceCount: adInvoiceRows.length },
      updatedAt: now
    };
    const [statement] = existing
      ? await tx.update(merchantPlatformStatements).set(values).where(eq(merchantPlatformStatements.id, existing.id)).returning()
      : await tx.insert(merchantPlatformStatements).values({ storeId: input.storeId, statementNumber: await statementNumber(tx), sourceKey, ...values }).returning();
    if (existing) await tx.delete(merchantPlatformStatementLines).where(eq(merchantPlatformStatementLines.statementId, statement.id));
    if (lines.length) await tx.insert(merchantPlatformStatementLines).values(lines.map((line) => ({ statementId: statement.id, ...line, unitAmount: line.unitAmount.toFixed(2), totalAmount: line.totalAmount.toFixed(2), metadata: line.metadata || {} })));
    if (!needsReport && adInvoiceRows.length) {
      for (const invoice of adInvoiceRows) await tx.update(adInvoices).set({ status: "consolidated", metadata: { ...(invoice.metadata || {}), consolidatedStatementId: statement.id, consolidatedAt: now.toISOString() }, updatedAt: now }).where(eq(adInvoices.id, invoice.id));
    }
    return { statement, reason: needsReport ? "awaiting_sales_report" as const : "issued" as const };
  });
}

export async function processPlatformRevenueCycle(input: { periodStart?: Date; periodEnd?: Date; limit?: number } = {}) {
  const range = input.periodStart && input.periodEnd ? { start: input.periodStart, end: input.periodEnd } : previousMonthRange();
  const terms = await db.select().from(merchantRevenueTerms).where(eq(merchantRevenueTerms.status, "active")).orderBy(merchantRevenueTerms.createdAt).limit(Math.max(1, Math.min(input.limit || 250, 500)));
  const results = [];
  for (const termsRow of terms) {
    if (!activeInPeriod(termsRow, range.start, range.end)) continue;
    results.push(await issueMerchantPlatformStatement({ storeId: termsRow.storeId, periodStart: range.start, periodEnd: range.end }));
  }
  const collections = await processPlatformRevenueCollections();
  return { periodStart: range.start, periodEnd: range.end, processedCount: results.length, issuedCount: results.filter((item) => item.reason === "issued").length, awaitingSalesReportCount: results.filter((item) => item.reason === "awaiting_sales_report").length, results, collections };
}

/** Daily overdue/grace enforcement. It freezes only stores suspended by this revenue subsystem. */
export async function processPlatformRevenueCollections(now = new Date()) {
  const overdueCandidates = await db.select().from(merchantPlatformStatements).where(and(eq(merchantPlatformStatements.status, "issued"), lte(merchantPlatformStatements.dueAt, now))).limit(500);
  const overdue = [];
  for (const statement of overdueCandidates) {
    const [updated] = await db.update(merchantPlatformStatements).set({ status: "overdue", updatedAt: now }).where(eq(merchantPlatformStatements.id, statement.id)).returning();
    if (statement.revenueTermsId) {
      await db.update(merchantRevenueTerms).set({ status: "active", metadata: sql`coalesce(${merchantRevenueTerms.metadata}, '{}'::jsonb) || ${JSON.stringify({ lastOverdueStatementId: statement.id, lastOverdueAt: now.toISOString() })}::jsonb`, updatedAt: now }).where(eq(merchantRevenueTerms.id, statement.revenueTermsId));
    }
    overdue.push(updated);
  }
  const freezeCandidates = await db.select().from(merchantPlatformStatements).where(and(eq(merchantPlatformStatements.status, "overdue"), lte(merchantPlatformStatements.graceEndsAt, now))).limit(500);
  const frozen: string[] = [];
  for (const statement of freezeCandidates) {
    await db.transaction(async (tx) => {
      const [terms] = statement.revenueTermsId ? await tx.select().from(merchantRevenueTerms).where(eq(merchantRevenueTerms.id, statement.revenueTermsId)).limit(1) : [];
      if (!terms) return;
      const [store] = await tx.select().from(stores).where(eq(stores.id, statement.storeId)).limit(1);
      if (!store || store.status === "frozen") return;
      await tx.update(stores).set({ status: "frozen", isActive: false, updatedAt: now }).where(eq(stores.id, store.id));
      const suspensionNote = `[platform-revenue] suspended by overdue statement ${statement.statementNumber}`;
      await tx.update(adCampaigns).set({ status: "paused", adminNote: sql`concat_ws(E'\n', ${adCampaigns.adminNote}, ${suspensionNote})`, updatedAt: now }).where(and(eq(adCampaigns.storeId, store.id), inArray(adCampaigns.status, ["approved", "active"])));
      await tx.update(merchantRevenueTerms).set({ status: "suspended", metadata: { ...(terms.metadata || {}), billingSuspendedByPlatformRevenue: true, suspensionStatementId: statement.id, suspendedAt: now.toISOString() }, updatedAt: now }).where(eq(merchantRevenueTerms.id, terms.id));
      await tx.insert(notifications).values({ userId: statement.merchantId, storeId: statement.storeId, title: "تم تعليق المتجر بسبب فاتورة منصة متأخرة", body: `انتهت مهلة السداد للكشف ${statement.statementNumber}. يرجى رفع إثبات السداد أو التواصل مع الإدارة.`, type: "platform_revenue_store_suspended", data: { statementId: statement.id, statementNumber: statement.statementNumber, url: "/merchant/platform-revenue" } });
      frozen.push(statement.id);
    });
  }
  return { overdueCount: overdue.length, frozenCount: frozen.length, overdue, frozenStatementIds: frozen };
}

export async function submitPlatformStatementPaymentProof(input: { statementId: string; merchantId: string; assetId: string; proofUrl: string; storageKey?: string | null; paymentReference?: string | null; note?: string | null }) {
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(merchantPlatformStatements).where(and(eq(merchantPlatformStatements.id, input.statementId), eq(merchantPlatformStatements.merchantId, input.merchantId))).limit(1);
    if (!before) throw new ApiError("كشف المنصة غير موجود", 404);
    if (!["issued", "overdue"].includes(before.status)) throw new ApiError("لا يمكن رفع إثبات سداد لهذا الكشف بحالته الحالية", 409);
    const [statement] = await tx.update(merchantPlatformStatements).set({ status: "payment_submitted", metadata: { ...(before.metadata || {}), paymentProof: { assetId: input.assetId, url: input.proofUrl, storageKey: input.storageKey || null, paymentReference: input.paymentReference || null, note: input.note || null, submittedAt: now.toISOString(), submittedBy: input.merchantId } }, updatedAt: now }).where(eq(merchantPlatformStatements.id, before.id)).returning();
    return { before, statement };
  });
  await notifyAdmins({ title: "إثبات سداد لإيرادات المنصة", body: `رفع التاجر إثبات سداد للكشف ${result.statement.statementNumber}.`, type: "platform_revenue_payment_proof_submitted", data: { statementId: result.statement.id, storeId: result.statement.storeId, url: "/admin/platform-revenue" } });
  return result;
}

export async function settlePlatformStatement(input: { statementId: string; actorId: string; action: "approve_proof" | "mark_paid" | "reject_proof" | "void"; note?: string | null }) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(merchantPlatformStatements).where(eq(merchantPlatformStatements.id, input.statementId)).limit(1);
    if (!before) throw new ApiError("كشف المنصة غير موجود", 404);
    const canPay = ["issued", "overdue", "payment_submitted"].includes(before.status);
    if (["approve_proof", "mark_paid"].includes(input.action) && !canPay) throw new ApiError("لا يمكن تأكيد سداد هذا الكشف بحالته الحالية", 409);
    if (input.action === "reject_proof" && before.status !== "payment_submitted") throw new ApiError("لا يوجد إثبات سداد قيد المراجعة", 409);
    if (input.action === "void" && !["draft", "awaiting_sales_report", "issued", "overdue"].includes(before.status)) throw new ApiError("لا يمكن إلغاء هذا الكشف بحالته الحالية", 409);
    const nextStatus = input.action === "reject_proof" ? (before.dueAt && before.dueAt <= now ? "overdue" : "issued") : input.action === "void" ? "void" : "paid";
    const [statement] = await tx.update(merchantPlatformStatements).set({ status: nextStatus, paidAt: nextStatus === "paid" ? now : null, settledBy: input.actorId, note: input.note?.trim() || before.note, metadata: { ...(before.metadata || {}), paymentReview: { action: input.action, actorId: input.actorId, at: now.toISOString(), note: input.note?.trim() || null } }, updatedAt: now }).where(eq(merchantPlatformStatements.id, before.id)).returning();
    const lines = await tx.select().from(merchantPlatformStatementLines).where(eq(merchantPlatformStatementLines.statementId, statement.id));
    const adInvoiceIds = lines.filter((line) => line.sourceType === "ad_invoice" && line.sourceId).map((line) => line.sourceId!);
    if (adInvoiceIds.length) {
      if (nextStatus === "paid") await tx.update(adInvoices).set({ status: "paid", paidAt: now, updatedAt: now }).where(inArray(adInvoices.id, adInvoiceIds));
      if (nextStatus === "void") await tx.update(adInvoices).set({ status: "issued", updatedAt: now }).where(inArray(adInvoices.id, adInvoiceIds));
    }
    if (nextStatus === "paid" && before.revenueTermsId) {
      const [terms] = await tx.select().from(merchantRevenueTerms).where(eq(merchantRevenueTerms.id, before.revenueTermsId)).limit(1);
      const [{ count: overdueCount }] = await tx.select({ count: sql<number>`count(*)::int` }).from(merchantPlatformStatements).where(and(eq(merchantPlatformStatements.storeId, before.storeId), eq(merchantPlatformStatements.status, "overdue")));
      if (terms && object(terms.metadata).billingSuspendedByPlatformRevenue === true && Number(overdueCount || 0) === 0) {
        await tx.update(merchantRevenueTerms).set({ status: "active", metadata: { ...object(terms.metadata), billingSuspendedByPlatformRevenue: false, reactivatedAt: now.toISOString() }, updatedAt: now }).where(eq(merchantRevenueTerms.id, terms.id));
        await tx.update(stores).set({ status: "active", isActive: true, updatedAt: now }).where(and(eq(stores.id, before.storeId), eq(stores.status, "frozen")));
      }
    }
    return { before, statement };
  });
}

export async function getMerchantPlatformRevenue(merchantId: string) {
  const [terms, statements, reports, promotionAgreements] = await Promise.all([
    db.select({ terms: merchantRevenueTerms, storeName: stores.name, storeNumber: stores.storeNumber }).from(merchantRevenueTerms).innerJoin(stores, eq(merchantRevenueTerms.storeId, stores.id)).where(eq(merchantRevenueTerms.merchantId, merchantId)).orderBy(desc(merchantRevenueTerms.updatedAt)),
    db.select({ statement: merchantPlatformStatements, storeName: stores.name }).from(merchantPlatformStatements).innerJoin(stores, eq(merchantPlatformStatements.storeId, stores.id)).where(eq(merchantPlatformStatements.merchantId, merchantId)).orderBy(desc(merchantPlatformStatements.periodStart)).limit(100),
    db.select({ report: merchantSalesReports, storeName: stores.name }).from(merchantSalesReports).innerJoin(stores, eq(merchantSalesReports.storeId, stores.id)).where(eq(merchantSalesReports.merchantId, merchantId)).orderBy(desc(merchantSalesReports.periodStart)).limit(100),
    db.select({ agreement: merchantPromotionAgreements, storeName: stores.name }).from(merchantPromotionAgreements).innerJoin(stores, eq(merchantPromotionAgreements.storeId, stores.id)).where(eq(merchantPromotionAgreements.merchantId, merchantId)).orderBy(desc(merchantPromotionAgreements.updatedAt))
  ]);
  const statementLines = statements.length
    ? await db.select().from(merchantPlatformStatementLines).where(inArray(merchantPlatformStatementLines.statementId, statements.map((row) => row.statement.id)))
    : [];
  const linesByStatement = new Map<string, typeof statementLines>();
  for (const line of statementLines) linesByStatement.set(line.statementId, [...(linesByStatement.get(line.statementId) || []), line]);
  return { terms, statements: statements.map((row) => ({ ...row, lines: linesByStatement.get(row.statement.id) || [] })), reports, promotionAgreements };
}

export async function getAdminPlatformRevenue() {
  const [terms, promotionAgreements, statements, reports] = await Promise.all([
    db.select({ terms: merchantRevenueTerms, storeName: stores.name, storeNumber: stores.storeNumber }).from(merchantRevenueTerms).innerJoin(stores, eq(merchantRevenueTerms.storeId, stores.id)).orderBy(desc(merchantRevenueTerms.updatedAt)).limit(300),
    db.select({ agreement: merchantPromotionAgreements, storeName: stores.name, storeNumber: stores.storeNumber }).from(merchantPromotionAgreements).innerJoin(stores, eq(merchantPromotionAgreements.storeId, stores.id)).orderBy(desc(merchantPromotionAgreements.updatedAt)).limit(300),
    db.select({ statement: merchantPlatformStatements, storeName: stores.name, storeNumber: stores.storeNumber }).from(merchantPlatformStatements).innerJoin(stores, eq(merchantPlatformStatements.storeId, stores.id)).orderBy(desc(merchantPlatformStatements.periodStart)).limit(300),
    db.select({ report: merchantSalesReports, storeName: stores.name, storeNumber: stores.storeNumber }).from(merchantSalesReports).innerJoin(stores, eq(merchantSalesReports.storeId, stores.id)).where(inArray(merchantSalesReports.status, ["submitted", "rejected"])).orderBy(desc(merchantSalesReports.submittedAt)).limit(300)
  ]);
  const statementLines = statements.length
    ? await db.select().from(merchantPlatformStatementLines).where(inArray(merchantPlatformStatementLines.statementId, statements.map((row) => row.statement.id)))
    : [];
  const linesByStatement = new Map<string, typeof statementLines>();
  for (const line of statementLines) linesByStatement.set(line.statementId, [...(linesByStatement.get(line.statementId) || []), line]);
  const enrichedStatements = statements.map((row) => ({ ...row, lines: linesByStatement.get(row.statement.id) || [] }));
  const outstanding = enrichedStatements.filter((row) => ["issued", "overdue", "payment_submitted"].includes(row.statement.status)).reduce((sum, row) => sum + amount(row.statement.totalAmount), 0);
  return { terms, promotionAgreements, statements: enrichedStatements, reports, outstanding };
}

export { monthRange };
