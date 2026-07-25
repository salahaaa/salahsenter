import type { ActivityTemplate } from "@/lib/merchant/activity-templates";

/**
 * Commerce intent is deliberately stored on every product, not inferred from a
 * sector. A jewellery shop, for example, may have both sellable accessories
 * and gold items that require an in-person visit.
 */
export const starterProductCommerceTypes = ["ONLINE_SALES", "SHOWCASE_ONLY"] as const;
export type StarterProductCommerceType = (typeof starterProductCommerceTypes)[number];

export type ActivityTemplateLike = Pick<ActivityTemplate, "key">;

export function starterProductCommerceTypeAt(
  selectedModes: readonly StarterProductCommerceType[] | undefined,
  index: number
): StarterProductCommerceType {
  return selectedModes?.[index] === "SHOWCASE_ONLY" ? "SHOWCASE_ONLY" : "ONLINE_SALES";
}

/**
 * A store that selected a sector during onboarding must only see that sector
 * in its setup screen. Stores created before this policy have no saved key and
 * retain the legacy, non-destructive catalogue view until an explicit
 * migration/assignment workflow is introduced.
 */
export function templatesForStoreActivity<T extends ActivityTemplateLike>(
  templates: readonly T[],
  activityTemplateKey?: string | null
): T[] {
  if (!activityTemplateKey) return [...templates];
  return templates.filter((template) => template.key === activityTemplateKey);
}
