export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db, productLifecycleEvents, products } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { getProductQuality } from "@/lib/products/lifecycle";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

const schema = z.object({ action: z.enum(["approve", "reject", "pause", "archive"]), reason: z.string().min(3).max(1_000).optional() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdminOperation(session, "platform_products.edit");
    const payload = schema.parse(await request.json());
    const [before] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!before) return fail("المنتج غير موجود", 404);
    const quality = await getProductQuality(id);
    if (payload.action === "approve" && !quality.ready) return fail(`لا يمكن اعتماد المنتج؛ جودة الكتالوج ${quality.score}% تحتاج استكمال العناصر الأساسية`, 409, { quality });
    if (payload.action === "reject" && !payload.reason) return fail("سبب الرفض مطلوب", 422);
    const status = payload.action === "approve" ? "active" : payload.action === "reject" ? "paused" : payload.action === "pause" ? "paused" : "archived";
    const [product] = await db.update(products).set({ status, reviewNote: payload.reason || null, reviewedBy: session.userId, reviewedAt: new Date(), publishAt: status === "active" ? null : before.publishAt, updatedAt: new Date() }).where(eq(products.id, id)).returning();
    await db.insert(productLifecycleEvents).values({ productId: before.id, storeId: before.storeId, fromStatus: before.status, toStatus: status, reason: payload.reason || null, actorId: session.userId, metadata: { action: payload.action, qualityScore: quality.score } });
    await writeAuditLog({ actorId: session.userId, action: "approve", category: "administrative", entityType: "product.lifecycle_admin", entityId: id, beforeData: before, afterData: { product, quality, action: payload.action } });
    await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.products], paths: [] });
    return ok({ product, quality, message: "تم تحديث قرار مراجعة المنتج" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث مراجعة المنتج");
  }
}
