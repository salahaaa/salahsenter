export const offerPublicationTargets = ["storefront", "homepage"] as const;
export type OfferPublicationTarget = (typeof offerPublicationTargets)[number];

export const offerPublicationStates = ["draft", "storefront_live", "homepage_review", "homepage_approved", "rejected", "paused", "expired"] as const;
export type OfferPublicationState = (typeof offerPublicationStates)[number];

export function initialOfferPublication(target: OfferPublicationTarget, now = new Date()) {
  if (target === "storefront") {
    return {
      publicationTarget: target,
      publicationState: "storefront_live" as const,
      legacyStatus: "approved",
      productStatus: "active" as const,
      storefrontPublishedAt: now,
      reviewRequestedAt: null,
      homepageApprovedAt: null,
      merchantMessage: "تم نشر العرض داخل نافذة عروض متجرك. لا يظهر في الرئيسية أو منصة العروض العامة."
    };
  }
  return {
    publicationTarget: target,
    publicationState: "homepage_review" as const,
    legacyStatus: "pending_review",
    productStatus: "review" as const,
    storefrontPublishedAt: null,
    reviewRequestedAt: now,
    homepageApprovedAt: null,
    merchantMessage: "تم إرسال طلب نشر العرض في الرئيسية ومنصة العروض إلى الإدارة. لن يظهر للعامة قبل الاعتماد."
  };
}

export function isStorefrontLive(offer: { publicationTarget?: string | null; publicationState?: string | null; status: string }) {
  if (!offer.publicationTarget || !offer.publicationState) return offer.status === "approved";
  return offer.publicationState === "storefront_live" || offer.publicationState === "homepage_approved";
}

export function isHomepageLive(offer: { publicationTarget?: string | null; publicationState?: string | null; status: string }) {
  if (!offer.publicationTarget || !offer.publicationState) return offer.status === "approved";
  return offer.publicationTarget === "homepage" && offer.publicationState === "homepage_approved";
}

export function canMerchantRequestHomepageReview(offer: { publicationTarget?: string | null; publicationState?: string | null; status: string }) {
  return (offer.publicationTarget === "homepage" && ["draft", "paused", "rejected"].includes(offer.publicationState || "")) || (!offer.publicationTarget && ["draft", "disabled", "rejected"].includes(offer.status));
}
