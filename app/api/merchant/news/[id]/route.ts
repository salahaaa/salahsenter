export const dynamic = "force-dynamic";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ApiError, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, news } from "@/lib/db";
import { optionalUrlOrPathSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";
import { Permission, userHasStorePermission } from "@/lib/rbac";
import { getAdvertisingSettings } from "@/lib/advertising-settings";
import { assertRentalLimit, lockRentalEntitlement } from "@/lib/rentals/service";

const schema = z.object({ title: z.string().min(2).optional(), body: z.string().optional(), linkUrl: optionalUrlOrPathSchema, isTicker: z.boolean().optional(), isPinned: z.boolean().optional(), status: z.enum(["draft", "scheduled", "active", "expired", "disabled"]).optional(), startAt: z.string().datetime().optional().nullable(), endAt: z.string().datetime().optional().nullable() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const [before] = await db.select().from(news).where(and(eq(news.id, id), eq(news.level, "store"))).limit(1);
    if (!before || !before.storeId) return fail("الخبر غير موجود", 404);
    if (!hasStoreAccess(session, before.storeId)) return fail("لا تملك صلاحية تعديل هذا الخبر", 403);
    if (!(await userHasStorePermission(session.userId, before.storeId, Permission.ManageNews))) return fail("لا تملك صلاحية أخبار المتجر", 403);
    const nextStatus = payload.status ?? before.status;
    const nextTicker = payload.isTicker ?? before.isTicker;
    const becomesActiveTicker = !(before.status === "active" && before.isTicker) && nextStatus === "active" && nextTicker;
    const adSettings = await getAdvertisingSettings();
    const [item] = await db.transaction(async (tx) => {
      await lockRentalEntitlement(before.storeId!, tx);
      if (becomesActiveTicker) {
        const [{ count }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(news)
          .where(and(eq(news.storeId, before.storeId!), eq(news.level, "store"), eq(news.status, "active"), eq(news.isTicker, true)));
        await assertRentalLimit({ storeId: before.storeId!, resource: "news", currentCount: count, tx });
        if (count >= adSettings.maxActiveStoreNews) {
          throw new ApiError(`تم الوصول للحد الأقصى للأخبار المتحركة النشطة لهذا المتجر (${adSettings.maxActiveStoreNews})`, 409);
        }
      }
      return tx.update(news).set({ ...payload, linkUrl: payload.linkUrl || undefined, startAt: payload.startAt ? new Date(payload.startAt) : undefined, endAt: payload.endAt ? new Date(payload.endAt) : undefined, updatedAt: new Date() }).where(eq(news.id, id)).returning();
    });
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "store_news", entityId: id, beforeData: before, afterData: item });
    return ok({ news: item, message: "تم تعديل خبر المتجر" });
  } catch (error) { return handleApiError(error, "تعذر تعديل خبر المتجر"); }
}
