export const ERP_ONBOARDING_REQUEST_STATUSES = ["pending_review", "under_review", "needs_information", "approved_for_setup", "agent_connected", "mapping_in_progress", "ready_for_certification", "activated", "rejected", "cancelled"] as const;
export type ErpOnboardingRequestStatus = (typeof ERP_ONBOARDING_REQUEST_STATUSES)[number];
export type ErpOnboardingAdminAction = "start_review" | "request_information" | "assign_connector" | "mark_ready_for_certification" | "reject" | "activate";

const transitions: Record<ErpOnboardingAdminAction, readonly ErpOnboardingRequestStatus[]> = {
  start_review: ["pending_review", "needs_information"],
  request_information: ["pending_review", "under_review", "needs_information"],
  assign_connector: ["under_review", "needs_information"],
  mark_ready_for_certification: ["agent_connected", "mapping_in_progress"],
  activate: ["ready_for_certification"],
  reject: ["pending_review", "under_review", "needs_information", "approved_for_setup", "agent_connected", "mapping_in_progress", "ready_for_certification"]
};

export function canApplyErpOnboardingAction(status: string, action: ErpOnboardingAdminAction) {
  return transitions[action].includes(status as ErpOnboardingRequestStatus);
}

export function assertErpOnboardingAction(status: string, action: ErpOnboardingAdminAction) {
  if (!canApplyErpOnboardingAction(status, action)) throw new Error(`لا يسمح بالإجراء ${action} من حالة طلب ERP ${status}`);
}
