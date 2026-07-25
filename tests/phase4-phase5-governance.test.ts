import { describe, expect, it } from "vitest";
import { cmsSnapshot } from "@/lib/cms/versioning";
import { utcDayRange } from "@/lib/finance/close";
import { normalizeTenantHost } from "@/lib/tenancy/context";

describe("phase 4/5 governance helpers", () => {
  it("keeps CMS version snapshots limited to restore-safe page fields", () => {
    const snapshot = cmsSnapshot({ id: "internal-id", title: "سياسة الخصوصية", slug: "privacy", type: "privacy", content: "النص", status: "draft", seo: { title: "SEO" }, isSystem: true, sortOrder: 3, createdBy: "secret-owner" });
    expect(snapshot).toMatchObject({ title: "سياسة الخصوصية", slug: "privacy", content: "النص", isSystem: true });
    expect(snapshot).not.toHaveProperty("id");
    expect(snapshot).not.toHaveProperty("createdBy");
  });

  it("calculates the previous UTC day close window", () => {
    const range = utcDayRange(new Date("2026-07-12T14:00:00.000Z"));
    expect(range.start.toISOString()).toBe("2026-07-11T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-07-12T00:00:00.000Z");
  });

  it("normalizes forwarded tenant hosts without trusting protocol or port", () => {
    expect(normalizeTenantHost("HTTPS://Mall.Example.YE:443/path, proxy.local")).toBe("mall.example.ye");
    expect(normalizeTenantHost("tenant.local:3000")).toBe("tenant.local");
  });
});
