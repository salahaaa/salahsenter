import { sql } from "drizzle-orm";
import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import { getDatabaseReadiness } from "@/lib/database-readiness";
import { getRedisConfig } from "@/lib/redis/client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";
  const redis = getRedisConfig();
  const base = {
    status: "ok",
    service: "enterprise-marketplace",
    time: new Date().toISOString(),
    redis: { configured: redis.backend !== "unconfigured", backend: redis.backend, required: redis.productionStrict }
  };

  if (!deep) return ok(base);

  try {
    const [ping, schema] = await Promise.all([db.execute(sql`select now() as now`), getDatabaseReadiness({ force: true })]);
    const schemaReady = schema.state === "ready";
    return ok({
      ...base,
      status: schemaReady ? "ok" : "degraded",
      database: { ok: true, now: ping[0]?.now || null },
      // Keep public health useful without leaking relation names, connection
      // strings, SQL statements or driver error text.
      schema: { ok: schemaReady, state: schema.state, checkedAt: schema.checkedAt }
    }, schemaReady ? undefined : { status: 503 });
  } catch {
    return ok({ ...base, status: "degraded", database: { ok: false }, schema: { ok: false, state: "unavailable" } }, { status: 503 });
  }
}
