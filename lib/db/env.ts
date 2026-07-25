function firstConfiguredDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_PRIVATE_URL ||
    ""
  );
}

export function normalizeDatabaseUrl(url: string) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const isPostgres = ["postgres:", "postgresql:"].includes(parsed.protocol);
    if (!isPostgres) return url;

    const host = parsed.hostname;
    const shouldRequireSsl =
      process.env.DATABASE_SSL === "require" ||
      process.env.NODE_ENV === "production" ||
      host.endsWith(".render.com") ||
      host.includes("postgres.render.com");

    if (shouldRequireSsl && !parsed.searchParams.has("sslmode")) {
      parsed.searchParams.set("sslmode", "require");
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

export function getDatabaseUrl() {
  return normalizeDatabaseUrl(firstConfiguredDatabaseUrl());
}

export function isLikelyRenderInternalDatabaseUrl(url = getDatabaseUrl()) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.startsWith("dpg-") && !parsed.hostname.includes(".");
  } catch {
    return false;
  }
}

export function hasConfiguredDatabaseUrl() {
  const url = getDatabaseUrl();
  return Boolean(url) && !isLikelyRenderInternalDatabaseUrl(url);
}

/** Operator override plus conservative host/query detection for PgBouncer/Neon poolers. */
export function isLikelyPooledDatabaseUrl(url = getDatabaseUrl()) {
  if (String(process.env.DATABASE_POOLER_ENABLED || "").toLowerCase() === "true") return true;
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("pooler") || parsed.hostname.includes("pgbouncer") || parsed.searchParams.get("pgbouncer") === "true";
  } catch {
    return false;
  }
}

export function maskDatabaseUrl(url: string) {
  if (!url) return "not-configured";
  try {
    const parsed = new URL(normalizeDatabaseUrl(url));
    if (parsed.password) parsed.password = "***";
    if (parsed.username) parsed.username = parsed.username.slice(0, 2) + "***";
    return parsed.toString();
  } catch {
    return "configured-invalid-url";
  }
}

export function getDatabaseUrlDiagnostics() {
  const raw = firstConfiguredDatabaseUrl();
  const normalized = getDatabaseUrl();
  let hostname = "not-configured";
  let sslMode = "not-configured";
  try {
    const parsed = new URL(normalized);
    hostname = parsed.hostname;
    sslMode = parsed.searchParams.get("sslmode") || "missing";
  } catch {
    hostname = "invalid-url";
    sslMode = "invalid-url";
  }
  return {
    configured: Boolean(raw),
    maskedUrl: maskDatabaseUrl(normalized),
    hostname,
    sslMode,
    isLikelyRenderInternalUrl: isLikelyRenderInternalDatabaseUrl(normalized),
    isLikelyPooledUrl: isLikelyPooledDatabaseUrl(normalized),
    isVercel: Boolean(process.env.VERCEL),
    nodeEnv: process.env.NODE_ENV || "unknown"
  };
}
