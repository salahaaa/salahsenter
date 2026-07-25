export const dynamic = "force-dynamic";

import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { optionalUrlOrPathSchema, requiredUrlOrPathSchema } from "@/lib/validators";
import { ApiError, created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, news } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { writeAuditLog } from "@/lib/audit";
import { isStoreOperational } from "@/lib/store-guards";
import { getAdvertisingSettings } from "@/lib/advertising-settings";
import { Permission, userHasStorePermission } from "@/lib/rbac";
import { assertRentalLimit, lockRentalEntitlement } from "@/lib/rentals/service";

const storeNewsSchema = z.object({
  storeId: z.string().uuid().optional().nullable(),
  title: z.string().min(2),
  body: z.string().optional(),
  linkUrl: optionalUrlOrPathSchema,
  isTicker: z.boolean().default(true),
  isPinned: z.boolean().default(false),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  status: z.enum(["draft", "scheduled", "active", "expired", "disabled"]).default("draft")
});

export async function GET() {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return ok({ news: [] });
    const items = await db.select().from(news).where(and(eq(news.level, "store"), eq(news.storeId, store.id))).orderBy(desc(news.createdAt)).limit(100);
    return ok({ news: items });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل أخبار المتجر");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = storeNewsSchema.parse(await request.json());
    const primaryStore = await getMerchantPrimaryStore(session.userId);
    const storeId = payload.storeId || primaryStore?.id;
    if (!storeId) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, storeId)) return fail("لا تملك صلاحية إدارة هذا المتجر", 403);
    if (!(await userHasStorePermission(session.userId, storeId, Permission.ManageNews))) return fail("لا تملك صلاحية أخبار المتجر", 403);
    if (!(await isStoreOperational(storeId))) return fail("المتجر مجمد أو غير مفعل؛ لا يمكن تنفيذ عمليات تشغيلية حتى إعادة فتحه من الأدمن", 403);

    const adSettings = await getAdvertisingSettings();
    const [item] = await db.transaction(async (tx) => {
      await lockRentalEntitlement(storeId, tx);
      if (payload.status === "active" && payload.isTicker) {
        const [{ count }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(news)
          .where(and(eq(news.storeId, storeId), eq(news.level, "store"), eq(news.status, "active"), eq(news.isTicker, true)));
        await assertRentalLimit({ storeId, resource: "news", currentCount: count, tx });
        if (count >= adSettings.maxActiveStoreNews) {
          throw new ApiError(`تم الوصول للحد الأقصى للأخبار المتحركة النشطة لهذا المتجر (${adSettings.maxActiveStoreNews})`, 409);
        }
      }

      return tx
        .insert(news)
        .values({
          level: "store",
          storeId,
          title: payload.title,
          body: payload.body,
          linkUrl: payload.linkUrl || null,
          isTicker: payload.isTicker,
          isPinned: payload.isPinned,
          startAt: payload.startAt ? new Date(payload.startAt) : null,
          endAt: payload.endAt ? new Date(payload.endAt) : null,
          status: payload.status,
          createdBy: session.userId
        })
        .returning();
    });

    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "store_news", entityId: item.id, afterData: item });
    return created({ news: item, message: "تم حفظ خبر المتجر بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ خبر المتجر");
  }
}
