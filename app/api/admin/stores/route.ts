export const dynamic = "force-dynamic";

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hashPassword, requireAuth } from "@/lib/auth";
import { db, merchants, roles, stores, storeWings, userRoles, users } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { uniqueSlug } from "@/lib/slug";
import { inlineMediaFlagSql, nonInlineMediaSql } from "@/lib/inline-media";
import { parseListQuery } from "@/lib/api-list-utils";
import { writeAuditLog } from "@/lib/audit";
import { apiCacheKey, cacheHeader, getCachedPrivateApi, invalidatePrivateApiCacheTags } from "@/lib/cache/private-api-cache";

const ADMIN_STORES_CACHE_TAG = "admin:stores";

const createStoreSchema = z.object({
  merchantEmail: z.string().email(),
  merchantName: z.string().min(2),
  merchantPhone: z.string().optional(),
  storeName: z.string().min(2),
  description: z.string().optional(),
  primaryWingId: z.string().uuid().optional().nullable(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  coverImageUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  status: z.enum(["active", "pending", "suspended", "closed", "frozen"]).default("active")
});

async function generateStoreNumber() {
  for (let i = 0; i < 10; i++) {
    const candidate = `SLH-${nanoid(6).toUpperCase()}`;
    const exists = await db.select({ id: stores.id }).from(stores).where(eq(stores.storeNumber, candidate)).limit(1);
    if (!exists.length) return candidate;
  }
  throw new Error("تعذر توليد رقم متجر فريد");
}

async function generateMerchantNumber() {
  for (let i = 0; i < 10; i++) {
    const candidate = `MER-${nanoid(8).toUpperCase()}`;
    const exists = await db.select({ id: merchants.id }).from(merchants).where(eq(merchants.merchantNumber, candidate)).limit(1);
    if (!exists.length) return candidate;
  }
  throw new Error("تعذر توليد رقم تاجر فريد");
}

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "stores.view");
    const { page, pageSize, offset, q } = parseListQuery(request, { defaultPageSize: 20 });

    const conditions: SQL[] = [];
    if (q) {
      const term = `%${q}%`;
      conditions.push(or(ilike(stores.name, term), ilike(stores.storeNumber, term), ilike(stores.slug, term), ilike(stores.contactEmail, term), ilike(stores.contactPhone, term))!);
    }
    const status = new URL(request.url).searchParams.get("status") || "";
    if (status) conditions.push(eq(stores.status, status as any));
    const where = conditions.length ? and(...conditions) : undefined;

    const cached = await getCachedPrivateApi(
      apiCacheKey(["admin:stores", session.userId, page, pageSize, q, status]),
      async () => {
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
              coverImageUrl: nonInlineMediaSql(stores.coverImageUrl),
              hasInlineCoverImage: inlineMediaFlagSql(stores.coverImageUrl),
              logoUrl: nonInlineMediaSql(stores.logoUrl),
              hasInlineLogoImage: inlineMediaFlagSql(stores.logoUrl),
              createdAt: stores.createdAt
            })
            .from(stores)
            .where(where ? (where as any) : sql`true`)
            .orderBy(desc(stores.createdAt))
            .limit(pageSize)
            .offset(offset),
          db.select({ count: sql<number>`count(*)::int` }).from(stores).where(where ? (where as any) : sql`true`)
        ]);

        return { stores: rows, page, pageSize, totalCount, hasNext: offset + rows.length < totalCount, totalPages: Math.ceil(totalCount / pageSize) || 0 };
      },
      { ttlSeconds: 20, tags: [ADMIN_STORES_CACHE_TAG], encrypted: true }
    );
    const response = ok(cached.value);
    response.headers.set("x-redis-cache", cacheHeader(cached.hit));
    return response;
  } catch (error) {
    return handleApiError(error, "تعذر تحميل المتاجر");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "stores.approve");
    const payload = createStoreSchema.parse(await request.json());
    const [merchantRole] = await db.select().from(roles).where(eq(roles.code, "merchant")).limit(1);
    if (!merchantRole) return fail("دور التاجر غير موجود؛ شغّل db:seed", 500);

    const result = await db.transaction(async (tx) => {
      let [merchantUser] = await tx.select().from(users).where(eq(users.email, payload.merchantEmail.toLowerCase())).limit(1);
      const temporaryPassword = `Store-${nanoid(12)}!`;
      if (!merchantUser) {
        [merchantUser] = await tx.insert(users).values({
          fullName: payload.merchantName,
          email: payload.merchantEmail.toLowerCase(),
          phone: payload.merchantPhone,
          passwordHash: await hashPassword(temporaryPassword),
          mustChangePassword: true,
          status: "active",
          emailVerifiedAt: new Date()
        }).returning();
      }
      let [merchantProfile] = await tx.select().from(merchants).where(eq(merchants.userId, merchantUser.id)).limit(1);
      if (!merchantProfile) {
        [merchantProfile] = await tx.insert(merchants).values({ userId: merchantUser.id, merchantNumber: await generateMerchantNumber(), status: "active", activatedAt: new Date() }).returning();
      }
      const [store] = await tx.insert(stores).values({
        merchantId: merchantUser.id,
        merchantProfileId: merchantProfile.id,
        storeNumber: await generateStoreNumber(),
        name: payload.storeName,
        slug: uniqueSlug(payload.storeName),
        description: payload.description,
        primaryWingId: payload.primaryWingId || null,
        contactEmail: payload.contactEmail || payload.merchantEmail,
        contactPhone: payload.contactPhone || payload.merchantPhone,
        coverImageUrl: payload.coverImageUrl || null,
        logoUrl: payload.logoUrl || null,
        status: payload.status,
        isActive: payload.status === "active"
      }).returning();
      if (payload.primaryWingId) await tx.insert(storeWings).values({ storeId: store.id, wingId: payload.primaryWingId }).onConflictDoNothing();
      await tx.insert(userRoles).values({ userId: merchantUser.id, roleId: merchantRole.id, storeId: store.id }).onConflictDoNothing();
      return { store, merchant: merchantUser, merchantProfile, temporaryPassword: merchantUser.lastLoginAt ? null : temporaryPassword };
    });

    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "store", entityId: result.store.id, afterData: result });
    await invalidatePrivateApiCacheTags([ADMIN_STORES_CACHE_TAG]);
    return created({ ...result, message: "تم إنشاء المتجر وربطه بالتاجر" });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء المتجر");
  }
}
