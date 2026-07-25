function envFlag(value: string | undefined, defaultValue = false) {
  if (value == null || value === "") return defaultValue;
  const normalized = value.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
  if (["true", "1", "yes", "on", "enabled", "production"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "disabled", "trial", "staging", "preview"].includes(normalized)) return false;
  return defaultValue;
}

/**
 * Strict launch mode enables fail-closed safeguards that are too strict for the
 * shared trial environment, but required before a real public launch.
 */
export function isStrictProductionLaunch() {
  return (
    envFlag(process.env.PRODUCTION_LAUNCH_MODE, false) ||
    process.env.APP_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production"
  );
}

export function requireProductionLaunchCondition(condition: boolean, message: string) {
  if (isStrictProductionLaunch() && !condition) throw new Error(message);
}
