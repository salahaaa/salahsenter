import { and, desc, eq, gt, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { ApiError } from "@/lib/api";
import {
  calculateRentalEntitlements,
  evaluateRentalResourceLimit,
  type RentalResource
} from "@/lib/rentals/entitlements";
import {
  canSubmitRentalPaymentProof,
  readRentalPaymentProof,
  statusAfterRentalPaymentProofRejected,
  withReviewedRentalPaymentProof,
  withSubmittedRentalPaymentProof
} from "@/lib/rentals/payment-proofs";
import { notifyAdmins } from "@/lib/notifications";
import {
  db,
  notifications,
  rentalAddons,
  storeRentalAddonAssignments,
  storeRentalAgreements,
  storeRentalInvoices,
  stores,
  subscriptions,
  users
} from "@/lib/db";

type DbLike = any;
export type BillingCycle = "monthly" | "quarterly" | "semi_annual" | "annual";

export function nextRentalCycleDate(start: Date, cycle: BillingCycle) {
  const next = new Date(start);
  if (cycle === "annual") next.setFullYear(next.getFullYear() + 1);
  else if (cycle === "semi_annual") next.setMonth(next.getMonth() + 6);
  else if (cycle === "quarterly") next.setMonth(next.getMonth() + 3);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

async function invoiceNumber(tx: DbLike) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const value = `RNT-${new Date().getFullYear()}-${nanoid(9).toUpperCase()}`;
    const [existing] = await tx.select({ id: storeRentalInvoices.id }).from(storeRentalInvoices).where(eq(storeRentalInvoices.invoiceNumber, value)).limit(1);
    if (!existing) return value;
  }
  throw new Error("تعذر توليد رقم فاتورة إيجار فريد");
}

export async function createOrUpdateRentalAgreement(input: {
  storeId: string;
  merchantId: string;
  contractId?: string | null;
  subscriptionId?: string | null;
  baseRent: number;
  currency?: string;
  billingCycle?: BillingCycle;
  graceDays?: number;
  startsAt?: Date;
  endsAt?: Date | null;
  status?: "draft" | "active" | "grace" | "overdue" | "frozen" | "terminated";
  createdBy?: string | null;
  tx?: DbLike;
}) {
  const tx = input.tx || db;
  const startsAt = input.startsAt || new Date();
  const billingCycle = input.billingCycle || "monthly";
  const nextInvoiceAt = nextRentalCycleDate(startsAt, billingCycle);
  const [existing] = await tx.select().from(storeRentalAgreements).where(eq(storeRentalAgreements.storeId, input.storeId)).limit(1);
  const values = {
    merchantId: input.merchantId,
    contractId: input.contractId || null,
    subscriptionId: input.subscriptionId || null,
    baseRent: Math.max(0, input.baseRent).toString(),
    currency: input.currency || "YER",
    billingCycle,
    graceDays: Math.max(0, input.graceDays ?? 7),
    startsAt,
    endsAt: input.endsAt || null,
    nextInvoiceAt,
    status: input.status || "active",
    createdBy: input.createdBy || null,
    updatedAt: new Date()
  };
  if (existing) return (await tx.update(storeRentalAgreements).set(values).where(eq(storeRentalAgreements.id, existing.id)).returning())[0];
  return (await tx.insert(storeRentalAgreements).values({ storeId: input.storeId, ...values }).returning())[0];
}

export async function assignRentalAddon(input: { agreementId: string; addonId: string; quantity?: number; unitPrice?: number; actorId?: string | null }) {
  const [addon] = await db.select().from(rentalAddons).where(and(eq(rentalAddons.id, input.addonId), eq(rentalAddons.isActive, true))).limit(1);
  if (!addon) throw new Error("الإضافة غير موجودة أو غير مفعلة");
  const quantity = Math.max(1, Math.floor(input.quantity || 1));
  const unitPrice = input.unitPrice ?? Number(addon.price || 0);
  const [assignment] = await db
    .insert(storeRentalAddonAssignments)
    .values({ agreementId: input.agreementId, addonId: addon.id, quantity, unitPrice: unitPrice.toString(), status: "active", metadata: { actorId: input.actorId || null, entitlementKey: addon.entitlementKey } })
    .onConflictDoUpdate({ target: [storeRentalAddonAssignments.agreementId, storeRentalAddonAssignments.addonId], set: { quantity, unitPrice: unitPrice.toString(), status: "active", updatedAt: new Date() } })
    .returning();
  return { addon, assignment };
}

