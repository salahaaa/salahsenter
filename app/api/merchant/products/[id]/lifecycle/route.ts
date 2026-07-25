export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db, products } from "@/lib/db";
import { transitionProductLifecycle } from "@/lib/products/lifecycle";
import { userHasStoreOperation } from "@/lib/rbac";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

const schema = z.object({ action: z.enum(["submit_review", "pause", "resume", "archive", "schedule_publish", "schedule_pause"]), reason: z.string().max(1_000).optional().nullable(), publishAt: z.string().datetime().optional().nullable(), unpublishAt: z.string().datetime().optional().nullable() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) return fail("المنتج غير موجود", 404);
    if (!hasStoreAccess(session, product.storeId) || !(await userHasStoreOperation(session.userId, product.storeId, "products.lifecycle"))) return fail("لا تملك صلاحية إدارة المنتج", 403);
    const result = await transitionProductLifecycle({ productId: id, storeId: product.storeId, actorId: session.userId, action: payload.action, reason: payload.reason, publishAt: payload.publishAt ? new Date(payload.publishAt) : null, unpublishAt: payload.unpublishAt ? new Date(payload.unpublishAt) : null });
    await writeAuditLog({ actorId: session.userId, action: "status_change", category: "administrative", entityType: "product.lifecycle", entityId: id, beforeData: result.before, afterData: result });
    await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.products], paths: [] }).catch(() => undefined);
    return ok({ ...result, message: "تم تحديث دورة حياة المنتج" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث دورة حياة المنتج");
  }
}
