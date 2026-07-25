import { and, desc, eq, inArray, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, platformTextEntries, platformTextVersions } from "@/lib/db";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";
import { isNextProductionBuildPhase } from "@/lib/runtime-phase";
import { PLATFORM_TEXT_BY_KEY, PLATFORM_TEXT_CATALOG, RETIRED_DUPLICATE_TEXT_KEYS, type PlatformTextDefinition } from "./catalog";

export type TextVersionStatus = "draft" | "published" | "archived";
export type TextCenterRow = {
  entry: typeof platformTextEntries.$inferSelect;
  published: typeof platformTextVersions.$inferSelect | null;
  draft: typeof platformTextVersions.$inferSelect | null;
  history: Array<typeof platformTextVersions.$inferSelect>;
  definition?: PlatformTextDefinition;
};

const globalForTextCenter = globalThis as typeof globalThis & { __platformTextOverrideCache?: Map<string, { values: Record<string, string>; expiresAt: number }> };

function cache() {
  globalForTextCenter.__platformTextOverrideCache ??= new Map();
  return globalForTextCenter.__platformTextOverrideCache;
}

export function invalidatePlatformTextCache() {
  cache().clear();
}

/** Published values only: drafts are never visible outside the text-centre UI. */
export async function getPublishedTextOverrides(locale = "ar") {
  if (isNextProductionBuildPhase()) return {} as Record<string, string>;
  const now = Date.now();
  const existing = cache().get(locale);
  if (existing && existing.expiresAt > now) return existing.values;
  try {
    const rows = await db
      .select({ key: platformTextEntries.textKey, value: platformTextVersions.value })
      .from(platformTextVersions)
      .innerJoin(platformTextEntries, eq(platformTextVersions.entryId, platformTextEntries.id))
      .where(and(eq(platformTextVersions.locale, locale), eq(platformTextVersions.status, "published"), eq(platformTextEntries.isEditable, true)));
    const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    cache().set(locale, { values, expiresAt: now + 30_000 });
    return values;
  } catch {
    return {} as Record<string, string>;
  }
}

export async function resolvePlatformText(key: string, fallback?: string, locale = "ar") {
  const values = await getPublishedTextOverrides(locale);
  return values[key] ?? fallback ?? PLATFORM_TEXT_BY_KEY.get(key)?.defaultValue ?? key;
}

export function formatPlatformText(template: string, parameters: Record<string, string | number | null | undefined> = {}) {
  return template.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, key) => parameters[key] == null ? match : String(parameters[key]));
}

/** Idempotently creates the central entries and their initial published defaults. */
export async function syncPlatformTextCatalog(actorId: string, locale = "ar") {
  return db.transaction(async (tx) => {
    const keys = PLATFORM_TEXT_CATALOG.map((definition) => definition.key);
    // A first prototype duplicated settings already managed by specialised
    // public-content forms. Retire those keys rather than delete history.
    if (RETIRED_DUPLICATE_TEXT_KEYS.length) await tx.update(platformTextEntries).set({ isEditable: false, updatedAt: new Date() }).where(inArray(platformTextEntries.textKey, [...RETIRED_DUPLICATE_TEXT_KEYS]));
    const existing = keys.length ? await tx.select().from(platformTextEntries).where(inArray(platformTextEntries.textKey, keys)) : [];
    const existingByKey = new Map(existing.map((entry) => [entry.textKey, entry]));
    const created: string[] = [];

    for (const definition of PLATFORM_TEXT_CATALOG) {
      let entry = existingByKey.get(definition.key);
      if (!entry) {
        [entry] = await tx.insert(platformTextEntries).values({ textKey: definition.key, namespace: definition.namespace, audience: definition.audience, description: definition.description, isEditable: true }).returning();
        existingByKey.set(definition.key, entry);
        created.push(definition.key);
      } else {
        [entry] = await tx.update(platformTextEntries).set({ namespace: definition.namespace, audience: definition.audience, description: definition.description, updatedAt: new Date() }).where(eq(platformTextEntries.id, entry.id)).returning();
        existingByKey.set(definition.key, entry);
      }

      const [firstVersion] = await tx.select({ id: platformTextVersions.id }).from(platformTextVersions).where(and(eq(platformTextVersions.entryId, entry.id), eq(platformTextVersions.locale, locale))).limit(1);
      if (!firstVersion) {
        await tx.insert(platformTextVersions).values({ entryId: entry.id, locale, value: definition.defaultValue, status: "published", versionNumber: 1, changeNote: "القيمة الافتراضية عند إنشاء مركز النصوص", createdBy: actorId, publishedBy: actorId, publishedAt: new Date() });
      }
    }
    return { total: PLATFORM_TEXT_CATALOG.length, created };
  });
}

