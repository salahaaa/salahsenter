import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, systemSettings } from "@/lib/db";
import { isNextProductionBuildPhase } from "@/lib/runtime-phase";

const safeUrl = z.string().trim().max(2_000).refine((value) => !value || value.startsWith("/") || /^https:\/\//i.test(value), "الرابط يجب أن يبدأ بـ / أو https://");

export const platformIdentitySchema = z.object({
  platformName: z.string().trim().min(2).max(120).default("صلاح سنتر"),
  shortName: z.string().trim().min(1).max(20).default("ص"),
  tagline: z.string().trim().max(160).default("مول إلكتروني متعدد المتاجر"),
  description: z.string().trim().max(1_500).default(""),
  logoUrl: safeUrl.default(""),
  iconUrl: safeUrl.default(""),
  officialEmail: z.string().trim().email().or(z.literal("")).default(""),
  contactPhone: z.string().trim().max(40).default(""),
  whatsappUrl: safeUrl.default(""),
  facebookUrl: safeUrl.default(""),
  instagramUrl: safeUrl.default(""),
  header: z.object({
    topBarEnabled: z.boolean().default(true),
    topBarText: z.string().trim().max(200).default("تجربة مول احترافية متعددة المتاجر"),
    showTrustMessages: z.boolean().default(true),
    showOpenStoreCta: z.boolean().default(true),
    openStoreLabel: z.string().trim().max(60).default("افتح متجرك")
  }).default({ topBarEnabled: true, topBarText: "تجربة مول احترافية متعددة المتاجر", showTrustMessages: true, showOpenStoreCta: true, openStoreLabel: "افتح متجرك" }),
  footer: z.object({
    trustTitle: z.string().trim().max(100).default("تسوق بثقة"),
    trustText: z.string().trim().max(500).default("الدفع والتوصيل وسياسة الإرجاع يحددها كل متجر بصورة واضحة."),
    showAdminLink: z.boolean().default(false)
  }).default({ trustTitle: "تسوق بثقة", trustText: "الدفع والتوصيل وسياسة الإرجاع يحددها كل متجر بصورة واضحة.", showAdminLink: false })
}).strict();

export type PlatformIdentity = z.infer<typeof platformIdentitySchema>;
export const defaultPlatformIdentity: PlatformIdentity = platformIdentitySchema.parse({});

export function normalizePlatformIdentity(value: unknown) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const social = raw.socialLinks && typeof raw.socialLinks === "object" && !Array.isArray(raw.socialLinks) ? raw.socialLinks as Record<string, unknown> : {};
  const { socialLinks: _legacySocialLinks, ...rest } = raw;
  return platformIdentitySchema.parse({ ...rest, whatsappUrl: raw.whatsappUrl || social.whatsapp || "", facebookUrl: raw.facebookUrl || social.facebook || "", instagramUrl: raw.instagramUrl || social.instagram || "" });
}

const identityCache = globalThis as typeof globalThis & { __platformIdentityCache?: { value: PlatformIdentity; expiresAt: number } };

export function invalidatePlatformIdentityCache() {
  delete identityCache.__platformIdentityCache;
}

export async function getPlatformIdentity() {
  if (isNextProductionBuildPhase()) return defaultPlatformIdentity;
  const now = Date.now();
  if (identityCache.__platformIdentityCache && identityCache.__platformIdentityCache.expiresAt > now) return identityCache.__platformIdentityCache.value;
  try {
    const [setting] = await db.select({ value: systemSettings.value }).from(systemSettings).where(and(eq(systemSettings.group, "platform"), eq(systemSettings.key, "identity"))).limit(1);
    const value = normalizePlatformIdentity(setting?.value || {});
    identityCache.__platformIdentityCache = { value, expiresAt: now + Number(process.env.PLATFORM_IDENTITY_CACHE_MS || 30_000) };
    return value;
  } catch { return defaultPlatformIdentity; }
}
