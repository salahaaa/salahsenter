import "dotenv/config";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const sql = postgres(databaseUrl, { max: 1, prepare: false, ssl: databaseUrl.includes("sslmode=disable") ? false : "require" });

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = Number(process.env.AUDIT_REDACTION_BATCH_SIZE || 100);
const DATA_IMAGE_RE = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;

function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (DATA_IMAGE_RE.test(value)) return `[redacted legacy inline image ${Math.round(value.length / 1024)}KB]`;
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) out[key] = redact(item);
    return out;
  }
  return value;
}

try {
  let total = 0;
  const scanned = await sql`select count(*)::int as count from audit_logs where before_data::text like '%data:image/%;base64,%' or after_data::text like '%data:image/%;base64,%'`;
  const remaining = Number(scanned[0]?.count || 0);
  if (DRY_RUN) {
    console.log(JSON.stringify({ dryRun: true, rowsWithInlineMedia: remaining }, null, 2));
    process.exit(0);
  }

  while (true) {
    const rows = await sql`select id, before_data, after_data from audit_logs where before_data::text like '%data:image/%;base64,%' or after_data::text like '%data:image/%;base64,%' order by created_at limit ${BATCH_SIZE}`;
    if (!rows.length) break;
    for (const row of rows) {
      await sql`update audit_logs set before_data=${redact(row.before_data) as any}, after_data=${redact(row.after_data) as any} where id=${row.id}`;
      total += 1;
    }
  }

  console.log(JSON.stringify({ dryRun: false, initialRowsWithInlineMedia: remaining, redactedRows: total }, null, 2));
} finally {
  await sql.end();
}
