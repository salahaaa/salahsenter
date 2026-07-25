import { activityTemplates, type ActivityTemplate } from "@/lib/merchant/activity-templates";
import { listActiveAdminActivityTemplates } from "@/lib/merchant/activity-template-catalog";

export type ResolvedActivityTemplate = ActivityTemplate & {
  source: "system" | "admin";
  catalogId?: string;
  version: number;
};

export type ActivityTemplateSelection = Pick<ResolvedActivityTemplate, "key" | "title" | "source" | "version"> & { description: string };

/**
 * The same active catalogue powers onboarding and the merchant setup screen.
 * This prevents a merchant from selecting a sector in the application form
 * that cannot later be resolved by the setup workflow.
 */
export async function listAvailableActivityTemplates(): Promise<ResolvedActivityTemplate[]> {
  const adminTemplates = await listActiveAdminActivityTemplates();
  return [
    ...activityTemplates.map((template) => ({ ...template, source: "system" as const, version: 1 })),
    ...adminTemplates
  ];
}

export async function listActivityTemplateSelections(): Promise<ActivityTemplateSelection[]> {
  const templates = await listAvailableActivityTemplates();
  return templates.map((template) => ({
    key: template.key,
    title: template.title,
    description: template.description || "قطاع يجهز التصنيفات والوحدات والخصائص المناسبة.",
    source: template.source,
    version: template.version
  }));
}

export async function isAvailableActivityTemplateKey(key: string) {
  const templates = await listAvailableActivityTemplates();
  return templates.some((template) => template.key === key);
}
