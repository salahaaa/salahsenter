import { and, eq, isNull, sql } from "drizzle-orm";
import { categories, products } from "@/lib/db/schema";
import type { db as database } from "@/lib/db";

type Tx = typeof database | any;

export async function generateCategoryCode(tx: Tx, storeId: string, parentId?: string | null) {
  if (!parentId) {
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(categories)
      .where(and(eq(categories.storeId, storeId), isNull(categories.parentId)));
    return String((Number(count) + 1) * 1000);
  }

  const [parent] = await tx.select().from(categories).where(eq(categories.id, parentId)).limit(1);
  if (!parent?.code) return generateCategoryCode(tx, storeId, null);

  const [{ count }] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(categories)
    .where(and(eq(categories.storeId, storeId), eq(categories.parentId, parentId)));

  const sequence = Number(count) + 1;
  if (parent.code.length <= 4) return String(Number(parent.code) + sequence);
  return `${parent.code}${String(sequence).padStart(2, "0")}`;
}

export async function generateProductCode(tx: Tx, storeId: string, categoryId?: string | null) {
  const [category] = categoryId ? await tx.select().from(categories).where(eq(categories.id, categoryId)).limit(1) : [];
  const prefix = category?.code || "P";
  const [{ count }] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(and(eq(products.storeId, storeId), categoryId ? eq(products.categoryId, categoryId) : sql`true`));
  return `${prefix}${String(Number(count) + 1).padStart(3, "0")}`;
}

export function buildVariantTitle(attributes: Record<string, string>, fallback = "افتراضي") {
  const parts = Object.values(attributes).filter(Boolean);
  return parts.length ? parts.join(" / ") : fallback;
}
