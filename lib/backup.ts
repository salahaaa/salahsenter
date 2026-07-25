import crypto from "crypto";
import path from "path";
import { readFile } from "fs/promises";
import { client } from "@/lib/db";
import { ApiError } from "@/lib/api";
import {
  assertDurableBackupStorage,
  backupDir,
  getBackupStorageConfig,
  listStoredBackupFiles,
  readStoredBackup,
  storeBackupDatabase,
  verifyStoredBackupIntegrity,
  storeBackupMediaObject
} from "@/lib/backup-storage";

// Recovery-target authorization is environment-local control data. It must
// never be copied from a source backup or truncated during a restore drill.
const excludedTables = new Set(["__drizzle_migrations", "backup_recovery_targets"]);
const mediaKeyPattern = /(image|images|logo|cover|media|video|file|proof|avatar|photo|url)$/i;

type SqlClient = any;

export type BackupMediaEntry = {
  source: string;
  status: "stored" | "skipped" | "failed";
  objectKey?: string;
  bytes?: number;
  reason?: string;
  sha256?: string;
};

export type BackupPayload = {
  version: number;
  createdAt: string;
  mode: "full_database_json";
  tables: Record<string, Record<string, unknown>[]>;
  media?: { enabled: boolean; discovered: number; entries: BackupMediaEntry[] };
};

function quoteIdent(value: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new Error(`Invalid identifier: ${value}`);
  return `"${value.replace(/"/g, "")}"`;
}

export async function getPublicTables(sqlClient: SqlClient = client) {
  const rows: Array<{ table_name: string }> = await sqlClient`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `;
  return rows.map((row: { table_name: string }) => row.table_name).filter((table: string) => !excludedTables.has(table));
}

async function getRestoreOrder(tables: string[], sqlClient: SqlClient = client) {
  const tableSet = new Set(tables);
  const rows = await sqlClient<{ table_name: string; referenced_table_name: string }[]>`
    select tc.table_name, ccu.table_name as referenced_table_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
  `;

  const deps = new Map<string, Set<string>>();
  for (const table of tables) deps.set(table, new Set());
  for (const row of rows) {
    if (tableSet.has(row.table_name) && tableSet.has(row.referenced_table_name) && row.table_name !== row.referenced_table_name) deps.get(row.table_name)?.add(row.referenced_table_name);
  }

  const ordered: string[] = [];
  const temporary = new Set<string>();
  const permanent = new Set<string>();
  function visit(table: string) {
    if (permanent.has(table) || temporary.has(table)) return;
    temporary.add(table);
    for (const dep of deps.get(table) || []) visit(dep);
    temporary.delete(table);
    permanent.add(table);
    ordered.push(table);
  }
  for (const table of tables) visit(table);
  return ordered;
}

function normalizeRows(rows: unknown) {
  return Array.isArray(rows) ? rows.filter((row) => row && typeof row === "object") as Record<string, unknown>[] : [];
}

function constantTimeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Destructive restores require an explicit phrase. Production additionally
 * requires maintenance mode and a separate operator approval token.
 */
export function assertRestoreSafety(input: { fileName: string; confirmation?: string | null; approvalToken?: string | null }) {
  if (input.confirmation !== `RESTORE ${input.fileName}`) throw new ApiError(`اكتب عبارة التأكيد كاملة: RESTORE ${input.fileName}`, 409);
  const storage = getBackupStorageConfig();
  if (!storage.production) return;
  if (process.env.BACKUP_RESTORE_MAINTENANCE_MODE !== "true") throw new ApiError("استعادة الإنتاج تتطلب BACKUP_RESTORE_MAINTENANCE_MODE=true", 409);
  const expectedToken = process.env.BACKUP_RESTORE_APPROVAL_TOKEN || "";
  if (!expectedToken || !input.approvalToken || !constantTimeEqual(input.approvalToken, expectedToken)) {
    throw new ApiError("استعادة الإنتاج تتطلب رمز اعتماد مستقل", 403);
  }
}

