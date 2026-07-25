import { describe, expect, it } from "vitest";
import { __masterSettingsInternals, defaultMasterSettings, masterSettingsSchema } from "@/lib/master-settings";

describe("master governance settings boundaries", () => {
  it("accepts only the typed master domains and rejects security-domain injection", () => {
    expect(masterSettingsSchema.parse({})).toEqual(defaultMasterSettings);
    expect(masterSettingsSchema.safeParse({ security: { emergencyLockdown: true } }).success).toBe(false);
  });

  it("maps safe legacy master defaults without carrying deprecated security behavior", () => {
    const value = __masterSettingsInternals.settingsFromRows([{ key: "platform", value: { defaultCurrency: "SAR", maintenanceMode: true } }, { key: "security", value: { requireStrongPasswords: false } }]);
    expect(value.governance).toMatchObject({ defaultCurrency: "SAR", launchMode: "controlled" });
    expect(value.featureFlags).toEqual(defaultMasterSettings.featureFlags);
  });
});
