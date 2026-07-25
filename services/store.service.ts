/**
 * Store Service
 * =============
 * Store reads + admin management. Merchant-facing store resolution goes
 * through `requireStoreAccess` so a merchant can never act on another's store.
 */

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, stores } from "@/lib/db";
import { inlineMediaSql } from "@/lib/inline-media";
import { parseListQuery } from "@/lib/api-list-utils";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { hasRole, type SessionPayload } from "@/lib/auth";

export interface StoreListItem {
  id: string;
  name: string;
  slug: string;
  storeNumber: string;
  status: string;
  isActive: boolean;
  primaryWingId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  ratingAverage: string | null;
  orderCount: number | null;
  salesTotal: string | null;
  profileCompleteness: number | null;
  coverImageUrl: string | null;
  logoUrl: string | null;
  createdAt: Date;
}

export async function listStoresAdmin(
  request: Request,
  opts: { q?: string; status?: string } = {}
) {
  const { page, pageSize, offset, q } = parseListQuery(request, { defaultPageSize: 20 });
  const conditions: SQL[] = [];
  const term = opts.q ?? q;
  if (term) {
    const pattern = `%${term}%`;
    conditions.push(or(ilike(stores.name, pattern), ilike(stores.storeNumber, pattern), ilike(stores.slug, pattern), ilike(stores.contactEmail, pattern), ilike(stores.contactPhone, pattern))!);
  }
  const status = opts.status ?? new URL(request.url).searchParams.get("status");
  if (status) conditions.push(eq(stores.status, status as any));
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ count: totalCount }]] = await Promise.all([
    db
      .select({
        id: stores.id,
        name: stores.name,
        slug: stores.slug,
        storeNumber: stores.storeNumber,
        status: stores.status,
        isActive: stores.isActive,
        primaryWingId: stores.primaryWingId,
        contactEmail: stores.contactEmail,
        contactPhone: stores.contactPhone,
        ratingAverage: stores.ratingAverage,
        orderCount: stores.orderCount,
        salesTotal: stores.salesTotal,
        profileCompleteness: stores.profileCompleteness,
        coverImageUrl: inlineMediaSql("stores", stores.id, "coverImageUrl", stores.coverImageUrl),
        logoUrl: inlineMediaSql("stores", stores.id, "logoUrl", stores.logoUrl),
        createdAt: stores.createdAt
      })
      .from(stores)
      .where(where ?? sql`true`)
      .orderBy(desc(stores.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(stores).where(where ?? sql`true`)
  ]);

  return { items: rows as StoreListItem[], page, pageSize, totalCount, hasNext: offset + rows.length < totalCount };
}

/** Resolve the caller's primary store id, or null when they have none. */
export async function resolveMyStore(session: SessionPayload): Promise<string | null> {
  const store = await getMerchantPrimaryStore(session.userId);
  return store?.id ?? null;
}

/** Boolean guard reused by UI: can this session act on this store? */
export function canAccessStore(session: SessionPayload | null, storeId: string): boolean {
  if (!session) return false;
  return hasRole(session, "super_admin") || session.roles.some((r) => r.storeId === storeId);
}
