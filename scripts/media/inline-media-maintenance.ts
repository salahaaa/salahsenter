import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { parseInlineDataImage } from "@/lib/inline-media";
import { isObjectStorageConfigured, uploadMediaFile } from "@/lib/media";

const args = new Set(process.argv.slice(2));
const mode = args.has("--migrate") ? "migrate" : args.has("--export") ? "export" : "audit";
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1] || 100)) : 1000;
const exportDir = process.argv.find((arg) => arg.startsWith("--export-dir="))?.split("=")[1] || "backups/inline-media-export";
const allowLocal = args.has("--allow-local");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(databaseUrl, { max: 1, prepare: false, ssl: databaseUrl.includes("sslmode=disable") ? false : "require" });

type Source =
  | { kind: "field"; label: string; table: string; idColumn: string; field: string; folder: string }
  | { kind: "jsonImage"; label: string; table: string; idColumn: string; jsonField: string; folder: string }
  | { kind: "jsonArray"; label: string; table: string; idColumn: string; field: string; folder: string }
  | { kind: "settingsField"; label: string; group: string; key: string; field: string; folder: string };

type InlineRow = { id: string; value: string; chars: number; index?: number; group?: string; key?: string; field?: string };

const sources: Source[] = [
  { kind: "field", label: "banners.image_url", table: "banners", idColumn: "id", field: "image_url", folder: "admin/banners" },
  { kind: "field", label: "announcements.image_url", table: "announcements", idColumn: "id", field: "image_url", folder: "admin/announcements" },
  { kind: "field", label: "admin_promotional_offers.image_url", table: "admin_promotional_offers", idColumn: "id", field: "image_url", folder: "admin/promotional-offers" },
  { kind: "field", label: "store_offer_collections.image_url", table: "store_offer_collections", idColumn: "id", field: "image_url", folder: "store-offers" },
  { kind: "field", label: "stores.cover_image_url", table: "stores", idColumn: "id", field: "cover_image_url", folder: "stores/covers" },
  { kind: "field", label: "stores.logo_url", table: "stores", idColumn: "id", field: "logo_url", folder: "stores/logos" },
  { kind: "field", label: "stores.intro_image_url", table: "stores", idColumn: "id", field: "intro_image_url", folder: "stores/intro" },
  { kind: "field", label: "wings.icon_url", table: "wings", idColumn: "id", field: "icon_url", folder: "admin/wings" },
  { kind: "field", label: "wings.hero_image_url", table: "wings", idColumn: "id", field: "hero_image_url", folder: "admin/wings" },
  { kind: "field", label: "wings.mobile_image_url", table: "wings", idColumn: "id", field: "mobile_image_url", folder: "admin/wings" },
  { kind: "field", label: "wings.desktop_image_url", table: "wings", idColumn: "id", field: "desktop_image_url", folder: "admin/wings" },
  { kind: "field", label: "products.main_image_url", table: "products", idColumn: "id", field: "main_image_url", folder: "products" },
  { kind: "jsonArray", label: "products.images[]", table: "products", idColumn: "id", field: "images", folder: "products/gallery" },
  { kind: "field", label: "product_variants.image_url", table: "product_variants", idColumn: "id", field: "image_url", folder: "products/variants" },
  { kind: "jsonArray", label: "product_variants.images[]", table: "product_variants", idColumn: "id", field: "images", folder: "products/variants/gallery" },
  { kind: "field", label: "categories.image_url", table: "categories", idColumn: "id", field: "image_url", folder: "categories" },
  { kind: "field", label: "store_media.url", table: "store_media", idColumn: "id", field: "url", folder: "store-media" },
  { kind: "field", label: "product_images.url", table: "product_images", idColumn: "id", field: "url", folder: "product-images" },
  { kind: "field", label: "order_items.image_url", table: "order_items", idColumn: "id", field: "image_url", folder: "order-items" },
  { kind: "jsonImage", label: "order_items.product_snapshot.imageUrl", table: "order_items", idColumn: "id", jsonField: "product_snapshot", folder: "order-items/snapshots" },
  { kind: "field", label: "merchant_applications.contract_signature_data_url", table: "merchant_applications", idColumn: "id", field: "contract_signature_data_url", folder: "contracts/signatures/applications" },
  { kind: "field", label: "merchant_contracts.signature_data_url", table: "merchant_contracts", idColumn: "id", field: "signature_data_url", folder: "contracts/signatures/contracts" },
  { kind: "field", label: "default_activity_media.url", table: "default_activity_media", idColumn: "id", field: "url", folder: "default-activity-media" },
  { kind: "field", label: "media_assets.url", table: "media_assets", idColumn: "id", field: "url", folder: "media-assets" },
  { kind: "jsonImage", label: "ad_campaigns.creative.imageUrl", table: "ad_campaigns", idColumn: "id", jsonField: "creative", folder: "ad-campaigns" },
  { kind: "settingsField", label: "settings.homepage.content.heroBackgroundImage", group: "homepage", key: "content", field: "heroBackgroundImage", folder: "settings/homepage" },
  { kind: "settingsField", label: "settings.homepage.welcome_popup.imageUrl", group: "homepage", key: "welcome_popup", field: "imageUrl", folder: "settings/homepage" },
  { kind: "settingsField", label: "settings.offers.page_settings.heroBackgroundImage", group: "offers", key: "page_settings", field: "heroBackgroundImage", folder: "settings/offers" },
  { kind: "settingsField", label: "settings.offers.page_settings.listBackgroundImage", group: "offers", key: "page_settings", field: "listBackgroundImage", folder: "settings/offers" }
];

