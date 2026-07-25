export const EMPLOYEE_ACCOUNT_STATUSES = ["active", "suspended", "inactive"] as const;
export type EmployeeAccountStatus = (typeof EMPLOYEE_ACCOUNT_STATUSES)[number];
export type PermissionOverrideEffect = "grant" | "deny";
export type PermissionPresentationState = "inherit" | PermissionOverrideEffect;

export function isEmployeeAccountStatus(value: string): value is EmployeeAccountStatus {
  return (EMPLOYEE_ACCOUNT_STATUSES as readonly string[]).includes(value);
}

/** Every non-active employee is blocked from sign-in and must have live sessions revoked. */
export function mustRevokeEmployeeSessions(status: EmployeeAccountStatus) {
  return status !== "active";
}

export function getPermissionPresentationState(effect?: PermissionOverrideEffect | null): PermissionPresentationState {
  return effect || "inherit";
}

export function resolveEffectivePermission(input: { inherited: boolean; override?: PermissionOverrideEffect | null }) {
  if (input.override === "deny") return false;
  if (input.override === "grant") return true;
  return input.inherited;
}

export function normalizePermissionOverrides(input: Array<{ code: string; effect: PermissionPresentationState }>) {
  const overrides = new Map<string, PermissionOverrideEffect>();
  for (const item of input) {
    const code = item.code.trim();
    if (!code || item.effect === "inherit") continue;
    overrides.set(code, item.effect);
  }
  return [...overrides.entries()]
    .map(([code, effect]) => ({ code, effect }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string) {
  return /^[a-z0-9][a-z0-9._-]{2,63}$/.test(value);
}
