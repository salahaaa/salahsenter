import { and, eq } from "drizzle-orm";
import { db, systemSettings } from "@/lib/db";

export type PlatformSecuritySettings = {
  emergencyLockdown: boolean;
  maintenanceMode: boolean;
  securityLevel: "normal" | "heightened" | "lockdown";
  messageTitle: string;
  messageBody: string;
  disabledModules: {
    orders: boolean;
    merchantApplications: boolean;
    uploads: boolean;
    registrations: boolean;
  };
  reason: string;
  updatedAt?: string;
  updatedBy?: string;
};

export const defaultSecuritySettings: PlatformSecuritySettings = {
  emergencyLockdown: false,
  maintenanceMode: false,
  securityLevel: "normal",
  messageTitle: "المنصة متوقفة مؤقتاً",
  messageBody: "نقوم حالياً بإجراء صيانة أو معالجة طارئة. نعتذر عن الإزعاج وسيتم إعادة تشغيل المنصة قريباً.",
  disabledModules: {
    orders: false,
    merchantApplications: false,
    uploads: false,
    registrations: false
  },
  reason: ""
};

export function normalizeSecuritySettings(value: unknown): PlatformSecuritySettings {
  const incoming = (value || {}) as Partial<PlatformSecuritySettings>;
  return {
    ...defaultSecuritySettings,
    ...incoming,
    disabledModules: {
      ...defaultSecuritySettings.disabledModules,
      ...(incoming.disabledModules || {})
    }
  };
}

const securityCache = globalThis as typeof globalThis & { __platformSecuritySettingsCache?: { value: PlatformSecuritySettings; expiresAt: number } };

export async function getPlatformSecuritySettings(): Promise<PlatformSecuritySettings> {
  const now = Date.now();
  if (securityCache.__platformSecuritySettingsCache && securityCache.__platformSecuritySettingsCache.expiresAt > now) {
    return securityCache.__platformSecuritySettingsCache.value;
  }
  try {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(and(eq(systemSettings.group, "security"), eq(systemSettings.key, "platform_guard")))
      .limit(1);
    const value = normalizeSecuritySettings(setting?.value);
    securityCache.__platformSecuritySettingsCache = { value, expiresAt: now + Number(process.env.SECURITY_SETTINGS_CACHE_MS || 10_000) };
    return value;
  } catch {
    return defaultSecuritySettings;
  }
}

export function isPlatformLocked(settings: PlatformSecuritySettings) {
  return settings.emergencyLockdown || settings.maintenanceMode || settings.securityLevel === "lockdown";
}
