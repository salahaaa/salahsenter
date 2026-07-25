import { describe, expect, it } from "vitest";
import { buildDefaultContract, contractBodyHash } from "@/lib/contracts";
import { renderSignedContractPdf } from "@/lib/onboarding/application-pdf-archive";

describe("signed onboarding contract archive", () => {
  it("binds the commercial terms into the default contract body", () => {
    const body = buildDefaultContract({ storeName: "متجر اليمن", applicantName: "تاجر اليمن", businessActivity: "إلكترونيات", applicantEmail: "merchant@example.test", revenueModel: "hybrid", monthlyRent: "10000", commissionRate: "5", dueDays: 7, graceDays: 7 } as any);
    expect(body).toContain("إيجار شهري + عمولة مبيعات");
    expect(body).toContain("10000");
    expect(contractBodyHash(body)).toHaveLength(64);
  });

  it("renders a downloadable PDF binary for a signed contract archive", async () => {
    const pdf = await renderSignedContractPdf({
      application: {
        id: "00000000-0000-4000-8000-000000000001",
        onboardingContractNumber: "CTR-2026-TEST",
        storeName: "متجر اليمن",
        applicantName: "تاجر اليمن",
        applicantEmail: "merchant@example.test",
        contractVersion: "1.0",
        contractAcceptedAt: new Date("2026-07-14T00:00:00.000Z"),
        contractSignatureDataUrl: null,
        signedContractSnapshot: { signerName: "تاجر اليمن" }
      } as any,
      contractBody: "نص عقد تجريبي"
    });
    expect(pdf.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(1_000);
  });
});
