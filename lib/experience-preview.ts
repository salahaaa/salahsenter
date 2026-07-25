import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db, experiencePreviewSessions } from "@/lib/db";
import { createSecureToken, sha256 } from "@/lib/security";
import { platformIdentitySchema } from "@/lib/platform-identity";
import { customHomeSectionConfigSchema, isCustomHomeSectionType, normalizeHomeSectionCode } from "@/lib/home-section-templates";

export const experiencePreviewScopes = ["platform_identity", "theme", "home_content", "welcome_popup", "home_sections"] as const;
export type ExperiencePreviewScope = (typeof experiencePreviewScopes)[number];
const scopeSchema = z.enum(experiencePreviewScopes);
const genericStrings = z.record(z.string().max(3_000));
const welcomePayload = z.object({ enabled: z.boolean(), showOnce: z.boolean(), delayMs: z.number().int().min(0).max(30_000), imageUrl: z.string().max(2_000), badgeText: z.string().max(200), title: z.string().min(1).max(300), message: z.string().max(3_000), couponCode: z.string().max(120), buttonText: z.string().max(120), buttonUrl: z.string().max(2_000), closeOnBackdrop: z.boolean() }).strict();
const homeSectionsPayload = z.object({ sections: z.array(z.object({ id: z.string().uuid().optional(), code: z.string().min(2).max(100), title: z.string().min(2).max(160), type: z.string().min(2).max(80), isVisible: z.boolean(), sortOrder: z.number().int(), config: z.record(z.unknown()).default({}) })).min(1).max(100) });

export function normalizeExperiencePreviewPayload(scope: ExperiencePreviewScope, payload: unknown) {
  if (scope === "platform_identity") return platformIdentitySchema.parse(payload);
  if (scope === "theme") return z.record(z.unknown()).parse(payload);
  if (scope === "home_content") return genericStrings.parse(payload);
  if (scope === "welcome_popup") return welcomePayload.parse(payload);
  const parsed = homeSectionsPayload.parse(payload);
  return { sections: parsed.sections.map((section) => ({ ...section, code: normalizeHomeSectionCode(section.code), config: isCustomHomeSectionType(section.type) ? customHomeSectionConfigSchema.parse(section.config) : section.config })) };
}

export async function createExperiencePreview(input: { scope: ExperiencePreviewScope; payload: unknown; userId: string; expiresHours?: number }) {
  const normalized = normalizeExperiencePreviewPayload(input.scope, input.payload);
  const token = createSecureToken("experience-preview");
  const expiresAt = new Date(Date.now() + Math.max(1, Math.min(input.expiresHours || 24, 72)) * 60 * 60 * 1000);
  const [session] = await db.insert(experiencePreviewSessions).values({ tokenHash: sha256(token), scope: input.scope, payload: normalized as Record<string, unknown>, status: "active", createdBy: input.userId, expiresAt }).returning();
  return { session, token, expiresAt };
}

export async function getExperiencePreviewForAdmin(token: string, userId: string) {
  const [session] = await db.select().from(experiencePreviewSessions).where(and(eq(experiencePreviewSessions.tokenHash, sha256(token)), eq(experiencePreviewSessions.createdBy, userId), eq(experiencePreviewSessions.status, "active"), gt(experiencePreviewSessions.expiresAt, new Date()))).limit(1);
  return session || null;
}

export const __experiencePreviewInternals = { normalizeExperiencePreviewPayload };