export async function issueRentalInvoice(agreementId: string, options: { tx?: DbLike; dueDays?: number } = {}) {
  const tx = options.tx || db;
  const [agreement] = await tx.select().from(storeRentalAgreements).where(eq(storeRentalAgreements.id, agreementId)).limit(1);
  if (!agreement) throw new Error("اتفاق الإيجار غير موجود");
  if (!["active", "grace", "overdue"].includes(agreement.status)) return null;
  const periodStart = agreement.nextInvoiceAt || new Date();
  const periodEnd = nextRentalCycleDate(new Date(periodStart), agreement.billingCycle as BillingCycle);
  const [existing] = await tx.select({ id: storeRentalInvoices.id }).from(storeRentalInvoices).where(and(eq(storeRentalInvoices.agreementId, agreement.id), eq(storeRentalInvoices.periodStart, periodStart))).limit(1);
  if (existing) return null;
  const addons: Array<{ assignment: typeof storeRentalAddonAssignments.$inferSelect; addon: typeof rentalAddons.$inferSelect }> = await tx
    .select({ assignment: storeRentalAddonAssignments, addon: rentalAddons })
    .from(storeRentalAddonAssignments)
    .innerJoin(rentalAddons, eq(storeRentalAddonAssignments.addonId, rentalAddons.id))
    .where(and(eq(storeRentalAddonAssignments.agreementId, agreement.id), eq(storeRentalAddonAssignments.status, "active"), eq(rentalAddons.isActive, true)));
  const addonsAmount = addons.reduce((sum, row) => sum + Number(row.assignment.unitPrice || 0) * Number(row.assignment.quantity || 1), 0);
  const baseAmount = Number(agreement.baseRent || 0);
  const totalAmount = baseAmount + addonsAmount;
  const dueAt = new Date(periodStart);
  dueAt.setDate(dueAt.getDate() + Math.max(1, options.dueDays || 7));
  const [invoice] = await tx
    .insert(storeRentalInvoices)
    .values({
      agreementId: agreement.id,
      storeId: agreement.storeId,
      merchantId: agreement.merchantId,
      invoiceNumber: await invoiceNumber(tx),
      invoiceType: "recurring_rent",
      periodStart,
      periodEnd,
      baseAmount: baseAmount.toString(),
      addonsAmount: addonsAmount.toString(),
      totalAmount: totalAmount.toString(),
      currency: agreement.currency,
      status: "issued",
      dueAt,
      metadata: { addons: addons.map((row) => ({ addonId: row.addon.id, code: row.addon.code, name: row.addon.name, quantity: row.assignment.quantity, unitPrice: row.assignment.unitPrice })) }
    })
    .returning();
  await tx.update(storeRentalAgreements).set({ nextInvoiceAt: periodEnd, updatedAt: new Date() }).where(eq(storeRentalAgreements.id, agreement.id));
  return invoice;
}

export async function processRentalBillingCycle(limit = 100) {
  const now = new Date();
  const agreements = (await db.select().from(storeRentalAgreements).where(and(inArray(storeRentalAgreements.status, ["active", "grace", "overdue"]), lte(storeRentalAgreements.nextInvoiceAt, now))).limit(Math.max(1, Math.min(limit, 500) * 3)))
    // Stores moved to unified platform statements must never receive a duplicate legacy rent invoice.
    .filter((agreement) => !agreement.consolidatedBilling)
    .slice(0, Math.max(1, Math.min(limit, 500)));
  const issued = [];
  for (const agreement of agreements) {
    const invoice = await db.transaction(async (tx) => issueRentalInvoice(agreement.id, { tx }));
    if (invoice) {
      issued.push(invoice);
      await db.insert(notifications).values({ userId: agreement.merchantId, storeId: agreement.storeId, title: "فاتورة إيجار جديدة", body: `تم إصدار فاتورة الإيجار ${invoice.invoiceNumber} بقيمة ${invoice.totalAmount} ${invoice.currency}.`, type: "rental_invoice_issued", data: { invoiceId: invoice.id, agreementId: agreement.id, dueAt: invoice.dueAt } });
    }
  }
  const overdueInvoices = await db
    .select()
    .from(storeRentalInvoices)
    .where(and(inArray(storeRentalInvoices.status, ["issued", "pending"]), lte(storeRentalInvoices.dueAt, now)))
    .limit(500);
  const overdue = [];
  for (const invoice of overdueInvoices) {
    const [updated] = await db.update(storeRentalInvoices).set({ status: "overdue", updatedAt: now }).where(eq(storeRentalInvoices.id, invoice.id)).returning();
    await db.update(storeRentalAgreements).set({ status: "overdue", updatedAt: now }).where(eq(storeRentalAgreements.id, invoice.agreementId));
    overdue.push(updated);
  }
  return { issuedCount: issued.length, overdueCount: overdue.length, issued, overdue };
}

