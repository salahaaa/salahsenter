import { sql, type AnyColumn, type SQL } from "drizzle-orm";

export const INLINE_MEDIA_API_PATH = "/api/media/inline";

export function isInlineDataImageUrl(value: unknown): boolean {
  return typeof value === "string" && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);
}

export function inlineMediaSql(entity: string, idColumn: AnyColumn, fieldName: string, fieldColumn: AnyColumn): SQL<string | null> {
  const prefix = `${INLINE_MEDIA_API_PATH}?entity=${encodeURIComponent(entity)}&field=${encodeURIComponent(fieldName)}&id=`;
  return sql<string | null>`case when ${fieldColumn} like 'data:image/%;base64,%' then ${prefix} || ${idColumn}::text || '&v=' || md5(${fieldColumn}) else ${fieldColumn} end`;
}

export function inlineMediaValueSql(entity: string, idColumn: AnyColumn, fieldName: string, valueExpression: SQL<string | null>): SQL<string | null> {
  const prefix = `${INLINE_MEDIA_API_PATH}?entity=${encodeURIComponent(entity)}&field=${encodeURIComponent(fieldName)}&id=`;
  return sql<string | null>`case when ${valueExpression} like 'data:image/%;base64,%' then ${prefix} || ${idColumn}::text || '&v=' || md5(${valueExpression}) else ${valueExpression} end`;
}

export function nonInlineMediaSql(fieldColumn: AnyColumn): SQL<string | null> {
  return sql<string | null>`case when ${fieldColumn} like 'data:image/%;base64,%' then null else ${fieldColumn} end`;
}

export function nonInlineMediaValueSql(valueExpression: SQL<string | null>): SQL<string | null> {
  return sql<string | null>`case when ${valueExpression} like 'data:image/%;base64,%' then null else ${valueExpression} end`;
}

export function inlineMediaFlagSql(fieldColumn: AnyColumn): SQL<boolean> {
  return sql<boolean>`case when ${fieldColumn} like 'data:image/%;base64,%' then true else false end`;
}

export function inlineMediaValueFlagSql(valueExpression: SQL<string | null>): SQL<boolean> {
  return sql<boolean>`case when ${valueExpression} like 'data:image/%;base64,%' then true else false end`;
}

export function inlineSettingsMediaUrl(group: string, key: string, fieldName: string, value: string | null | undefined): string {
  if (!value || !isInlineDataImageUrl(value)) return value || "";
  const params = new URLSearchParams({
    entity: "settings",
    group,
    key,
    field: fieldName,
    v: shortMediaSignature(value)
  });
  return `${INLINE_MEDIA_API_PATH}?${params.toString()}`;
}

export function inlineRowMediaUrl(entity: string, id: string | null | undefined, fieldName: string, value: string | null | undefined, index?: number): string | null {
  if (!value || !isInlineDataImageUrl(value) || !id) return value || null;
  const params = new URLSearchParams({ entity, id, field: fieldName, v: shortMediaSignature(value) });
  if (typeof index === "number") params.set("index", String(index));
  return `${INLINE_MEDIA_API_PATH}?${params.toString()}`;
}

export function inlineRowMediaArray(entity: string, id: string | null | undefined, fieldName: string, values: string[] | null | undefined): string[] {
  return (values || []).map((value, index) => inlineRowMediaUrl(entity, id, fieldName, value, index) || value).filter(Boolean);
}

export function shortMediaSignature(value: string) {
  let hash = 2166136261;
  const sample = `${value.length}:${value.slice(0, 160)}:${value.slice(-160)}`;
  for (let index = 0; index < sample.length; index += 1) {
    hash ^= sample.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function parseInlineDataImage(value: string) {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}
