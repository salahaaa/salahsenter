/** Admin routes never call this policy. It only describes customer commerce availability. */
export function isPublicCommerceBlocked(input: { emergencyLockdown: boolean; maintenanceMode: boolean; securityLevel: string }) {
  return input.emergencyLockdown || input.maintenanceMode || input.securityLevel === "lockdown";
}
