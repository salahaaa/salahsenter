import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, masterSettingsVersions, systemSettings } from "@/lib/db";

export const MASTER_SETTINGS_GROUP = "master";
export const masterSettingsSchema = z.object({
  governance: z.object({
    defaultTimezone: z.string().min(3).max(80).default("Asia/Aden"),
    defaultCurrency: z.string().trim().min(3).max(10).default("YER"),
    launchMode: z.enum(["normal", "controlled"]).default("normal")
  }).default({ defaultTimezone: "Asia/Aden", defaultCurrency: "YER", launchMode: "normal" }),
  onboarding: z.object({
    defaultContractDays: z.coerce.number().int().min(30).max(3650).default(365),
    defaultDueDays: z.coerce.number().int().min(1).max(90).default(7),
    defaultGraceDays: z.coerce.number().int().min(0).max(90).default(7),
    independentStoreIdentityReuse: z.boolean().default(true)
  }).default({ defaultContractDays: 365, defaultDueDays: 7, defaultGraceDays: 7, independentStoreIdentityReuse: true }),
  featureFlags: z.object({
    allowIndependentStores: z.boolean().default(true),
    allowCommercialExposureRequests: z.boolean().default(true)
  }).default({ allowIndependentStores: true, allowCommercialExposureRequests: true }),
  dataGovernance: z.object({
    auditRetentionDays: z.coerce.number().int().min(30).max(3650).default(365),
    staleDraftDays: z.coerce.number().int().min(1).max(365).default(30)
  }).default({ auditRetentionDays: 365, staleDraftDays: 30 })
}).strict();

export type MasterSettings = z.infer<typeof masterSettingsSchema>;
export const defaultMasterSettings: MasterSettings = masterSettingsSchema.parse({});

export const masterDomainRegistry = [
  { id: "governance", title: "حوكمة المنصة", description: "العملة والمنطقة الزمنية ووضع الإطلاق الافتراضي.", owner: "Master Governance", href: "/admin/master", effective: true },
  { id: "onboarding", title: "سياسة فتح المتاجر", description: "تطبيق فعلي لسياسة إعادة استخدام الهوية للنشاط المستقل؛ مدد العقد والاستحقاق تبقى قابلة للتخصيص في مسار العقد.", owner: "Master Governance + فتح المتاجر", href: "/admin/merchant-applications", effective: true },
  { id: "featureFlags", title: "Feature Flags", description: "إتاحة النشاط المستقل وطلبات الظهور التجاري للتجار.", owner: "Master Governance", href: "/admin/master", effective: true },
  { id: "financial", title: "الإيرادات والعمولات", description: "مصدر الحقيقة هو شروط الإيراد والعمولات والكشوف المتخصصة، وليس Master JSON.", owner: "Platform Revenue / Commissions", href: "/admin/platform-revenue", effective: false },
  { id: "security", title: "الأمن والحماية", description: "مصدر الحقيقة مركز الحماية؛ Master لا يغير lockdown أو الأسرار أو صلاحيات الأمن.", owner: "Security Center", href: "/admin/security", effective: false },
  { id: "payments", title: "الدفع والمزودون", description: "مصدر الحقيقة سجل مزودي الخدمات المالية وإعدادات الدفع.", owner: "Financial Providers", href: "/admin/financial-providers", effective: false },
  { id: "home", title: "الواجهة والظهور", description: "مصدر الحقيقة إعدادات الواجهة وقواعد الظهور ومحرك الإيرادات التجاري.", owner: "Settings / Home Revenue", href: "/admin/settings", effective: false }
] as const;

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function settingsFromRows(rows: Array<{ key: string; value: unknown }>) {
  const raw = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  // Older Master JSON stored arbitrary keys (platform, mall, stores, ...).
  // Map only safe legacy defaults and intentionally drop the rest; their
  // specialized pages remain the source of truth.
  const legacyPlatform = record(raw.platform);
  const candidate = {
    governance: raw.governance || { defaultTimezone: legacyPlatform.defaultTimezone || "Asia/Aden", defaultCurrency: legacyPlatform.defaultCurrency || "YER", launchMode: legacyPlatform.maintenanceMode ? "controlled" : "normal" },
    onboarding: raw.onboarding || { defaultContractDays: 365, defaultDueDays: 7, defaultGraceDays: 7, independentStoreIdentityReuse: true },
    featureFlags: raw.featureFlags || { allowIndependentStores: true, allowCommercialExposureRequests: true },
    dataGovernance: raw.dataGovernance || { auditRetentionDays: 365, staleDraftDays: 30 }
  };
  // Deprecated security values are intentionally ignored; Security Center remains the source of truth.
  return masterSettingsSchema.parse(candidate);
}

export async function getMasterSettings() {
  const rows = await db.select({ key: systemSettings.key, value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.group, MASTER_SETTINGS_GROUP));
  return settingsFromRows(rows);
}

export async function isMasterFeatureEnabled(feature: keyof MasterSettings["featureFlags"]) {
  const settings = await getMasterSettings();
  return settings.featureFlags[feature];
}

export async function getMasterSettingsVersions(limit = 30) {
  return db.select().from(masterSettingsVersions).orderBy(desc(masterSettingsVersions.version)).limit(Math.max(1, Math.min(limit, 100)));
}

export async function publishMasterSettings(input: { settings: MasterSettings; actorId: string; reason?: string | null; basedOnVersionId?: string | null }) {
  return db.transaction(async (tx) => {
    const [latest] = await tx.select({ version: masterSettingsVersions.version }).from(masterSettingsVersions).orderBy(desc(masterSettingsVersions.version)).limit(1);
    const version = Number(latest?.version || 0) + 1;
    const [snapshot] = await tx.insert(masterSettingsVersions).values({ version, status: "published", settings: input.settings, reason: input.reason?.trim() || null, basedOnVersionId: input.basedOnVersionId || null, createdBy: input.actorId, publishedAt: new Date() }).returning();
    for (const [key, value] of Object.entries(input.settings)) {
      await tx.insert(systemSettings).values({ group: MASTER_SETTINGS_GROUP, key, value, isPublic: false, updatedBy: input.actorId }).onConflictDoUpdate({ target: [systemSettings.group, systemSettings.key], set: { value, isPublic: false, updatedBy: input.actorId, updatedAt: new Date() } });
    }
    return snapshot;
  });
}

export async function saveMasterSettingsDraft(input: { settings: MasterSettings; actorId: string; reason?: string | null; basedOnVersionId?: string | null }) {
  const [latest] = await db.select({ version: masterSettingsVersions.version }).from(masterSettingsVersions).orderBy(desc(masterSettingsVersions.version)).limit(1);
  const [snapshot] = await db.insert(masterSettingsVersions).values({ version: Number(latest?.version || 0) + 1, status: "draft", settings: input.settings, reason: input.reason?.trim() || null, basedOnVersionId: input.basedOnVersionId || null, createdBy: input.actorId }).returning();
  return snapshot;
}

export async function rollbackMasterSettings(input: { versionId: string; actorId: string; reason?: string | null }) {
  const [source] = await db.select().from(masterSettingsVersions).where(and(eq(masterSettingsVersions.id, input.versionId), eq(masterSettingsVersions.status, "published"))).limit(1);
  if (!source) throw new Error("نسخة Master المنشورة غير موجودة");
  const settings = masterSettingsSchema.parse(source.settings);
  return publishMasterSettings({ settings, actorId: input.actorId, reason: input.reason || `Rollback to version ${source.version}`, basedOnVersionId: source.id });
}

export const __masterSettingsInternals = { settingsFromRows };
