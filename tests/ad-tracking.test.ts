import { describe, expect, it } from "vitest";
import {
  adEventKey,
  adImpressionFrequencyCap,
  hashAdTrackingId,
  isTrackableAdCampaign,
  startOfUtcDay
} from "@/lib/ads/tracking";

const campaignId = "7da1c8dc-02e3-49a7-a5bc-4b1fa6626d37";
const visitor = "browser-visitor-33d1d877-9d54-45d2-8dbf-0a414877c884";

describe("sponsored ad tracking safeguards", () => {
  it("hashes browser identifiers without retaining the raw value", () => {
    const hash = hashAdTrackingId(visitor);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(visitor);
    expect(hashAdTrackingId(visitor)).toBe(hash);
  });

  it("deduplicates impression retries in a short bucket while leaving daily frequency to the server cap", () => {
    const visitorHash = hashAdTrackingId(visitor)!;
    const first = adEventKey({ eventType: "impression", campaignId, placement: "homepage_marketplace_ads", visitorHash, occurredAt: new Date("2026-07-12T01:00:00.000Z") });
    const sameBucket = adEventKey({ eventType: "impression", campaignId, placement: "homepage_marketplace_ads", visitorHash, occurredAt: new Date("2026-07-12T01:04:00.000Z") });
    const nextBucket = adEventKey({ eventType: "impression", campaignId, placement: "homepage_marketplace_ads", visitorHash, occurredAt: new Date("2026-07-12T01:05:00.000Z") });

    expect(first).toBe(sameBucket);
    expect(nextBucket).not.toBe(first);
  });

  it("deduplicates click events within the five-minute protection window", () => {
    const visitorHash = hashAdTrackingId(visitor)!;
    const first = adEventKey({ eventType: "click", campaignId, placement: "homepage_marketplace_ads", visitorHash, occurredAt: new Date("2026-07-12T01:02:00.000Z") });
    const sameBucket = adEventKey({ eventType: "click", campaignId, placement: "homepage_marketplace_ads", visitorHash, occurredAt: new Date("2026-07-12T01:04:59.000Z") });
    const nextBucket = adEventKey({ eventType: "click", campaignId, placement: "homepage_marketplace_ads", visitorHash, occurredAt: new Date("2026-07-12T01:05:00.000Z") });

    expect(first).toBe(sameBucket);
    expect(nextBucket).not.toBe(first);
  });

  it("only tracks displayable campaigns inside their configured schedule", () => {
    const now = new Date("2026-07-12T12:00:00.000Z");
    expect(isTrackableAdCampaign({ status: "active", startsAt: new Date("2026-07-11T00:00:00.000Z"), endsAt: new Date("2026-07-13T00:00:00.000Z") }, now)).toBe(true);
    expect(isTrackableAdCampaign({ status: "paused", startsAt: null, endsAt: null }, now)).toBe(false);
    expect(isTrackableAdCampaign({ status: "approved", startsAt: new Date("2026-07-13T00:00:00.000Z"), endsAt: null }, now)).toBe(false);
  });

  it("keeps the low-level UTC helper stable and bounds the frequency cap", () => {
    expect(startOfUtcDay(new Date("2026-07-12T23:59:59.000Z")).toISOString()).toBe("2026-07-12T00:00:00.000Z");
    expect(adImpressionFrequencyCap()).toBeGreaterThanOrEqual(1);
    expect(adImpressionFrequencyCap()).toBeLessThanOrEqual(20);
  });
});
