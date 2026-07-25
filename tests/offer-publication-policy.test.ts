import { describe, expect, it } from "vitest";
import { canMerchantRequestHomepageReview, initialOfferPublication, isHomepageLive, isStorefrontLive } from "@/lib/offers/publication-policy";
import { storeOfferCollectionSchema } from "@/lib/validators";

describe("offer publication policy", () => {
  it("publishes storefront-only offers immediately without granting homepage exposure", () => {
    const publication = initialOfferPublication("storefront", new Date("2026-07-16T10:00:00.000Z"));
    expect(publication.publicationState).toBe("storefront_live");
    expect(publication.legacyStatus).toBe("approved");
    expect(isStorefrontLive({ publicationTarget: "storefront", publicationState: publication.publicationState, status: publication.legacyStatus })).toBe(true);
    expect(isHomepageLive({ publicationTarget: "storefront", publicationState: publication.publicationState, status: publication.legacyStatus })).toBe(false);
  });

  it("sends homepage requests to review rather than making them public", () => {
    const publication = initialOfferPublication("homepage", new Date("2026-07-16T10:00:00.000Z"));
    expect(publication.publicationState).toBe("homepage_review");
    expect(publication.legacyStatus).toBe("pending_review");
    expect(isStorefrontLive({ publicationTarget: "homepage", publicationState: publication.publicationState, status: publication.legacyStatus })).toBe(false);
    expect(isHomepageLive({ publicationTarget: "homepage", publicationState: publication.publicationState, status: publication.legacyStatus })).toBe(false);
  });

  it("only treats approved homepage state as platform-public", () => {
    expect(isHomepageLive({ publicationTarget: "homepage", publicationState: "homepage_approved", status: "approved" })).toBe(true);
    expect(canMerchantRequestHomepageReview({ publicationTarget: "homepage", publicationState: "paused", status: "disabled" })).toBe(true);
    expect(canMerchantRequestHomepageReview({ publicationTarget: "storefront", publicationState: "storefront_live", status: "approved" })).toBe(false);
  });

  it("requires an explicit publication target, inventory quantity, and source variant", () => {
    const base = {
      publicationTarget: "storefront" as const,
      title: "باقة منزلية",
      startsAt: "2026-07-16T10:00:00.000Z",
      endsAt: "2026-07-20T10:00:00.000Z",
      bundlePrice: 100,
      bundleQuantity: 5,
      items: [{ productId: "00000000-0000-4000-8000-000000000001", variantId: "00000000-0000-4000-8000-000000000002", quantity: 1 }]
    };
    expect(storeOfferCollectionSchema.safeParse(base).success).toBe(true);
    expect(storeOfferCollectionSchema.safeParse({ ...base, publicationTarget: undefined }).success).toBe(false);
    expect(storeOfferCollectionSchema.safeParse({ ...base, bundleQuantity: 0 }).success).toBe(false);
    expect(storeOfferCollectionSchema.safeParse({ ...base, items: [{ ...base.items[0], variantId: undefined }] }).success).toBe(false);
  });
});