export async function submitRentalInvoicePaymentProof(input: {
  invoiceId: string;
  merchantId: string;
  assetId: string;
  proofUrl: string;
  storageKey?: string | null;
  paymentReference?: string | null;
  note?: string | null;
}) {
  const submittedAt = new Date();
  const result = await db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(storeRentalInvoices)
      .where(and(eq(storeRentalInvoices.id, input.invoiceId), eq(storeRentalInvoices.merchantId, input.merchantId)))
      .limit(1);
    if (!before) throw new ApiError("فاتورة الإيجار غير موجودة", 404);
    if (!canSubmitRentalPaymentProof(before.status)) {
      throw new ApiError(before.status === "payment_submitted" ? "إثبات السداد قيد مراجعة الإدارة بالفعل" : "لا يمكن رفع إثبات لهذه الفاتورة بحالتها الحالية", 409);
    }

    const metadata = withSubmittedRentalPaymentProof(before.metadata, {
      assetId: input.assetId,
      url: input.proofUrl,
      storageKey: input.storageKey || null,
      paymentReference: input.paymentReference || null,
      note: input.note || null,
      submittedAt: submittedAt.toISOString(),
      submittedBy: input.merchantId
    });
    const [invoice] = await tx
      .update(storeRentalInvoices)
      .set({
        status: "payment_submitted",
        paymentReference: input.paymentReference || before.paymentReference || null,
        metadata,
        updatedAt: submittedAt
      })
      .where(eq(storeRentalInvoices.id, before.id))
      .returning();
    return { before, invoice };
  });

  await notifyAdmins({
    title: "إثبات سداد إيجار جديد",
    body: `رفع التاجر إثبات سداد للفاتورة ${result.invoice.invoiceNumber}.`,
    type: "rental_invoice_payment_proof_submitted",
    data: { invoiceId: result.invoice.id, merchantId: input.merchantId, storeId: result.invoice.storeId, invoiceNumber: result.invoice.invoiceNumber, url: "/admin/rentals" }
  });
  return result;
}

export async function markRentalInvoicePaid(input: {
  invoiceId: string;
  paymentReference?: string | null;
  actorId?: string | null;
  reviewNote?: string | null;
  requirePaymentProof?: boolean;
}) {
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(storeRentalInvoices).where(eq(storeRentalInvoices.id, input.invoiceId)).limit(1);
    if (!before) throw new ApiError("فاتورة الإيجار غير موجودة", 404);
    if (before.status === "paid") throw new ApiError("فاتورة الإيجار مسددة بالفعل", 409);
    if (!["issued", "pending", "overdue", "payment_submitted"].includes(before.status)) {
      throw new ApiError("لا يمكن تأكيد السداد لهذه الفاتورة بحالتها الحالية", 409);
    }

    const proof = readRentalPaymentProof(before.metadata);
    if (input.requirePaymentProof && (!proof || proof.status !== "submitted")) {
      throw new ApiError("لا يوجد إثبات سداد قيد المراجعة لهذه الفاتورة", 409);
    }
    const metadata = proof && proof.status === "submitted" && input.actorId
      ? withReviewedRentalPaymentProof(before.metadata, { status: "approved", reviewedAt: now, reviewedBy: input.actorId, reviewNote: input.reviewNote })
      : before.metadata;
    const paymentReference = input.paymentReference || proof?.paymentReference || before.paymentReference || null;
    const [invoice] = await tx
      .update(storeRentalInvoices)
      .set({ status: "paid", paidAt: now, paymentReference, metadata, updatedAt: now })
      .where(eq(storeRentalInvoices.id, before.id))
      .returning();
    await tx.update(storeRentalAgreements).set({ status: "active", updatedAt: now }).where(eq(storeRentalAgreements.id, invoice.agreementId));
    return { before, invoice };
  });

  await db.insert(notifications).values({
    userId: result.invoice.merchantId,
    storeId: result.invoice.storeId,
    title: "تم تأكيد سداد إيجار المتجر",
    body: `تم اعتماد سداد الفاتورة ${result.invoice.invoiceNumber}.`,
    type: "rental_invoice_payment_approved",
    data: { invoiceId: result.invoice.id, invoiceNumber: result.invoice.invoiceNumber, url: "/merchant/billing" }
  });
  return result;
}

