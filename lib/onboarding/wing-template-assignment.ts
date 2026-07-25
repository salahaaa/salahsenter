import { and, eq, isNotNull } from "drizzle-orm";
import { db, wings } from "@/lib/db";
import { listAvailableActivityTemplates, type ResolvedActivityTemplate } from "@/lib/merchant/activity-template-selection";

export type OnboardingWing = {
  id: string;
  name: string;
  activityTemplateKey: string;
  sortOrder: number;
};

type WingTemplateResolution =
  | { ok: true; wing: OnboardingWing; template: ResolvedActivityTemplate }
  | { ok: false; message: string };

/**
 * The mall wing is the single sector choice in the application form.  Only
 * active wings with a currently active template assignment are offered, so a
 * merchant never has to choose the same business sector twice.
 */
export async function listActiveOnboardingWings(): Promise<OnboardingWing[]> {
  const [rows, templates] = await Promise.all([
    db
      .select({ id: wings.id, name: wings.name, activityTemplateKey: wings.activityTemplateKey, sortOrder: wings.sortOrder })
      .from(wings)
      .where(and(eq(wings.isActive, true), isNotNull(wings.activityTemplateKey))),
    listAvailableActivityTemplates()
  ]);
  const availableKeys = new Set(templates.map((template) => template.key));
  return rows
    .filter((wing): wing is OnboardingWing => typeof wing.activityTemplateKey === "string" && availableKeys.has(wing.activityTemplateKey))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ar"));
}

/** Resolves the server-authoritative template key from the selected wing ID. */
export async function resolveActivityTemplateForWing(wingId: string): Promise<WingTemplateResolution> {
  const [wingRows, templates] = await Promise.all([
    db.select({ id: wings.id, name: wings.name, isActive: wings.isActive, activityTemplateKey: wings.activityTemplateKey, sortOrder: wings.sortOrder }).from(wings).where(eq(wings.id, wingId)).limit(1),
    listAvailableActivityTemplates()
  ]);
  const wing = wingRows[0];

  if (!wing || !wing.isActive) return { ok: false, message: "الجناح المختار غير متاح حالياً." };
  if (!wing.activityTemplateKey) return { ok: false, message: "هذا الجناح لم يُربط بعد بقالب تجهيز. راجع الإدارة لاختيار قالب الجناح." };
  const template = templates.find((item) => item.key === wing.activityTemplateKey);
  if (!template) return { ok: false, message: "قالب تجهيز الجناح غير نشط حالياً. اختر جناحاً آخر أو راجع الإدارة." };
  return { ok: true, wing: { id: wing.id, name: wing.name, activityTemplateKey: wing.activityTemplateKey, sortOrder: wing.sortOrder }, template };
}