function quoteIdent(value: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new Error(`Invalid identifier: ${value}`);
  return `"${value}"`;
}

function extFromMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/svg+xml") return "svg";
  return "img";
}

async function listInlineRows(source: Source): Promise<InlineRow[]> {
  if (source.kind === "field") {
    return await sql.unsafe(
      `select ${quoteIdent(source.idColumn)}::text as id, ${quoteIdent(source.field)} as value, length(${quoteIdent(source.field)})::int as chars from ${quoteIdent(source.table)} where ${quoteIdent(source.field)} like 'data:image/%;base64,%' order by ${quoteIdent(source.idColumn)} limit $1`,
      [limit]
    ) as unknown as InlineRow[];
  }
  if (source.kind === "jsonImage") {
    return await sql.unsafe(
      `select ${quoteIdent(source.idColumn)}::text as id, ${quoteIdent(source.jsonField)}->>'imageUrl' as value, length(${quoteIdent(source.jsonField)}->>'imageUrl')::int as chars from ${quoteIdent(source.table)} where ${quoteIdent(source.jsonField)}->>'imageUrl' like 'data:image/%;base64,%' order by ${quoteIdent(source.idColumn)} limit $1`,
      [limit]
    ) as unknown as InlineRow[];
  }
  if (source.kind === "jsonArray") {
    return await sql.unsafe(
      `select t.${quoteIdent(source.idColumn)}::text as id, (arr.ordinality - 1)::int as index, arr.value as value, length(arr.value)::int as chars
       from ${quoteIdent(source.table)} t
       cross join lateral jsonb_array_elements_text(coalesce(t.${quoteIdent(source.field)}, '[]'::jsonb)) with ordinality as arr(value, ordinality)
       where arr.value like 'data:image/%;base64,%'
       order by t.${quoteIdent(source.idColumn)}, arr.ordinality
       limit $1`,
      [limit]
    ) as unknown as InlineRow[];
  }
  return await sql.unsafe(
    `select id::text as id, $1::text as field, $2::text as "group", $3::text as key, value->>$1 as value, length(value->>$1)::int as chars
     from system_settings
     where "group" = $2 and key = $3 and value->>$1 like 'data:image/%;base64,%'
     limit $4`,
    [source.field, source.group, source.key, limit]
  ) as unknown as InlineRow[];
}

async function countInline(source: Source) {
  if (source.kind === "field") {
    const [row] = await sql.unsafe(`select count(*)::int as count, coalesce(sum(length(${quoteIdent(source.field)})),0)::bigint as chars from ${quoteIdent(source.table)} where ${quoteIdent(source.field)} like 'data:image/%;base64,%'`);
    return row as unknown as { count: number; chars: string | number };
  }
  if (source.kind === "jsonImage") {
    const [row] = await sql.unsafe(`select count(*)::int as count, coalesce(sum(length(${quoteIdent(source.jsonField)}->>'imageUrl')),0)::bigint as chars from ${quoteIdent(source.table)} where ${quoteIdent(source.jsonField)}->>'imageUrl' like 'data:image/%;base64,%'`);
    return row as unknown as { count: number; chars: string | number };
  }
  if (source.kind === "jsonArray") {
    const [row] = await sql.unsafe(
      `select count(*)::int as count, coalesce(sum(length(arr.value)),0)::bigint as chars
       from ${quoteIdent(source.table)} t
       cross join lateral jsonb_array_elements_text(coalesce(t.${quoteIdent(source.field)}, '[]'::jsonb)) as arr(value)
       where arr.value like 'data:image/%;base64,%'`
    );
    return row as unknown as { count: number; chars: string | number };
  }
  const [row] = await sql.unsafe(`select count(*)::int as count, coalesce(sum(length(value->>$1)),0)::bigint as chars from system_settings where "group" = $2 and key = $3 and value->>$1 like 'data:image/%;base64,%'`, [source.field, source.group, source.key]);
  return row as unknown as { count: number; chars: string | number };
}

