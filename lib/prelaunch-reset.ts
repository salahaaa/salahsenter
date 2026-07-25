import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import {
  auditLogs,
  db,
  platformOwnerAccounts,
  platformSensitiveControlSessions,
  platformSensitiveControlSettings,
  prelaunchResetRuns,
  systemSettings,
  users
} from "@/lib/db";
import { hashOpaqueToken } from "@/lib/sensitive-control";

type DbLike = any;

/**
 * This is an explicit pre-launch data purge, not a generic database reset.
 * It preserves platform reference/configuration data (roles, permissions,
 * master settings, geography, wings, templates and migration history) while
 * removing transactional/manual marketplace work. Every statement runs in one
 * transaction: a failure rolls the whole purge back.
 */
const STORE_AND_APPLICATION_ROOTS = [
  "stores",
  "merchant_applications",
  "merchants"
];

const MANUAL_CONTENT_TABLES = [
  "banners",
  "announcements",
  "news",
  "cms_pages",
  "menu_items",
  "ad_campaigns",
  "home_exposure_requests"
];

async function countTable(tx: DbLike, table: string) {
  const rows = await tx.execute(sql.raw(`select count(*)::int as count from "${table}"`));
  return Number((rows as any[])[0]?.count || 0);
}

export async function getPrelaunchPurgePreview(tx: DbLike = db) {
  const tables = ["users", "stores", "merchant_applications", "products", "orders", "ad_campaigns", "store_offer_collections", "merchant_contracts", "banners", "announcements", "news"];
  const entries = await Promise.all(tables.map(async (table) => [table, await countTable(tx, table)] as const));
  return Object.fromEntries(entries);
}

export async function executePrelaunchPurge(input: { initiatedBy: string; tx?: DbLike }) {
  const executor = input.tx || db;
  const work = async (tx: DbLike) => {
    const preview = await getPrelaunchPurgePreview(tx);
    const bootstrapToken = crypto.randomBytes(32).toString("base64url");
    const bootstrapTokenHash = hashOpaqueToken(bootstrapToken);
    const now = new Date();

    // Lock down public activity first. This setting survives all truncation.
    const lockdownValue = {
      emergencyLockdown: true,
      maintenanceMode: true,
      securityLevel: "lockdown",
      messageTitle: "المنصة قيد التهيئة قبل الإطلاق",
      messageBody: "لا يمكن التسجيل أو التجارة أثناء تصفية بيانات ما قبل الإطلاق.",
      disabledModules: { orders: true, merchantApplications: true, uploads: true, registrations: true },
      reason: "prelaunch_data_purge"
    };
    await tx.insert(systemSettings).values({ group: "security", key: "platform_guard", value: lockdownValue, isPublic: false, updatedBy: null })
      .onConflictDoUpdate({ target: [systemSettings.group, systemSettings.key], set: { value: lockdownValue, updatedBy: null, updatedAt: now } });

    // Stores and applications are roots for most tenant operational records;
    // CASCADE intentionally removes child catalog, stock, order, finance,
    // contracts, employees, offers and ads attached to those roots.
    await tx.execute(sql.raw(`TRUNCATE TABLE ${STORE_AND_APPLICATION_ROOTS.map((table) => `"${table}"`).join(", ")} RESTART IDENTITY CASCADE`));
    // Global manual content is not a platform setting and is removed separately.
    await tx.execute(sql.raw(`TRUNCATE TABLE ${MANUAL_CONTENT_TABLES.map((table) => `"${table}"`).join(", ")} RESTART IDENTITY CASCADE`));

    // Remove store/user-scoped settings but preserve master/platform configuration.
    await tx.delete(systemSettings).where(sql`${systemSettings.group} like 'store:%' or ${systemSettings.group} like 'user:%'`);
    await tx.delete(auditLogs);
    await tx.delete(platformSensitiveControlSessions);
    await tx.delete(platformOwnerAccounts);
    await tx.delete(platformSensitiveControlSettings);
    await tx.delete(prelaunchResetRuns);

    // All remaining accounts are pre-launch identities. Related sessions/roles
    // use FK cascade or SET NULL and platform reference roles remain intact.
    await tx.delete(users);

    const [run] = await tx.insert(prelaunchResetRuns).values({
      initiatedBy: null,
      status: "bootstrap_pending",
      purgeSummary: preview,
      bootstrapTokenHash,
      bootstrapExpiresAt: new Date(now.getTime() + 15 * 60 * 1000)
    }).returning();
    return { run, bootstrapToken, preview };
  };
  return input.tx ? work(executor) : executor.transaction(work);
}