export async function rejectRentalInvoicePaymentProof(input: { invoiceId: string; actorId: string; reviewNote?: string | null }) {
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(storeRentalInvoices).where(eq(storeRentalInvoices.id, input.invoiceId)).limit(1);
    if (!before) throw new ApiError("فاتورة الإيجار غير موجودة", 404);
    if (before.status !== "payment_submitted") throw new ApiError("لا يوجد إثبات سداد قيد المراجعة لهذه الفاتورة", 409);
    const proof = readRentalPaymentProof(before.metadata);
    if (!proof || proof.status !== "submitted") throw new ApiError("إثبات السداد غير صالح أو تمت مراجعته مسبقًا", 409);

    const [invoice] = await tx
      .update(storeRentalInvoices)
      .set({
        status: statusAfterRentalPaymentProofRejected(before.dueAt, now),
        paymentReference: null,
        metadata: withReviewedRentalPaymentProof(before.metadata, { status: "rejected", reviewedAt: now, reviewedBy: input.actorId, reviewNote: input.reviewNote }),
        updatedAt: now
      })
      .where(eq(storeRentalInvoices.id, before.id))
      .returning();
    return { before, invoice };
  });

  await db.insert(notifications).values({
    userId: result.invoice.merchantId,
    storeId: result.invoice.storeId,
    title: "يحتاج إثبات سداد الإيجار إلى تعديل",
    body: input.reviewNote || `لم يتم اعتماد إثبات سداد الفاتورة ${result.invoice.invoiceNumber}. يرجى رفع إثبات جديد.`,
    type: "rental_invoice_payment_proof_rejected",
    data: { invoiceId: result.invoice.id, invoiceNumber: result.invoice.invoiceNumber, url: "/merchant/billing" }
  });
  return result;
}

export async function getMerchantRentalBilling(merchantId: string) {
  const [agreements, invoices, addons] = await Promise.all([
    db.select({ agreement: storeRentalAgreements, plan: subscriptions, storeName: stores.name, storeNumber: stores.storeNumber }).from(storeRentalAgreements).leftJoin(subscriptions, eq(storeRentalAgreements.subscriptionId, subscriptions.id)).innerJoin(stores, eq(storeRentalAgreements.storeId, stores.id)).where(eq(storeRentalAgreements.merchantId, merchantId)).orderBy(desc(storeRentalAgreements.createdAt)),
    db.select({ invoice: storeRentalInvoices, storeName: stores.name }).from(storeRentalInvoices).innerJoin(stores, eq(storeRentalInvoices.storeId, stores.id)).where(eq(storeRentalInvoices.merchantId, merchantId)).orderBy(desc(storeRentalInvoices.createdAt)).limit(100),
    db.select({ assignment: storeRentalAddonAssignments, addon: rentalAddons }).from(storeRentalAddonAssignments).innerJoin(rentalAddons, eq(storeRentalAddonAssignments.addonId, rentalAddons.id)).innerJoin(storeRentalAgreements, eq(storeRentalAddonAssignments.agreementId, storeRentalAgreements.id)).where(eq(storeRentalAgreements.merchantId, merchantId)).orderBy(desc(storeRentalAddonAssignments.createdAt)).limit(100)
  ]);
  return { agreements, invoices, addons };
}

