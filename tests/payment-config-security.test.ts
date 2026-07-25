import { describe, expect, it } from "vitest";
import { parsePaymentInstructionConfig, toPaymentMethodClientDto } from "@/lib/payments/config";
import { normalizePaymentConfig } from "@/lib/payments/methods";

describe("payment configuration boundary", () => {
  it("rejects credential and endpoint keys on new payment-method writes", () => {
    expect(() => parsePaymentInstructionConfig({ accountNumber: "123", apiKey: "should-not-be-stored" })).toThrow();
    expect(() => parsePaymentInstructionConfig({ createPaymentUrl: "https://internal.example" })).toThrow();
  });

  it("allow-lists legacy payment config before creating customer instructions", () => {
    const instructions = normalizePaymentConfig("bank_transfer", {
      bankName: "Bank",
      accountNumber: "12345",
      apiKey: "secret-key",
      authorizationHeader: "Bearer secret-key",
      createPaymentUrl: "https://gateway.example/pay"
    });
    expect(instructions.fields).toEqual(expect.objectContaining({ bankName: "Bank", accountNumber: "12345" }));
    expect(instructions.fields).not.toHaveProperty("apiKey");
    expect(instructions.fields).not.toHaveProperty("authorizationHeader");
    expect(instructions.fields).not.toHaveProperty("createPaymentUrl");
  });

  it("never serializes database config to a browser payment-method DTO", () => {
    const dto = toPaymentMethodClientDto({
      id: "method-1",
      storeId: "store-1",
      financialProviderId: "provider-1",
      merchantFinancialAccountId: "account-1",
      name: "Gateway",
      code: "gateway",
      description: null,
      provider: "local_gateway",
      isActive: true,
      sortOrder: 1,
      config: { apiKey: "secret-key" }
    } as any);
    expect(dto).not.toHaveProperty("config");
    expect(JSON.stringify(dto)).not.toContain("secret-key");
    expect(dto).not.toHaveProperty("merchantFinancialAccountId");
  });
});
