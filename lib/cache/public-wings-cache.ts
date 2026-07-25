import { asc, eq } from "drizzle-orm";
import { db, wings } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { inlineMediaSql } from "@/lib/inline-media";
import { cachedJson } from "./public-cache";
import { PUBLIC_CACHE_TAGS, PUBLIC_CACHE_TTL } from "./cache-tags";

async function loadPublicWingsPageData() {
  if (!hasDatabase()) return [];
  return db
    .select({
      id: wings.id,
      name: wings.name,
      slug: wings.slug,
      description: wings.description,
      heroImageUrl: inlineMediaSql("wings", wings.id, "heroImageUrl", wings.heroImageUrl),
      desktopImageUrl: inlineMediaSql("wings", wings.id, "desktopImageUrl", wings.desktopImageUrl),
      mobileImageUrl: inlineMediaSql("wings", wings.id, "mobileImageUrl", wings.mobileImageUrl),
      iconUrl: inlineMediaSql("wings", wings.id, "iconUrl", wings.iconUrl)
    })
    .from(wings)
    .where(eq(wings.isActive, true))
    .orderBy(asc(wings.sortOrder), asc(wings.name));
}

export async function getCachedPublicWingsPageData() {
  return cachedJson({
    key: "public:v1:wings:index",
    tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.wings],
    ttlSeconds: PUBLIC_CACHE_TTL.wings,
    loader: loadPublicWingsPageData
  });
}
