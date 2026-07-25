import { describe, expect, it } from "vitest";
import { aiProviderHealth, generateAiText } from "@/lib/ai/gateway";

describe("provider-neutral AI gateway", () => {
  it("falls back to deterministic approval-required mode without a configured provider secret", async () => {
    const previous = process.env.AI_PROVIDER;
    delete process.env.AI_PROVIDER;
    const result = await generateAiText({ system: "safe", prompt: "test", fallback: "نتيجة محلية" });
    expect(result).toMatchObject({ provider: "rules", external: false, safetyMode: "approval_required", text: "نتيجة محلية" });
    if (previous) process.env.AI_PROVIDER = previous;
  });

  it("reports rules as the safe default runtime", () => {
    const previous = process.env.AI_PROVIDER;
    delete process.env.AI_PROVIDER;
    expect(aiProviderHealth()).toMatchObject({ active: "rules", approvalRequired: true });
    if (previous) process.env.AI_PROVIDER = previous;
  });
});