export async function listTextCenterEntries(locale = "ar", filters: { namespace?: string; query?: string } = {}): Promise<TextCenterRow[]> {
  const entries = await db.select().from(platformTextEntries).where(eq(platformTextEntries.isEditable, true)).orderBy(platformTextEntries.namespace, platformTextEntries.textKey);
  const query = filters.query?.trim().toLowerCase();
  const selected = entries.filter((entry) => (!filters.namespace || entry.namespace === filters.namespace) && (!query || [entry.textKey, entry.namespace, entry.description].some((part) => part.toLowerCase().includes(query))));
  if (!selected.length) return [];
  const ids = selected.map((entry) => entry.id);
  const versions = await db.select().from(platformTextVersions).where(and(inArray(platformTextVersions.entryId, ids), eq(platformTextVersions.locale, locale))).orderBy(desc(platformTextVersions.versionNumber));
  return selected.map((entry) => {
    const history = versions.filter((version) => version.entryId === entry.id);
    return { entry, published: history.find((version) => version.status === "published") || null, draft: history.find((version) => version.status === "draft") || null, history, definition: PLATFORM_TEXT_BY_KEY.get(entry.textKey) };
  });
}

async function entryByKey(key: string) {
  const [entry] = await db.select().from(platformTextEntries).where(eq(platformTextEntries.textKey, key)).limit(1);
  if (!entry) throw new Error("لم يُعثر على مفتاح النص. نفّذ مزامنة الكتالوج أولاً.");
  if (!entry.isEditable) throw new Error("هذا النص محمي من التعديل.");
  return entry;
}

export async function saveTextDraft(input: { key: string; locale?: string; value: string; note?: string; actorId: string }) {
  const locale = input.locale || "ar";
  return db.transaction(async (tx) => {
    const entry = await entryByKey(input.key);
    const [latest] = await tx.select({ value: max(platformTextVersions.versionNumber) }).from(platformTextVersions).where(and(eq(platformTextVersions.entryId, entry.id), eq(platformTextVersions.locale, locale)));
    const nextVersion = Number(latest?.value || 0) + 1;
    const [draft] = await tx
      .insert(platformTextVersions)
      .values({ entryId: entry.id, locale, value: input.value, status: "draft", versionNumber: nextVersion, changeNote: input.note?.trim() || null, createdBy: input.actorId })
      .returning();
    return draft;
  });
}

export async function publishTextDraft(input: { key: string; locale?: string; actorId: string }) {
  const locale = input.locale || "ar";
  const result = await db.transaction(async (tx) => {
    const entry = await entryByKey(input.key);
    const [draft] = await tx.select().from(platformTextVersions).where(and(eq(platformTextVersions.entryId, entry.id), eq(platformTextVersions.locale, locale), eq(platformTextVersions.status, "draft"))).orderBy(desc(platformTextVersions.versionNumber)).limit(1);
    if (!draft) throw new Error("لا توجد مسودة منشورة لهذا النص.");
    await tx.update(platformTextVersions).set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() }).where(and(eq(platformTextVersions.entryId, entry.id), eq(platformTextVersions.locale, locale), eq(platformTextVersions.status, "published")));
    const [published] = await tx.update(platformTextVersions).set({ status: "published", publishedBy: input.actorId, publishedAt: new Date(), updatedAt: new Date() }).where(eq(platformTextVersions.id, draft.id)).returning();
    return { entry, published };
  });
  await publishInvalidation();
  return result;
}

export async function restoreTextVersion(input: { key: string; versionId: string; locale?: string; actorId: string }) {
  const locale = input.locale || "ar";
  const entry = await entryByKey(input.key);
  const [source] = await db.select().from(platformTextVersions).where(and(eq(platformTextVersions.id, input.versionId), eq(platformTextVersions.entryId, entry.id), eq(platformTextVersions.locale, locale))).limit(1);
  if (!source) throw new Error("لم يُعثر على النسخة المطلوبة.");
  await saveTextDraft({ key: input.key, locale, value: source.value, note: `استرجاع من النسخة ${source.versionNumber}`, actorId: input.actorId });
  return publishTextDraft({ key: input.key, locale, actorId: input.actorId });
}

async function publishInvalidation() {
  invalidatePlatformTextCache();
  revalidatePath("/");
  revalidatePath("/admin/text-center");
  await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.settings, PUBLIC_CACHE_TAGS.home], paths: ["/"] }).catch(() => undefined);
}
