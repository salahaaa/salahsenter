import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { hasConfiguredDatabaseUrl } from "@/lib/db/env";
import { isNextProductionBuildPhase } from "@/lib/runtime-phase";

export type DatabaseReadinessState = "ready" | "unconfigured" | "schema_incomplete" | "unavailable" | "unknown";

export type DatabaseReadiness = {
  state: DatabaseReadinessState;
  /** Safe for administrators only; public routes use publicDatabaseReadinessCopy. */
  missingTables: string[];
  errorCode?: string;
  checkedAt: string;
};

const REQUIRED_PUBLIC_RUNTIME_TABLES = [
  "__drizzle_migrations",
  "users",
  "roles",
  "permissions",
  "system_settings",
  "stores",
  "wings",
  "store_wings",
  "products",
  "background_jobs",
  "store_offer_collections",
  "store_offer_items",
  "offer_campaigns",
  "admin_promotional_offers",
  "store_media",
  "categories",
  "announcements",
  "news",
  "product_variants",
  "product_images",
  "countries",
  "governorates",
  "cities"
] as const;

const readinessCache = globalThis as typeof globalThis & {
  __databaseReadiness?: { value: DatabaseReadiness; expiresAt: number };
};

function errorCode(error: unknown): string | undefined {
  const seen = new Set<unknown>();
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object" && !seen.has(current); depth += 1) {
    seen.add(current);
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string") return candidate.code;
    current = candidate.cause;
  }
  return undefined;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.toLowerCase() : String(error || "").toLowerCase();
}

/** Classifies low-level database failures without exposing driver details publicly. */
export function classifyDatabaseError(error: unknown): Pick<DatabaseReadiness, "state" | "errorCode"> {
  const code = errorCode(error);
  const message = errorMessage(error);
  if (["42P01", "42703", "42883", "3F000"].includes(code || "")) return { state: "schema_incomplete", errorCode: code };
  if (code?.startsWith("28") || code === "3D000") return { state: "unavailable", errorCode: code };
  if (code?.startsWith("08") || ["53300", "57P01", "57P02", "57P03"].includes(code || "")) return { state: "unavailable", errorCode: code };
  if (/relation .* does not exist|column .* does not exist|undefined table|missing migration/.test(message)) return { state: "schema_incomplete", errorCode: code };
  if (/timeout|connection|connect|econnrefused|database .* unavailable|permission denied/.test(message)) return { state: "unavailable", errorCode: code };
  return { state: "unknown", errorCode: code };
}

/** Prefer the concrete query diagnosis when it is known, then fall back to the cached schema probe. */
export async function databaseFailureState(error: unknown): Promise<DatabaseReadinessState> {
  const classified = classifyDatabaseError(error).state;
  if (classified !== "unknown") return classified;
  return (await getDatabaseReadiness()).state;
}

export function publicDatabaseReadinessCopy(state: DatabaseReadinessState) {
  switch (state) {
    case "unconfigured":
      return { title: "بيانات العرض لم تُجهّز بعد", description: "لم يتم ضبط مصدر البيانات لهذه البيئة بعد." };
    case "schema_incomplete":
      return { title: "إعداد قاعدة البيانات غير مكتمل", description: "التطبيق متصل بقاعدة بيانات، لكن migrations المطلوبة لم تُطبق بالكامل بعد." };
    case "unavailable":
      return { title: "تعذر الوصول إلى بيانات العرض مؤقتاً", description: "تعذر تنفيذ استعلام البيانات حالياً. حاول لاحقاً أو راجع حالة التشغيل." };
    case "unknown":
      return { title: "تعذر تحميل بيانات العرض", description: "حدثت مشكلة غير متوقعة أثناء قراءة البيانات." };
    default:
      return { title: "البيانات جاهزة", description: "قاعدة البيانات والمخطط الأساسيان متاحان." };
  }
}

export function invalidateDatabaseReadinessCache() {
  delete readinessCache.__databaseReadiness;
}

/**
 * A small, cached readiness probe. It checks only the runtime tables needed by
 * public pages and background jobs; it never returns credentials or SQL errors.
 */
export async function getDatabaseReadiness(options: { force?: boolean; cacheMs?: number } = {}): Promise<DatabaseReadiness> {
  const now = Date.now();
  const cacheMs = Math.max(1_000, Math.min(options.cacheMs ?? 20_000, 120_000));
  if (!options.force && readinessCache.__databaseReadiness && readinessCache.__databaseReadiness.expiresAt > now) {
    return readinessCache.__databaseReadiness.value;
  }

  const checkedAt = new Date().toISOString();
  if (isNextProductionBuildPhase()) return { state: "unknown", missingTables: [], checkedAt };
  if (!hasConfiguredDatabaseUrl()) {
    const value: DatabaseReadiness = { state: "unconfigured", missingTables: [], checkedAt };
    readinessCache.__databaseReadiness = { value, expiresAt: now + cacheMs };
    return value;
  }

  try {
    const rows = await db.execute(sql`
      select required.table_name
      from unnest(array[
        '__drizzle_migrations', 'users', 'roles', 'permissions', 'system_settings',
        'stores', 'wings', 'store_wings', 'products', 'background_jobs',
        'store_offer_collections', 'store_offer_items', 'offer_campaigns',
        'admin_promotional_offers', 'store_media', 'categories', 'announcements',
        'news', 'product_variants', 'product_images', 'countries', 'governorates', 'cities'
      ]::text[]) as required(table_name)
      where to_regclass('public.' || required.table_name) is null
      order by required.table_name
    `);
    const missingTables = (rows as unknown as Array<{ table_name?: string }>).map((row) => row.table_name || "").filter(Boolean);
    const value: DatabaseReadiness = {
      state: missingTables.length ? "schema_incomplete" : "ready",
      missingTables,
      checkedAt
    };
    readinessCache.__databaseReadiness = { value, expiresAt: now + cacheMs };
    return value;
  } catch (error) {
    const classified = classifyDatabaseError(error);
    const value: DatabaseReadiness = { state: classified.state, missingTables: [], errorCode: classified.errorCode, checkedAt };
    readinessCache.__databaseReadiness = { value, expiresAt: now + cacheMs };
    return value;
  }
}
