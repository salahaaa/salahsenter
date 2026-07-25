export type MerchantApplicationType = "initial_store" | "independent_store";

export function isIndependentStoreApplication(value: string) {
  return value === "independent_store";
}

export function independentStoreEligibility(input: { hasExistingStore: boolean; hasApprovedIdentity: boolean }) {
  if (!input.hasExistingStore) return { allowed: false, reason: "first_store_required" as const };
  if (!input.hasApprovedIdentity) return { allowed: false, reason: "approved_identity_required" as const };
  return { allowed: true, reason: null };
}

/** Identity remains tied to the approved merchant profile; new business evidence remains mandatory. */
export function documentPlanForIndependentStore(identityApplicationId: string) {
  return [
    { documentType: "identity", isRequired: false, status: "waived", note: `identity_reused_from_application:${identityApplicationId}` },
    { documentType: "commercial_register", isRequired: true, status: "requested", note: null },
    { documentType: "tax_card", isRequired: true, status: "requested", note: null }
  ] as const;
}
