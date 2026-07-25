import { headers } from "next/headers";
import { auditLogs, db } from "@/lib/db";
import type { auditActionEnum } from "@/lib/db/schema";

type AuditAction = (typeof auditActionEnum.enumValues)[number];
export type AuditCategory = "financial" | "inventory" | "administrative" | "security" | "system";

const MAX_AUDIT_STRING = 2_000;
const MAX_AUDIT_ARRAY_ITEMS = 50;
const MAX_AUDIT_DEPTH = 6;
const INLINE_DATA_RE = /^data:(image|video|audio|application)\/[a-zA-Z0-9.+-]+;base64,/;
const MEDIA_KEY_RE = /(image|images|logo|cover|url|file|proof|media|avatar|photo|video)/i;
const SECRET_KEY_RE = /(api[_-]?key|secret|token|authorization|credential|password|private[_-]?key|signature|webhook[_-]?secret|extra[_-]?headers?)/i;

function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (INLINE_DATA_RE.test(value)) return `[redacted inline media ${Math.round(value.length / 1024)}KB]`;
    if (value.length > MAX_AUDIT_STRING) return `${value.slice(0, MAX_AUDIT_STRING)}…[truncated ${value.length - MAX_AUDIT_STRING} chars]`;
    return value;
  }
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_AUDIT_DEPTH) return "[max depth]";

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_AUDIT_ARRAY_ITEMS).map((item) => sanitizeAuditValue(item, depth + 1));
    if (value.length > MAX_AUDIT_ARRAY_ITEMS) items.push(`[truncated ${value.length - MAX_AUDIT_ARRAY_ITEMS} items]`);
    return items;
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY_RE.test(key)) {
      output[key] = "[redacted secret]";
    } else if (typeof item === "string" && MEDIA_KEY_RE.test(key) && item.length > MAX_AUDIT_STRING) {
      output[key] = INLINE_DATA_RE.test(item) ? `[redacted inline media ${Math.round(item.length / 1024)}KB]` : `${item.slice(0, 400)}…[truncated media-like field]`;
    } else {
      output[key] = sanitizeAuditValue(item, depth + 1);
    }
  }
  return output;
}

export function inferAuditCategory(entityType: string): AuditCategory {
  const value = entityType.toLowerCase();
  if (value.startsWith("security.") || /(password|session|login|mfa|webhook|auth)/.test(value)) return "security";
  if (value.startsWith("financial.") || /(payment|payout|refund|ledger|wallet|settlement|invoice|finance)/.test(value)) return "financial";
  if (value.startsWith("inventory.") || /(inventory|stock|variant|reservation)/.test(value)) return "inventory";
  if (value.startsWith("system.")) return "system";
  return "administrative";
}

export async function writeAuditLog(input: {
  actorId?: string | null;
  action: AuditAction;
  category?: AuditCategory;
  entityType: string;
  entityId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  correlationId?: string | null;
}) {
  const h = await headers();
  await db.insert(auditLogs).values({
    actorId: input.actorId || null,
    action: input.action,
    category: input.category || inferAuditCategory(input.entityType),
    entityType: input.entityType,
    entityId: input.entityId || null,
    beforeData: sanitizeAuditValue(input.beforeData ?? null) as Record<string, unknown> | null,
    afterData: sanitizeAuditValue(input.afterData ?? null) as Record<string, unknown> | null,
    ipAddress: h.get("x-forwarded-for") || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent") || null,
    correlationId: input.correlationId || h.get("x-request-id") || null
  });
}

export const __auditInternals = { sanitizeAuditValue, inferAuditCategory };
