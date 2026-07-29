import { sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import { getDatabaseReadiness } from "@/lib/database-readiness";
import { getRedisConfig } from "@/lib/redis/client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";
  const reval = url.searchParams.get("revalidate") === "1";

  if (reval) {
    revalidateTag("public:home");
    revalidateTag("public:wings");
    revalidateTag("public:stores");
    revalidatePath("/", "page");
    revalidatePath("/", "layout");
    revalidatePath("/wings", "page");
  }

  const redis = getRedisConfig();
  const base = {
    status: "ok",
    service: "enterprise-marketplace",
    revalidated: reval,
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
      schema: { ok: schemaReady, state: schema.state, checkedAt: schema.checkedAt }
    }, schemaReady ? undefined : { status: 503 });
  } catch {
    return ok({ ...base, status: "degraded", database: { ok: false }, schema: { ok: false, state: "unavailable" } }, { status: 503 });
  }
}
