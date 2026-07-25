export const RENTAL_LIMIT_KEYS = [
  "maxProducts",
  "maxEmployees",
  "maxBranches",
  "maxAnnouncements",
  "maxNews"
] as const;

export type RentalLimitKey = (typeof RENTAL_LIMIT_KEYS)[number];
export type RentalResource = "products" | "employees" | "branches" | "announcements" | "news";

export const RENTAL_RESOURCE_LIMIT_KEY: Record<RentalResource, RentalLimitKey> = {
  products: "maxProducts",
  employees: "maxEmployees",
  branches: "maxBranches",
  announcements: "maxAnnouncements",
  news: "maxNews"
};

export const RENTAL_RESOURCE_LABEL: Record<RentalResource, string> = {
  products: "المنتجات",
  employees: "الموظفين",
  branches: "الفروع",
  announcements: "الإعلانات النشطة",
  news: "الأخبار المتحركة النشطة"
};

export type RentalLimits = Record<RentalLimitKey, number | null>;
export type RentalPlanLimits = Record<RentalLimitKey, number>;

export type AddonEntitlementInput = {
  entitlementKey: string;
  quantity?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type RentalEntitlementSnapshot = {
  source: "legacy" | "agreement";
  agreementStatus: string | null;
  /** Whether the current agreement state permits expanding the store's resources. */
  resourceCreationAllowed: boolean;
  /** Null means the agreement is custom and has no numerical subscription plan. */
  limits: RentalLimits | null;
  addons: string[];
  features: string[];
};

const normalizedLimitKeys: Record<string, RentalLimitKey> = {
  maxproducts: "maxProducts",
  products: "maxProducts",
  product: "maxProducts",
  maxemployees: "maxEmployees",
  employees: "maxEmployees",
  employee: "maxEmployees",
  maxbranches: "maxBranches",
  branches: "maxBranches",
  branch: "maxBranches",
  maxannouncements: "maxAnnouncements",
  announcements: "maxAnnouncements",
  announcement: "maxAnnouncements",
  maxnews: "maxNews",
  news: "maxNews"
};

function normalizedKey(value: string) {
  return value.trim().replace(/[\s_-]/g, "").toLowerCase();
}

export function asRentalLimitKey(value: unknown): RentalLimitKey | null {
  if (typeof value !== "string") return null;
  return normalizedLimitKeys[normalizedKey(value)] || null;
}

function safeNonNegativeInteger(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : 0;
}

function safePositiveInteger(value: unknown) {
  return Math.max(1, safeNonNegativeInteger(value));
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function emptyLimits(): RentalLimits {
  return {
    maxProducts: 0,
    maxEmployees: 0,
    maxBranches: 0,
    maxAnnouncements: 0,
    maxNews: 0
  };
}

/**
 * Combines a subscription's hard numerical limits with active paid add-ons.
 *
 * Add-on contract (stored in `rental_addons.metadata`):
 * `{ limitKey: "maxBranches", limitIncrease: 2 }`
 * increases that limit by 2 for every assigned quantity.  Alternatively,
 * `{ limitKey: "maxProducts", unlimited: true }` removes a single limit.
 * `metadata.features: ["advanced_reports"]` adds named feature entitlements.
 */
export function calculateRentalEntitlements(input: {
  hasAgreement: boolean;
  agreementStatus?: string | null;
  planLimits?: Partial<RentalPlanLimits> | null;
  planFeatures?: string[] | null;
  addons?: AddonEntitlementInput[];
}): RentalEntitlementSnapshot {
  const agreementStatus = input.agreementStatus || null;
  const resourceCreationAllowed = !input.hasAgreement || ["active", "grace", "overdue"].includes(agreementStatus || "");
  const limits = input.planLimits
    ? RENTAL_LIMIT_KEYS.reduce((accumulator, key) => {
        accumulator[key] = safeNonNegativeInteger(input.planLimits?.[key]);
        return accumulator;
      }, emptyLimits())
    : null;

  const addonKeys: string[] = [];
  const addonFeatures: string[] = [];
  for (const addon of input.addons || []) {
    const metadata = addon.metadata || {};
    const quantity = safePositiveInteger(addon.quantity);
    const configuredLimitKey = asRentalLimitKey(metadata.limitKey) || asRentalLimitKey(addon.entitlementKey);
    const limitIncrease = safeNonNegativeInteger(metadata.limitIncrease);
    const isUnlimited = metadata.unlimited === true;

    addonKeys.push(addon.entitlementKey);
    if (configuredLimitKey && limits) {
      if (isUnlimited) limits[configuredLimitKey] = null;
      else if (limits[configuredLimitKey] !== null && limitIncrease > 0) {
        limits[configuredLimitKey] = (limits[configuredLimitKey] || 0) + limitIncrease * quantity;
      }
    }

    if (!configuredLimitKey) addonFeatures.push(addon.entitlementKey);
    if (Array.isArray(metadata.features)) {
      addonFeatures.push(...metadata.features.filter((feature): feature is string => typeof feature === "string"));
    }
  }

  return {
    source: input.hasAgreement ? "agreement" : "legacy",
    agreementStatus,
    resourceCreationAllowed,
    limits,
    addons: uniqueStrings(addonKeys),
    features: uniqueStrings([...(input.planFeatures || []), ...addonFeatures])
  };
}

export function evaluateRentalResourceLimit(input: {
  entitlements: RentalEntitlementSnapshot;
  resource: RentalResource;
  currentCount: number;
  increment?: number;
}) {
  const increment = Math.max(1, safeNonNegativeInteger(input.increment ?? 1));
  const currentCount = safeNonNegativeInteger(input.currentCount);
  const limitKey = RENTAL_RESOURCE_LIMIT_KEY[input.resource];
  const limit = input.entitlements.limits?.[limitKey] ?? null;

  if (!input.entitlements.resourceCreationAllowed) {
    return {
      allowed: false,
      reason: "agreement_inactive" as const,
      limit,
      nextCount: currentCount + increment,
      message: "اتفاق الإيجار غير نشط ولا يسمح بإضافة موارد جديدة. راجع إدارة المنصة لإعادة التفعيل."
    };
  }

  if (limit !== null && currentCount + increment > limit) {
    return {
      allowed: false,
      reason: "limit_reached" as const,
      limit,
      nextCount: currentCount + increment,
      message: `تم الوصول إلى حد ${RENTAL_RESOURCE_LABEL[input.resource]} في باقة الإيجار (${limit}). فعّل إضافة مدفوعة أو راجع الإدارة.`
    };
  }

  return { allowed: true, reason: null, limit, nextCount: currentCount + increment, message: null };
}
