import { describe, expect, it } from "vitest";
import { nextScheduledRun } from "@/lib/reports/scheduled";

describe("scheduled reports", () => {
  it("calculates the next daily, weekly and monthly run", () => {
    const from = new Date("2026-07-13T10:00:00.000Z");
    expect(nextScheduledRun(from, "daily").toISOString()).toBe("2026-07-14T10:00:00.000Z");
    expect(nextScheduledRun(from, "weekly").toISOString()).toBe("2026-07-20T10:00:00.000Z");
    expect(nextScheduledRun(from, "monthly").toISOString()).toBe("2026-08-13T10:00:00.000Z");
  });
});
