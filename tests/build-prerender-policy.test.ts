import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rootLayout = readFileSync("app/layout.tsx", "utf8");
const adminLayout = readFileSync("app/admin/layout.tsx", "utf8");
const merchantLayout = readFileSync("app/merchant/layout.tsx", "utf8");
const tenantContext = readFileSync("lib/tenancy/context.ts", "utf8");
const identity = readFileSync("lib/platform-identity.ts", "utf8");
const homeContent = readFileSync("lib/home-content.ts", "utf8");
const welcomePopup = readFileSync("lib/welcome-popup.ts", "utf8");

describe("build prerender policy", () => {
  it("forces database-backed routes to render dynamically instead of exporting them during build", () => {
    expect(rootLayout).toContain('export const dynamic = "force-dynamic"');
    expect(adminLayout).toContain('export const dynamic = "force-dynamic"');
    expect(merchantLayout).toContain('export const dynamic = "force-dynamic"');
  });

  it("does not let root layout configuration query PostgreSQL while Next is building special pages", () => {
    expect(tenantContext).toContain("isNextProductionBuildPhase()");
    expect(identity).toContain("if (isNextProductionBuildPhase()) return defaultPlatformIdentity");
    expect(homeContent).toContain("if (isNextProductionBuildPhase()) return defaultHomeContent");
    expect(welcomePopup).toContain("if (isNextProductionBuildPhase()) return defaultWelcomePopup");
  });
});
