import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, merchantActivityTemplateCatalog } from "@/lib/db";
import type { ActivityTemplate } from "@/lib/merchant/activity-templates";

const code = z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]{1,110}$/);
const name = z.string().trim().min(2).max(180);
const color = z.object({ name, hexCode: z.string().regex(/^#[0-9a-fA-F]{6}$/) });
const attribute = z.object({ name, displayType: z.enum(["button", "color", "dropdown", "radio", "text"]), values: z.array(name).min(1).max(100) });
const starterProduct = z.object({ name, category: name, description: z.string().trim().max(2_000).default(""), attributes: z.record(z.string()).default({}) });

export const activityTemplateCatalogConfigSchema = z.object({
  categories: z.array(name).min(1).max(100),
  units: z.array(z.object({ name, symbol: z.string().trim().max(80).optional() })).min(1).max(50),
  attributes: z.array(attribute).min(1).max(100),
  sizes: z.array(name).max(100).default([]),
  colors: z.array(color).max(100).default([]),
  starterProducts: z.array(starterProduct).max(50).default([]),
  notice: z.string().trim().max(1_000).default("")
}).strict();

export type ActivityTemplateCatalogConfig = z.infer<typeof activityTemplateCatalogConfigSchema>;
export const activityTemplateCatalogInputSchema = z.object({ code, name, description: z.string().trim().max(2_000).default(""), sector: z.string().trim().max(120).default(""), config: activityTemplateCatalogConfigSchema, status: z.enum(["active", "disabled"]).default("active") });

export function catalogRowToActivityTemplate(row: typeof merchantActivityTemplateCatalog.$inferSelect): ActivityTemplate & { source: "admin"; catalogId: string; version: number } {
  const config = activityTemplateCatalogConfigSchema.parse(row.config);
  return { key: `catalog:${row.code}`, title: row.name, description: row.description || `قطاع ${row.sector || "مخصص"} من كتالوج الإدارة`, notice: config.notice || undefined, categories: config.categories, units: config.units, attributes: config.attributes, sizes: config.sizes, colors: config.colors, starterProducts: config.starterProducts, source: "admin", catalogId: row.id, version: row.version };
}

export async function listActiveAdminActivityTemplates() {
  const rows = await db.select().from(merchantActivityTemplateCatalog).where(eq(merchantActivityTemplateCatalog.status, "active")).orderBy(asc(merchantActivityTemplateCatalog.sector), asc(merchantActivityTemplateCatalog.name));
  return rows.map(catalogRowToActivityTemplate);
}
