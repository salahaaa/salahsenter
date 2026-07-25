export const dynamic = "force-dynamic";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, notifications, products, stores } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  reason: z.string().min(3).max(500),
  severity: z.enum(["low", "medium", "high"]).default("medium"),
  action: z.enum(["takedown", "archive"]).default("takedown")
});

const ratingPenalty = { low: 0.05, medium: 0.15, high: 0.3 } as const;
const completenessPenalty = { low: 3, medium: 8, high: 15 } as const;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdminOperation(session, "platform_products.delete");
    const payload = schema.parse(await request.json());

    const [row] = await db
      .select({ product: products, store: stores })
      .from(products)
      .innerJoin(stores, eq(products.storeId, stores.id))
      .where(eq(products.id, id))
      .limit(1);

    if (!row) return fail("المنتج غير موجود", 404);

    const nextStatus = payload.action === "archive" ? "archived" : "inactive";
    const result = await db.transaction(async (tx) => {
      const [product] = await tx
        .update(products)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();

      const [store] = await tx
        .update(stores)
        .set({
          ratingAverage: sql`greatest(0, (${stores.ratingAverage})::numeric - ${ratingPenalty[payload.severity]})::numeric(3,2)`,
          profileCompleteness: sql`greatest(0, ${stores.profileCompleteness} - ${completenessPenalty[payload.severity]})`,
          updatedAt: new Date()
        })
        .where(eq(stores.id, row.store.id))
        .returning({ id: stores.id, name: stores.name, merchantId: stores.merchantId, ratingAverage: stores.ratingAverage, profileCompleteness: stores.profileCompleteness });

      await tx.insert(notifications).values({
        userId: row.store.merchantId,
        storeId: row.store.id,
        title: "إنذار إداري على منتج مخالف",
        body: `تم إيقاف المنتج (${row.product.name}) بسبب: ${payload.reason}. يؤثر هذا الإنذار على تقييم/جودة المتجر حتى تتم مراجعة البيانات.`,
        type: "store_policy_warning",
        data: { productId: id, productName: row.product.name, reason: payload.reason, severity: payload.severity, url: `/merchant/products/${id}/edit` }
      });

      return { product, store };
    });

    await writeAuditLog({
      actorId: session.userId,
      action: "delete",
      entityType: "product_moderation",
      entityId: id,
      beforeData: row,
      afterData: { ...result, reason: payload.reason, severity: payload.severity, action: payload.action }
    });

    return ok({ result, message: "تم إيقاف المنتج وإرسال إنذار للمتجر بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر تنفيذ إجراء المراقبة على المنتج");
  }
}
