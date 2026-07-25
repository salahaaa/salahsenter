import { z } from "zod";

export const customHomeSectionTypes = ["custom_rich_text", "custom_cta", "custom_banner", "custom_link_grid"] as const;
export type CustomHomeSectionType = (typeof customHomeSectionTypes)[number];
const safeHref = z.string().trim().max(2_000).refine((value) => !value || value.startsWith("/") || /^https:\/\//i.test(value), "الرابط يجب أن يبدأ بـ / أو https://");
const safeImageUrl = z.string().trim().max(2_000).refine((value) => !value || value.startsWith("/") || /^https:\/\//i.test(value), "رابط الصورة يجب أن يبدأ بـ / أو https://");
const color = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().default("#0f172a");

export const customHomeSectionConfigSchema = z.object({
  eyebrow: z.string().trim().max(80).optional().default(""),
  text: z.string().trim().max(3_000).optional().default(""),
  imageUrl: safeImageUrl.optional().default(""),
  backgroundColor: color,
  textColor: color,
  ctaLabel: z.string().trim().max(80).optional().default(""),
  ctaUrl: safeHref.optional().default(""),
  links: z.array(z.object({ label: z.string().trim().min(1).max(80), url: safeHref })).max(8).optional().default([])
}).strict();

export function normalizeCustomHomeSectionConfig(value: unknown) {
  return customHomeSectionConfigSchema.parse(value || {});
}

export function isCustomHomeSectionType(value: string): value is CustomHomeSectionType {
  return (customHomeSectionTypes as readonly string[]).includes(value);
}

export function normalizeHomeSectionCode(value: unknown) {
  const code = String(value || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  if (!/^[a-z][a-z0-9_]{1,79}$/.test(code)) throw new Error("كود القسم يجب أن يبدأ بحرف إنجليزي ويحتوي أحرفاً وأرقاماً وشرطة سفلية فقط");
  return code;
}
