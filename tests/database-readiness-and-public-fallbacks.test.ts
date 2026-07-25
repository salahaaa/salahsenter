import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyDatabaseError, publicDatabaseReadinessCopy } from "@/lib/database-readiness";

const healthRoute = readFileSync("app/api/health/route.ts", "utf8");
const offersPage = readFileSync("app/offers/page.tsx", "utf8");
const wingPage = readFileSync("app/wings/[slug]/page.tsx", "utf8");
const storePage = readFileSync("app/store/[slug]/page.tsx", "utf8");
const home = readFileSync("components/home/luxury-marketplace-home.tsx", "utf8");
const observability = readFileSync("app/admin/observability/page.tsx", "utf8");

describe("database readiness classification", () => {
  it("separates missing migrations from an unavailable database", () => {
    expect(classifyDatabaseError({ code: "42P01" }).state).toBe("schema_incomplete");
    expect(classifyDatabaseError({ code: "42703" }).state).toBe("schema_incomplete");
    expect(classifyDatabaseError({ code: "28P01" }).state).toBe("unavailable");
    expect(classifyDatabaseError(new Error("connection timeout while querying database")).state).toBe("unavailable");
  });

  it("uses public-safe copy without leaking SQL or connection details", () => {
    const copy = publicDatabaseReadinessCopy("schema_incomplete");
    expect(copy.title).toContain("إعداد قاعدة البيانات");
    expect(copy.description).toContain("migrations");
    expect(copy.description).not.toContain("postgresql");
  });
});

describe("honest public data fallbacks", () => {
  it("reports schema readiness through deep health without returning raw driver errors", () => {
    expect(healthRoute).toContain("getDatabaseReadiness");
    expect(healthRoute).toContain("schema: { ok: schemaReady");
    expect(healthRoute).not.toContain("error: error instanceof Error");
  });

  it("uses the shared readiness notice for offers, wings and store failures", () => {
    expect(offersPage).toContain("DatabaseReadinessState");
    expect(wingPage).toContain("DatabaseReadinessState");
    expect(storePage).toContain("StoreDataUnavailable");
  });

  it("does not fabricate clickable store or wing slugs when the catalogue is empty", () => {
    expect(home).not.toContain("const fallbackStores");
    expect(home).not.toContain("const fallbackWings");
    expect(home).not.toContain('slug: "tech-store"');
    expect(home).not.toContain("افتتاح 12 متجراً جديداً");
    expect(home).toContain("const featuredStores = visibilityRules.stores.limit > 0 ? realStores.slice(0, 3) : [];");
  });

  it("shows authorized administrators the schema state and missing operational tables", () => {
    expect(observability).toContain("تشخيص قاعدة البيانات");
    expect(observability).toContain("databaseReadiness.missingTables");
  });
});
