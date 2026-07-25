import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeCache = readFileSync("lib/cache/public-home-cache.ts", "utf8");
const homeQueries = readFileSync("lib/db/queries.ts", "utf8");
const middleware = readFileSync("middleware.ts", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const ci = readFileSync(".github/workflows/ci.yml", "utf8");

describe("runtime resilience policy", () => {
  it("gives the public homepage a bounded read budget and a non-cached safe fallback", () => {
    expect(homeCache).toContain("HOME_DATA_TIMEOUT_MS");
    expect(homeCache).toContain("HomeDataTimeoutError");
    expect(homeCache).toContain("serving safe fallback without caching it");
    expect(homeQueries).toContain("export function getHomeDataFallback()");
  });

  it("keeps database work out of middleware and enforces import-path casing in CI", () => {
    expect(middleware).not.toMatch(/@\/lib\/db|drizzle-orm|postgres/);
    expect(packageJson.scripts["check:import-case"]).toBe("node scripts/check-import-path-casing.mjs");
    expect(ci).toContain("npm run check:import-case");
  });
});
