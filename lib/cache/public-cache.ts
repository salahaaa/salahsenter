import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { cacheDeleteByTags, cacheRememberJson } from "@/lib/redis/cache";

export async function cachedJson<T>(input: {
  key: string;
  tags: string[];
  ttlSeconds: number;
  loader: () => Promise<T>;
}): Promise<T> {
  return unstable_cache(
    async () =>
      cacheRememberJson(input.key, input.loader, {
        ttlSeconds: input.ttlSeconds,
        tags: input.tags
      }),
    [input.key],
    { revalidate: input.ttlSeconds, tags: input.tags }
  )();
}

export async function invalidatePublicCache(input: { tags?: string[]; paths?: string[] }) {
  const tags = [...new Set(input.tags || [])];
  const paths = [...new Set(input.paths || [])];

  for (const tag of tags) revalidateTag(tag);
  for (const path of paths) revalidatePath(path);
  await cacheDeleteByTags(tags);
}
