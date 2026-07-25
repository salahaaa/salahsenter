export const dynamic = "force-dynamic";
export const revalidate = 0;

import { and, desc, eq, or, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { fail, handleApiError, ok } from "@/lib/api";
import { cities, countries, db, governorates, stores, users, wings } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { checkIpRateLimit } from "@/lib/rate-limit";
import { cacheRememberJson } from "@/lib/redis/cache";

function normalizeQuery(value: string | null) {
  return (value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function likeTerm(query: string) {
  return `%${query.replace(/[%_]/g, "\\$&")}%`;
}

export async function GET(request: NextRequest) {
  try {
    const query = normalizeQuery(request.nextUrl.searchParams.get("q"));
    const rate = await checkIpRateLimit("search:home", 180, 60 * 1000);
    if (!rate.allowed) return fail("طلبات بحث كثيرة، حاول بعد قليل", 429);
    if (!hasDatabase() || query.length < 2) return ok({ query, wings: [], stores: [] });

    const result = await cacheRememberJson(`search:v1:home:${query.toLowerCase()}`, async () => {
    const term = likeTerm(query);
    const [wingRows, storeRows] = await Promise.all([
      db
        .select({
          id: wings.id,
          title: wings.name,
          slug: wings.slug,
          subtitle: wings.description,
          imageUrl: sql<string | null>`coalesce(${wings.iconUrl}, ${wings.heroImageUrl}, ${wings.desktopImageUrl}, ${wings.mobileImageUrl})`,
          createdAt: wings.createdAt
        })
        .from(wings)
        .where(and(eq(wings.isActive, true), or(sql`${wings.name} ilike ${term}`, sql`${wings.slug} ilike ${term}`, sql`coalesce(${wings.description}, '') ilike ${term}`)))
        .orderBy(desc(wings.createdAt), wings.sortOrder, wings.name)
        .limit(8),
      db
        .select({
          id: stores.id,
          title: stores.name,
          slug: stores.slug,
          imageUrl: sql<string | null>`coalesce(${stores.logoUrl}, ${stores.coverImageUrl})`,
          merchantName: users.fullName,
          countryName: countries.name,
          governorateName: governorates.name,
          cityName: cities.name,
          createdAt: stores.createdAt
        })
        .from(stores)
        .innerJoin(users, eq(stores.merchantId, users.id))
        .leftJoin(countries, eq(stores.countryId, countries.id))
        .leftJoin(governorates, eq(stores.governorateId, governorates.id))
        .leftJoin(cities, eq(stores.cityId, cities.id))
        .where(
          and(
            eq(stores.status, "active"),
            eq(stores.isActive, true),
            or(
              sql`${stores.name} ilike ${term}`,
              sql`${stores.slug} ilike ${term}`,
              sql`${users.fullName} ilike ${term}`,
              sql`coalesce(${stores.description}, '') ilike ${term}`
            )
          )
        )
        .orderBy(desc(stores.createdAt), desc(stores.orderCount), desc(stores.ratingAverage))
        .limit(10)
    ]);

    return {
      query,
      wings: wingRows.map((wing) => ({
        id: wing.id,
        type: "wing" as const,
        title: wing.title,
        subtitle: wing.subtitle,
        href: `/wings/${wing.slug}`,
        imageUrl: wing.imageUrl,
        badge: isRecent(wing.createdAt) ? "جديد" : "جناح"
      })),
      stores: storeRows.map((store) => ({
        id: store.id,
        type: "store" as const,
        title: store.title,
        subtitle: [store.cityName, store.governorateName, store.countryName].filter(Boolean).join(" - ") || "متجر معتمد داخل المول",
        href: `/store/${store.slug}`,
        imageUrl: store.imageUrl,
        badge: isRecent(store.createdAt) ? "جديد" : "متجر",
        merchantName: store.merchantName
      }))
    };
    }, { ttlSeconds: 45, tags: ["search", "search:home"] });
    return ok(result);
  } catch (error) {
    return handleApiError(error, "تعذر تنفيذ البحث السريع");
  }
}

function isRecent(value: Date | string | null, days = 14) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= days * 24 * 60 * 60 * 1000;
}
