import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";
import { middleware } from "@/middleware";

process.env.JWT_SECRET = "test-jwt-secret-key-at-least-32-characters-long";

const event = () => ({ waitUntil: vi.fn(), passThroughOnException: vi.fn() }) as unknown as NextFetchEvent;

async function run(pathname: string, headers?: HeadersInit) {
  return middleware(new NextRequest(`http://localhost:3000${pathname}`, { method: "POST", headers, body: "{}" }), event());
}

describe("CSRF webhook exemptions", () => {
  it("allows only the exact signed-provider webhook paths to reach their route handlers", async () => {
    expect((await run("/api/payments/stripe/webhook"))?.status).not.toBe(403);
    expect((await run("/api/payments/local-gateway/webhook"))?.status).not.toBe(403);
  });


  it("requires a machine credential before an integration mutation can bypass CSRF", async () => {
    expect((await run("/api/integrations/inventory"))?.status).toBe(403);
    expect((await run("/api/integrations/inventory", { "x-api-key": "a".repeat(32) }))?.status).not.toBe(403);
  });

  it("keeps CSRF enforcement on normal mutations and lookalike webhook paths", async () => {
    expect((await run("/api/payments/checkout"))?.status).toBe(403);
    expect((await run("/api/payments/stripe/webhook/extra"))?.status).toBe(403);
  });
});
