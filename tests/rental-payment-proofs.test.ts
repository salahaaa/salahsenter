import { describe, expect, it } from "vitest";
import {
  canSubmitRentalPaymentProof,
  readRentalPaymentProof,
  statusAfterRentalPaymentProofRejected,
  withReviewedRentalPaymentProof,
  withSubmittedRentalPaymentProof
} from "@/lib/rentals/payment-proofs";

const submittedProof = {
  assetId: "6e0d0e92-4e2b-4ce7-8860-c17f2ee9ebd9",
  url: "/uploads/rental-payment-proofs/receipt.png",
  storageKey: "rental-payment-proofs/receipt.png",
  paymentReference: "HAW-1024",
  note: "سداد عبر حوالة",
  submittedAt: "2026-07-12T10:00:00.000Z",
  submittedBy: "5a3f4495-2bb4-4f6e-bf3b-a7a1335c14b7"
};

describe("rental payment proof lifecycle helpers", () => {
  it("stores a submitted proof and can read it back", () => {
    const metadata = withSubmittedRentalPaymentProof({ addons: [] }, submittedProof);
    expect(readRentalPaymentProof(metadata)).toMatchObject({ ...submittedProof, status: "submitted" });
  });

  it("preserves a rejected proof in history when a replacement is submitted", () => {
    const first = withSubmittedRentalPaymentProof({}, submittedProof);
    const rejected = withReviewedRentalPaymentProof(first, {
      status: "rejected",
      reviewedAt: new Date("2026-07-12T11:00:00.000Z"),
      reviewedBy: "6c64f447-2f11-4676-a84f-a05f7f83ad2a",
      reviewNote: "الصورة غير واضحة"
    });
    const replacement = withSubmittedRentalPaymentProof(rejected, { ...submittedProof, assetId: "fe2d6267-22ac-4e57-9650-b3dd2f70dfd3", url: "/uploads/rental-payment-proofs/replacement.png" });

    expect(readRentalPaymentProof(replacement)).toMatchObject({ assetId: "fe2d6267-22ac-4e57-9650-b3dd2f70dfd3", status: "submitted" });
    expect(replacement.paymentProofHistory).toHaveLength(1);
    expect((replacement.paymentProofHistory as Array<{ status: string }>)[0].status).toBe("rejected");
  });

  it("accepts submission only for unpaid invoice states", () => {
    expect(canSubmitRentalPaymentProof("issued")).toBe(true);
    expect(canSubmitRentalPaymentProof("overdue")).toBe(true);
    expect(canSubmitRentalPaymentProof("payment_submitted")).toBe(false);
    expect(canSubmitRentalPaymentProof("paid")).toBe(false);
  });

  it("returns an appropriate invoice state after proof rejection", () => {
    const now = new Date("2026-07-12T12:00:00.000Z");
    expect(statusAfterRentalPaymentProofRejected(new Date("2026-07-11T12:00:00.000Z"), now)).toBe("overdue");
    expect(statusAfterRentalPaymentProofRejected(new Date("2026-07-13T12:00:00.000Z"), now)).toBe("issued");
  });
});
