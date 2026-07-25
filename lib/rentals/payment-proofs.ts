export type RentalPaymentProofStatus = "submitted" | "approved" | "rejected";

export type RentalPaymentProof = {
  assetId: string;
  url: string;
  storageKey?: string | null;
  paymentReference?: string | null;
  note?: string | null;
  submittedAt: string;
  submittedBy: string;
  status: RentalPaymentProofStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function isProofStatus(value: unknown): value is RentalPaymentProofStatus {
  return value === "submitted" || value === "approved" || value === "rejected";
}

export function readRentalPaymentProof(metadata: unknown): RentalPaymentProof | null {
  const value = asRecord(asRecord(metadata).paymentProof);
  const assetId = asString(value.assetId);
  const url = asString(value.url);
  const submittedAt = asString(value.submittedAt);
  const submittedBy = asString(value.submittedBy);
  if (!assetId || !url || !submittedAt || !submittedBy || !isProofStatus(value.status)) return null;

  return {
    assetId,
    url,
    storageKey: asString(value.storageKey),
    paymentReference: asString(value.paymentReference),
    note: asString(value.note),
    submittedAt,
    submittedBy,
    status: value.status,
    reviewedAt: asString(value.reviewedAt) || undefined,
    reviewedBy: asString(value.reviewedBy) || undefined,
    reviewNote: asString(value.reviewNote)
  };
}

function proofHistory(metadata: Record<string, unknown>) {
  return Array.isArray(metadata.paymentProofHistory) ? metadata.paymentProofHistory.slice(-19) : [];
}

/** Preserves a previously rejected proof before a merchant submits a replacement. */
export function withSubmittedRentalPaymentProof(metadata: unknown, proof: Omit<RentalPaymentProof, "status">): Record<string, unknown> {
  const current = readRentalPaymentProof(metadata);
  const next = asRecord(metadata);
  const history = proofHistory(next);
  if (current) history.push(current);
  return {
    ...next,
    paymentProof: { ...proof, status: "submitted" },
    ...(history.length ? { paymentProofHistory: history } : {})
  };
}

export function withReviewedRentalPaymentProof(
  metadata: unknown,
  input: { status: Extract<RentalPaymentProofStatus, "approved" | "rejected">; reviewedAt: Date; reviewedBy: string; reviewNote?: string | null }
): Record<string, unknown> {
  const current = readRentalPaymentProof(metadata);
  if (!current) throw new Error("لا يوجد إثبات سداد صالح لمراجعته");
  return {
    ...asRecord(metadata),
    paymentProof: {
      ...current,
      status: input.status,
      reviewedAt: input.reviewedAt.toISOString(),
      reviewedBy: input.reviewedBy,
      reviewNote: input.reviewNote || null
    }
  };
}

export function canSubmitRentalPaymentProof(invoiceStatus: string) {
  return ["issued", "pending", "overdue"].includes(invoiceStatus);
}

export function statusAfterRentalPaymentProofRejected(dueAt: Date | null, now = new Date()) {
  return dueAt && dueAt.getTime() <= now.getTime() ? "overdue" : "issued";
}
