import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const outbound = readFileSync("lib/outbound.ts", "utf8");
const readiness = readFileSync("lib/production/readiness.ts", "utf8");

describe("transactional outbound delivery policy", () => {
  it("does not log recipient/message payloads when a configured channel is missing and bounds webhook latency", () => {
    expect(outbound).toContain("safeDeliveryMetadata");
    expect(outbound).not.toContain("console.log(`${kind}_NOTIFICATION`, input)");
    expect(outbound).toContain("AbortSignal.timeout(timeoutMs())");
    expect(outbound).toContain("must use HTTPS in production");
  });

  it("requires both Email and SMS in production readiness for the chosen launch policy", () => {
    expect(readiness).toContain("const emailOutboundReady");
    expect(readiness).toContain("const smsOutboundReady");
    expect(readiness).toContain("emailOutboundReady && smsOutboundReady");
    expect(readiness).toContain('"Email + SMS"');
  });
});
