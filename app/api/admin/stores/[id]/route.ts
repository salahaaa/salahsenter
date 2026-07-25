export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, notifications, stores, storeWings } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";
import { invalidatePrivateApiCacheTags } from "@/lib/cache/private-api-cache";

const ADMIN_STORES_CACHE_TAG = "admin:stores";

const deleteStoreSchema = z.object({ reason: z.string().max(500).optional() });

async function revalidateStorePaths(slug?: string | null) {
  revalidatePath("/admin/stores");
  await invalidatePrivateApiCacheTags([ADMIN_STORES_CACHE_TAG]);
  await invalidatePublicCache({ 
    tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.stores, ...(slug ? [PUBLIC_CACHE_TAGS.storeSlug(slug)] : [])],
    paths: ["/", ...(slug ? [`/store/${slug}`] : [])]
  });
}

const storePatchSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  merchantId: z.string().uuid().optional(),
  primaryWingId: z.string().uuid().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  coverImageUrl: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  status: z.enum(["active", "pending", "suspended", "closed", "frozen"]).optional(),
  isActive: z.boolean().optional(),
  profileCompleteness: z.coerce.number().int().min(0).max(100).optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await requireAuth();
    const payload = storePatchSchema.parse(await request.json());
    const operation = payload.status === "active" ? "stores.activate" : ["suspended", "frozen"].includes(payload.status || "") ? "stores.suspend" : "stores.edit";
    await assertAdminOperation(session, operation);
    const [before] = await db.select().from(stores).where(eq(stores.id, params.id)).limit(1);
    if (!before) return fail("المتجر غير موجود", 404);
    const nameChanged = payload.name !== undefined && payload.name.trim() !== before.name;
    const emailChanged = payload.contactEmail !== undefined && String(payload.contactEmail || "").trim().toLowerCase() !== String(before.contactEmail || "").trim().toLowerCase();
    if (nameChanged || emailChanged) return fail("اسم المتجر والبريد الإلكتروني المعتمد محميان بعقد. استخدم طلب تعديل الهوية وملحق العقد الموقع بدلاً من التعديل المباشر.", 409);

    const [store] = await db.transaction(async (tx) => {
      const [updated] = await tx.update(stores).set({
        name: payload.name ?? before.name,
        description: payload.description === undefined ? before.description : payload.description,
        merchantId: payload.merchantId ?? before.merchantId,
        primaryWingId: payload.primaryWingId === undefined ? before.primaryWingId : payload.primaryWingId,
        contactPhone: payload.contactPhone === undefined ? before.contactPhone : payload.contactPhone,
        contactEmail: payload.contactEmail === undefined ? before.contactEmail : payload.contactEmail || null,
        coverImageUrl: payload.coverImageUrl === undefined ? before.coverImageUrl : payload.coverImageUrl,
        logoUrl: payload.logoUrl === undefined ? before.logoUrl : payload.logoUrl,
        status: payload.status ?? before.status,
        isActive: payload.isActive ?? (payload.status ? payload.status === "active" : before.isActive),
        profileCompleteness: payload.profileCompleteness ?? before.profileCompleteness,
        updatedAt: new Date()
      }).where(eq(stores.id, params.id)).returning();
      if (payload.primaryWingId) await tx.insert(storeWings).values({ storeId: params.id, wingId: payload.primaryWingId }).onConflictDoNothing();
      return [updated];
    });

    await writeAuditLog({ actorId: session.userId, action: "status_change", entityType: "store", entityId: store.id, beforeData: before, afterData: store });
    await revalidateStorePaths(store.slug);
    return ok({ store, message: "تم تحديث المتجر بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث المتجر");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "stores.delete");
    const payload = deleteStoreSchema.parse(await request.json().catch(() => ({})));
    const [before] = await db.select().from(stores).where(eq(stores.id, params.id)).limit(1);
    if (!before) return fail("المتجر غير موجود", 404);
    const [store] = await db
      .update(stores)
      .set({ status: "closed", isActive: false, updatedAt: new Date() })
      .where(eq(stores.id, params.id))
      .returning();

    await db.insert(notifications).values({
      userId: before.merchantId,
      storeId: before.id,
      title: "تم إغلاق المتجر من الإدارة",
      body: payload.reason ? `تم إغلاق المتجر بسبب: ${payload.reason}` : "تم إغلاق المتجر من الإدارة. تواصل مع الإدارة إذا كنت تحتاج مراجعة القرار.",
      type: "admin_store_closed",
      data: { storeId: before.id, reason: payload.reason || null, url: "/merchant" }
    });

    await writeAuditLog({ actorId: session.userId, action: "delete", entityType: "store", entityId: before.id, beforeData: before, afterData: { store, reason: payload.reason || null } });
    await revalidateStorePaths(before.slug);
    return ok({ store, message: "تم إغلاق المتجر وإخفاؤه عن المتسوقين بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر إغلاق المتجر");
  }
}