async function insertRows(sqlClient: SqlClient, table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return 0;
  const columns = Object.keys(rows[0]).filter((column) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column));
  if (!columns.length) return 0;
  const quotedTable = quoteIdent(table);
  const quotedColumns = columns.map(quoteIdent).join(", ");
  let inserted = 0;
  for (const row of rows) {
    const values = columns.map((column) => row[column] ?? null) as any[];
    const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
    await sqlClient.unsafe(`insert into ${quotedTable} (${quotedColumns}) values (${placeholders}) on conflict do nothing`, values);
    inserted += 1;
  }
  return inserted;
}

function collectMediaUrls(value: unknown, hint = "", output = new Set<string>(), depth = 0): Set<string> {
  if (depth > 8 || value == null) return output;
  if (typeof value === "string") {
    if (mediaKeyPattern.test(hint) && (/^https?:\/\//.test(value) || value.startsWith("/uploads/"))) output.add(value);
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectMediaUrls(item, hint, output, depth + 1);
    return output;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) collectMediaUrls(item, key, output, depth + 1);
  }
  return output;
}

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function allowedMediaHosts() {
  return new Set(String(process.env.BACKUP_MEDIA_SOURCE_HOSTS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
}

async function readMediaSource(source: string, allowedHosts: Set<string>, maxBytes: number) {
  if (source.startsWith("/uploads/")) {
    const sourcePath = path.resolve(process.cwd(), "public", `.${source}`);
    const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
    if (!sourcePath.startsWith(`${uploadsRoot}${path.sep}`)) throw new Error("مسار media محلي غير صالح");
    const body = await readFile(sourcePath);
    if (body.length > maxBytes) throw new Error("حجم الملف يتجاوز حد backup media");
    return { body, contentType: "application/octet-stream" };
  }
  const url = new URL(source);
  if (url.protocol !== "https:") throw new Error("يسمح backup media بروابط HTTPS فقط");
  if (!allowedHosts.has(url.hostname.toLowerCase())) throw new Error("مصدر media غير موجود في BACKUP_MEDIA_SOURCE_HOSTS");
  const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`تعذر تنزيل media: HTTP ${response.status}`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxBytes) throw new Error("حجم الملف يتجاوز حد backup media");
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > maxBytes) throw new Error("حجم الملف يتجاوز حد backup media");
  return { body, contentType: response.headers.get("content-type") || "application/octet-stream" };
}

async function backupMedia(payload: BackupPayload) {
  const enabled = process.env.BACKUP_MEDIA_ENABLED === "true";
  const mediaUrls = [...collectMediaUrls(payload.tables)];
  if (!enabled) return { enabled: false, discovered: mediaUrls.length, entries: [] as BackupMediaEntry[] };

  const config = assertDurableBackupStorage();
  const maxFiles = numberEnv("BACKUP_MEDIA_MAX_FILES", 500);
  const maxBytes = numberEnv("BACKUP_MEDIA_MAX_BYTES", 25 * 1024 * 1024);
  const allowedHosts = allowedMediaHosts();
  const runPrefix = `${config.mediaPrefix}/${payload.createdAt.replace(/[:.]/g, "-")}`;
  const entries: BackupMediaEntry[] = [];

  for (const source of mediaUrls.slice(0, maxFiles)) {
    try {
      const { body, contentType } = await readMediaSource(source, allowedHosts, maxBytes);
      const sha256 = crypto.createHash("sha256").update(body).digest("hex");
      const extension = source.startsWith("/uploads/") ? path.extname(source) : path.extname(new URL(source).pathname);
      const objectKey = `${runPrefix}/${sha256}${extension && extension.length <= 12 ? extension : ".bin"}`;
      const stored = await storeBackupMediaObject({ key: objectKey, body, contentType, sourceSha256: sha256 });
      entries.push({ source, status: "stored", objectKey: stored.objectKey, bytes: stored.bytes, sha256 });
    } catch (error) {
      entries.push({ source, status: "failed", reason: error instanceof Error ? error.message : "فشل غير معروف" });
    }
  }
  for (const source of mediaUrls.slice(maxFiles)) entries.push({ source, status: "skipped", reason: `تجاوز BACKUP_MEDIA_MAX_FILES=${maxFiles}` });
  return { enabled: true, discovered: mediaUrls.length, entries };
}

export async function createBackup(options: { includeMedia?: boolean; sqlClient?: SqlClient } = {}) {
  const sqlClient = options.sqlClient || client;
  assertDurableBackupStorage();
  const tables = await getPublicTables(sqlClient);
  const data: BackupPayload["tables"] = {};
  for (const table of tables) data[table] = await sqlClient.unsafe(`select * from ${quoteIdent(table)} order by 1`);

  const payload: BackupPayload = { version: 3, mode: "full_database_json", createdAt: new Date().toISOString(), tables: data };
  if (options.includeMedia ?? process.env.BACKUP_MEDIA_ENABLED === "true") payload.media = await backupMedia(payload);
  const raw = Buffer.from(JSON.stringify(payload));
  const fileName = `backup-${payload.createdAt.replace(/[:.]/g, "-")}.json`;
  const stored = await storeBackupDatabase(fileName, raw);
  return {
    fileName,
    createdAt: payload.createdAt,
    storage: stored.provider,
    objectKey: stored.objectKey,
    sha256: stored.sha256,
    bytes: stored.bytes,
    tables: tables.length,
    rows: Object.fromEntries(Object.entries(data).map(([table, rows]) => [table, rows.length])),
    media: payload.media || { enabled: false, discovered: 0, entries: [] }
  };
}

export async function listBackups() {
  return listStoredBackupFiles();
}

export async function readBackupRaw(fileName: string) {
  return readStoredBackup(fileName);
}

export async function readBackup(fileName: string) {
  return parseBackupPayload((await readBackupRaw(fileName)).toString("utf8"));
}

/** Reads a backup and verifies the SHA-256 metadata when stored remotely. */
export async function readBackupWithIntegrity(fileName: string) {
  const stored = await verifyStoredBackupIntegrity(fileName);
  return {
    backup: parseBackupPayload(stored.raw.toString("utf8")),
    integrity: {
      provider: stored.provider,
      objectKey: stored.objectKey,
      sha256: stored.sha256,
      expectedSha256: stored.expectedSha256,
      metadataVerified: stored.metadataVerified,
      bytes: stored.bytes
    }
  };
}

export async function restoreBackupPayload(backup: BackupPayload, sqlClient: SqlClient = client) {
  if (!backup.tables || typeof backup.tables !== "object") throw new Error("ملف النسخة لا يحتوي بيانات صالحة");
  const currentTables = await getPublicTables(sqlClient);
  const backupTables = Object.keys(backup.tables).filter((table) => currentTables.includes(table));
  const restoreOrder = await getRestoreOrder(backupTables, sqlClient);
  const restored: Record<string, number> = {};

  await sqlClient.begin(async (tx: SqlClient) => {
    if (backupTables.length) await tx.unsafe(`truncate table ${backupTables.map(quoteIdent).join(", ")} restart identity cascade`);
    for (const table of restoreOrder) {
      const rows = normalizeRows(backup.tables[table]);
      restored[table] = rows.length ? await insertRows(tx, table, rows) : 0;
    }
  });

  return { restored, createdAt: backup.createdAt, tables: backupTables.length, media: backup.media || null };
}

export async function restoreBackup(fileName: string) {
  return restoreBackupPayload(await readBackup(fileName));
}

export function parseBackupPayload(raw: string) {
  const payload = JSON.parse(raw) as BackupPayload;
  if (!payload || payload.mode !== "full_database_json" || !payload.tables || ![2, 3].includes(payload.version)) throw new Error("ملف النسخة الاحتياطية غير صالح");
  return payload;
}

export { backupDir, getBackupStorageConfig };