export async function getAdminRentalCollections() {
  const [agreements, invoices, addons] = await Promise.all([
    db.select({ agreement: storeRentalAgreements, plan: subscriptions, storeName: stores.name, storeNumber: stores.storeNumber, merchantName: users.fullName, merchantEmail: users.email }).from(storeRentalAgreements).leftJoin(subscriptions, eq(storeRentalAgreements.subscriptionId, subscriptions.id)).innerJoin(stores, eq(storeRentalAgreements.storeId, stores.id)).innerJoin(users, eq(storeRentalAgreements.merchantId, users.id)).orderBy(desc(storeRentalAgreements.updatedAt)).limit(300),
    db.select({ invoice: storeRentalInvoices, storeName: stores.name, merchantName: users.fullName }).from(storeRentalInvoices).innerJoin(stores, eq(storeRentalInvoices.storeId, stores.id)).innerJoin(users, eq(storeRentalInvoices.merchantId, users.id)).where(inArray(storeRentalInvoices.status, ["issued", "pending", "overdue", "payment_submitted"])).orderBy(storeRentalInvoices.dueAt).limit(300),
    db.select().from(rentalAddons).orderBy(desc(rentalAddons.createdAt)).limit(100)
  ]);
  const totals = invoices.reduce((sum, row) => sum + Number(row.invoice.totalAmount || 0), 0);
  return { agreements, invoices, addons, totals };
}

export async function getStoreEntitlements(storeId: string, options: { tx?: DbLike } = {}) {
  const tx = options.tx || db;
  const [agreementRow] = await tx
    .select({ agreement: storeRentalAgreements, plan: subscriptions })
    .from(storeRentalAgreements)
    .leftJoin(subscriptions, eq(storeRentalAgreements.subscriptionId, subscriptions.id))
    .where(eq(storeRentalAgreements.storeId, storeId))
    .limit(1);

  if (!agreementRow) {
    return {
      ...calculateRentalEntitlements({ hasAgreement: false }),
      agreementId: null as string | null,
      subscriptionId: null as string | null
    };
  }

  const now = new Date();
  const assignments = await tx
    .select({ assignment: storeRentalAddonAssignments, addon: rentalAddons })
    .from(storeRentalAddonAssignments)
    .innerJoin(rentalAddons, eq(storeRentalAddonAssignments.addonId, rentalAddons.id))
    .where(
      and(
        eq(storeRentalAddonAssignments.agreementId, agreementRow.agreement.id),
        eq(storeRentalAddonAssignments.status, "active"),
        eq(rentalAddons.isActive, true),
        lte(storeRentalAddonAssignments.startsAt, now),
        or(isNull(storeRentalAddonAssignments.endsAt), gt(storeRentalAddonAssignments.endsAt, now))
      )
    );

  return {
    ...calculateRentalEntitlements({
      hasAgreement: true,
      agreementStatus: agreementRow.agreement.status,
      planLimits: agreementRow.plan
        ? {
            maxProducts: agreementRow.plan.maxProducts,
            maxEmployees: agreementRow.plan.maxEmployees,
            maxBranches: agreementRow.plan.maxBranches,
            maxAnnouncements: agreementRow.plan.maxAnnouncements,
            maxNews: agreementRow.plan.maxNews
          }
        : null,
      planFeatures: agreementRow.plan?.features || [],
      addons: assignments.map((row: { assignment: typeof storeRentalAddonAssignments.$inferSelect; addon: typeof rentalAddons.$inferSelect }) => ({
        entitlementKey: row.addon.entitlementKey,
        quantity: row.assignment.quantity,
        metadata: row.addon.metadata
      }))
    }),
    agreementId: agreementRow.agreement.id,
    subscriptionId: agreementRow.agreement.subscriptionId
  };
}

/** Serializes capacity checks for a store when called from a PostgreSQL transaction. */
export async function lockRentalEntitlement(storeId: string, tx?: DbLike) {
  if (!tx || tx === db) return;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`rental-entitlement:${storeId}`}))`);
}

/**
 * Enforces the commercial capacity of an agreement immediately before a new
 * resource is created. Callers should acquire `lockRentalEntitlement` before
 * reading their current count, then keep the same transaction through insert.
 */
export async function assertRentalLimit(input: {
  storeId: string;
  resource: RentalResource;
  currentCount: number;
  increment?: number;
  tx?: DbLike;
}) {
  const entitlements = await getStoreEntitlements(input.storeId, { tx: input.tx });
  const evaluation = evaluateRentalResourceLimit({
    entitlements,
    resource: input.resource,
    currentCount: input.currentCount,
    increment: input.increment
  });

  if (!evaluation.allowed) {
    throw new ApiError(evaluation.message || "تعذر التحقق من حد باقة الإيجار", evaluation.reason === "agreement_inactive" ? 403 : 409);
  }

  return { entitlements, ...evaluation };
}
