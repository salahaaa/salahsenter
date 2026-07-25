// Shared list-API optimization utilities.
// Server-safe (NO "use client"). Used by all List GET handlers to enforce:
//   - controlled pagination (page / pageSize / totalCount / hasNext)
//   - base64 image stripping (data:image/... → inline proxy URL + hasInlineImage flag)
//   - targeted search parsing with Arabic-safe ilike matching
//
// Design goals:
//   * Never return raw base64 inside a List payload.
//   * Replace base64 with a SHORT inline-media proxy URL (images still render via /api/media/inline).
//   * Expose `hasInlineImage` so clients know the original was an inline image.
//   * Keep a single source of truth so every list endpoint behaves consistently.

import { type SQL, ilike, or } from "drizzle-orm";
import { isInlineDataImageUrl, inlineRowMediaUrl } from "@/lib/inline-media";

export interface ListQuery {
  page: number;
  pageSize: number;
  offset: number;
  q: string;
  raw: Record<string, string | string[] | undefined>;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Parse & validate pagination + search from request URL search params. */
export function parseListQuery(
  request: Request | { url?: string } | URL,
  opts: { defaultPageSize?: number; maxPageSize?: number } = {}
): ListQuery {
  const url = request instanceof URL ? request : new URL((request as Request).url || "http://localhost");
  const first = (key: string) => {
    const v = url.searchParams.getAll(key);
    return v.length ? v[v.length - 1] : "";
  };
  const max = opts.maxPageSize ?? MAX_PAGE_SIZE;
  const pageSize = clamp(Number(first("pageSize")) || opts.defaultPageSize || DEFAULT_PAGE_SIZE, 1, max);
  const page = Math.max(1, Math.floor(Number(first("page")) || 1));
  return { page, pageSize, offset: (page - 1) * pageSize, q: first("q").trim(), raw: Object.fromEntries(url.searchParams) };
}

/** Build a standard paginated response envelope. */
export function listResponse<T>(items: T[], totalCount: number, query: ListQuery) {
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    totalCount,
    hasNext: query.offset + items.length < totalCount,
    totalPages: Math.ceil(totalCount / query.pageSize) || 0
  };
}

/**
 * Search-term builder: returns an `or(ilike(...))` SQL fragment across the given text columns,
 * using Arabic-safe case-insensitive matching. Returns `undefined` when the term is empty so it
 * can be conditionally composed into a WHERE clause without full table scans.
 */
export function buildSearchFilter(term: string, columns: SQL[]): SQL | undefined {
  const t = (term || "").trim();
  if (!t || !columns.length) return undefined;
  const pattern = `%${t}%`;
  return or(...columns.map((col) => ilike(col as any, pattern))) as SQL;
}

/**
 * Sanitize inline base64 media on a fetched row (post-query). For each declared field:
 *   - string field: if value is `data:image/...`, replace with the inline proxy URL.
 *   - array field (jsonb string[]): map each base64 element to its proxy URL.
 * Sets `row.hasInlineImage = true` when any conversion happened. Non-image values are untouched.
 */
export function sanitizeMediaFields(
  row: Record<string, unknown>,
  entity: string,
  id: string | null | undefined,
  fields: Array<{ name: string; array?: boolean }>
): Record<string, unknown> {
  if (!row || !id) return row;
  let touched = false;
  for (const { name, array } of fields) {
    const value = row[name];
    if (array && Array.isArray(value)) {
      const mapped = (value as unknown[]).map((item, index) => {
        if (isInlineDataImageUrl(item)) { touched = true; return inlineRowMediaUrl(entity, id, name, item as string, index); }
        return item;
      });
      if (touched) row[name] = mapped.filter(Boolean);
    } else if (isInlineDataImageUrl(value)) {
      touched = true;
      row[name] = inlineRowMediaUrl(entity, id, name, value as string);
    }
  }
  if (touched) row.hasInlineImage = true;
  return row;
}

/** Apply sanitizeMediaFields across a list. */
export function sanitizeMediaList<T extends Record<string, unknown>>(
  rows: T[],
  entity: string,
  idField: string,
  fields: Array<{ name: string; array?: boolean }>
): T[] {
  return rows.map((row) => sanitizeMediaFields(row, entity, row[idField] as string, fields) as T);
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}
