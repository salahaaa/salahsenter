import { describe, expect, it } from "vitest";
import { merchantApplicationStatusSchema, contractSignatureSchema } from "@/lib/validators";
import { defaultMerchantDocumentRequirements } from "@/lib/onboarding/merchant-application-documents";

describe("merchant onboarding gap closure policy", () => {
  it("defines required legal document requirements independently of an upload", () => {
    expect(defaultMerchantDocumentRequirements.filter((item) => item.isRequired).map((item) => item.documentType)).toEqual(["identity", "commercial_register", "tax_card"]);
  });

  it("does not accept a status mutation through the legacy generic admin note schema", () => {
    const parsed = merchantApplicationStatusSchema.parse({ status: "active", adminNote: "ملاحظة" });
    expect(parsed).toEqual({ adminNote: "ملاحظة" });
  });

  it("requires a concrete contract version in every signature payload", () => {
    expect(contractSignatureSchema.safeParse({ accepted: true, signerName: "تاجر", signatureDataUrl: "data:image/png;base64,abc" }).success).toBe(false);
    expect(contractSignatureSchema.safeParse({ accepted: true, signerName: "تاجر", signatureDataUrl: "data:image/png;base64,abc", contractVersion: "1.4" }).success).toBe(true);
  });
});