async function updateRow(source: Source, row: InlineRow, url: string) {
  if (source.kind === "field") {
    await sql.unsafe(`update ${quoteIdent(source.table)} set ${quoteIdent(source.field)} = $1 where ${quoteIdent(source.idColumn)} = $2`, [url, row.id]);
    return;
  }
  if (source.kind === "jsonImage") {
    await sql.unsafe(`update ${quoteIdent(source.table)} set ${quoteIdent(source.jsonField)} = jsonb_set(${quoteIdent(source.jsonField)}, '{imageUrl}', to_jsonb($1::text), true) where ${quoteIdent(source.idColumn)} = $2`, [url, row.id]);
    return;
  }
  if (source.kind === "jsonArray") {
    if (!Number.isInteger(row.index)) throw new Error("Missing array index");
    await sql.unsafe(`update ${quoteIdent(source.table)} set ${quoteIdent(source.field)} = jsonb_set(${quoteIdent(source.field)}, array[$1]::text[], to_jsonb($2::text), false) where ${quoteIdent(source.idColumn)} = $3`, [String(row.index), url, row.id]);
    return;
  }
  await sql.unsafe(`update system_settings set value = jsonb_set(value, array[$1]::text[], to_jsonb($2::text), true), updated_at = now() where id = $3`, [source.field, url, row.id]);
}

async function exportOrMigrate(source: Source, row: InlineRow) {
  const parsed = parseInlineDataImage(row.value);
  if (!parsed) return { id: row.id, index: row.index, ok: false, error: "invalid_data_url" };
  const buffer = Buffer.from(parsed.base64, "base64");
  const extension = extFromMime(parsed.mimeType);
  const fieldName = source.kind === "field" || source.kind === "jsonArray" ? source.field : source.kind === "jsonImage" ? source.jsonField : source.field;
  const suffix = row.index == null ? "" : `-${row.index}`;
  const fileName = `${source.label}-${row.id}${suffix}.${extension}`.replace(/[^a-zA-Z0-9._-]/g, "-");

  if (mode === "export") {
    const dir = path.join(process.cwd(), exportDir, source.label.replace(/[^a-zA-Z0-9._-]/g, "-"));
    await mkdir(dir, { recursive: true });
    const outPath = path.join(dir, fileName);
    await writeFile(outPath, buffer);
    return { id: row.id, index: row.index, ok: true, exportedTo: outPath, bytes: buffer.length };
  }

  const file = new File([buffer], fileName, { type: parsed.mimeType });
  const uploaded = await uploadMediaFile(file, source.folder);
  await updateRow(source, row, uploaded.url);
  return { id: row.id, index: row.index, ok: true, uploadedUrl: uploaded.url, provider: uploaded.provider, bytes: buffer.length, fieldName };
}

try {
  const summary: Record<string, { count: number; chars: number }> = {};
  for (const source of sources) {
    const count = await countInline(source);
    summary[source.label] = { count: Number(count.count || 0), chars: Number(count.chars || 0) };
  }

  if (mode === "audit") {
    console.log(JSON.stringify({ mode, summary, totalRows: Object.values(summary).reduce((sum, item) => sum + item.count, 0), totalApproxMb: Number((Object.values(summary).reduce((sum, item) => sum + item.chars, 0) / 1024 / 1024).toFixed(2)) }, null, 2));
    process.exit(0);
  }

  if (mode === "migrate" && !isObjectStorageConfigured() && !allowLocal) {
    throw new Error("MEDIA_PROVIDER must be cloudinary/s3/r2 for migration. Use --allow-local only for local rehearsal.");
  }

  const results: Record<string, unknown[]> = {};
  for (const source of sources) {
    const rows = await listInlineRows(source);
    results[source.label] = [];
    for (const row of rows) {
      try {
        (results[source.label] as unknown[]).push(await exportOrMigrate(source, row));
      } catch (error) {
        (results[source.label] as unknown[]).push({ id: row.id, index: row.index, ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  console.log(JSON.stringify({ mode, limit, exportDir: mode === "export" ? exportDir : undefined, summary, results }, null, 2));
} finally {
  await sql.end();
}
