export const dynamic = "force-dynamic";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, inventoryMovements, inventoryStockCountLines, inventoryStockCounts, productVariants, variantChangeLogs } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { writeAuditLog } from "@/lib/audit";
import { userHasStoreOperation } from "@/lib/rbac";
import { assertNotGeneratedOfferInventory } from "@/lib/offers/guards";

const patchSchema = z.object({ action: z.enum(["set_lines", "apply"]), lines: z.array(z.object({ id: z.string().uuid(), countedQuantity: z.coerce.number().int().min(0), note: z.string().max(500).optional().nullable() })).optional().default([]) });

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const session = await requireAuth(); const store = await getMerchantPrimaryStore(session.userId);
    if (!store || !hasStoreAccess(session, store.id) || !(await userHasStoreOperation(session.userId, store.id, "inventory.stock_count"))) return fail("لا تملك صلاحية الجرد", 403);
    const [count] = await db.select().from(inventoryStockCounts).where(and(eq(inventoryStockCounts.id, id), eq(inventoryStockCounts.storeId, store.id))).limit(1);
    if (!count) return fail("جلسة الجرد غير موجودة", 404);
    const lines = await db.select({ line: inventoryStockCountLines, sku: productVariants.sku, title: productVariants.title }).from(inventoryStockCountLines).innerJoin(productVariants, eq(inventoryStockCountLines.variantId, productVariants.id)).where(eq(inventoryStockCountLines.stockCountId, count.id)).limit(2_000);
    return ok({ count, lines });
  } catch (error) { return handleApiError(error, "تعذر تحميل تفاصيل الجرد"); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const session = await requireAuth(); const store = await getMerchantPrimaryStore(session.userId);
    if (!store || !hasStoreAccess(session, store.id) || !(await userHasStoreOperation(session.userId, store.id, "inventory.stock_count"))) return fail("لا تملك صلاحية الجرد", 403);
    const payload = patchSchema.parse(await request.json());
    const [count] = await db.select().from(inventoryStockCounts).where(and(eq(inventoryStockCounts.id, id), eq(inventoryStockCounts.storeId, store.id))).limit(1);
    if (!count) return fail("جلسة الجرد غير موجودة", 404);
    if (count.status === "applied") return fail("تم تطبيق هذه الجلسة ولا يمكن تعديلها", 409);
    const result = await db.transaction(async (tx) => {
      if (payload.lines.length) {
        const ids = payload.lines.map((line) => line.id);
        const existing = await tx.select().from(inventoryStockCountLines).where(and(eq(inventoryStockCountLines.stockCountId, count.id), inArray(inventoryStockCountLines.id, ids)));
        if (existing.length !== ids.length) throw new Error("بعض أسطر الجرد غير صحيحة");
        for (const line of payload.lines) await tx.update(inventoryStockCountLines).set({ countedQuantity: line.countedQuantity, differenceQuantity: null, note: line.note || null, updatedAt: new Date() }).where(eq(inventoryStockCountLines.id, line.id));
      }
      if (payload.action === "set_lines") return { applied: false, updatedLines: payload.lines.length };
      const lines = await tx.select().from(inventoryStockCountLines).where(eq(inventoryStockCountLines.stockCountId, count.id));
      if (lines.some((line) => line.countedQuantity === null)) throw new Error("أدخل الكمية المعدودة لكل أسطر الجرد قبل التطبيق");
      for (const line of lines) {
        const [variant] = await tx.select().from(productVariants).where(eq(productVariants.id, line.variantId)).limit(1);
        if (!variant) continue;
        await assertNotGeneratedOfferInventory({ productId: line.productId, variantId: variant.id, tx });
        const counted = Number(line.countedQuantity || 0); const beforeQuantity = variant.stockQuantity;
        if (beforeQuantity === counted) { await tx.update(inventoryStockCountLines).set({ differenceQuantity: 0, updatedAt: new Date() }).where(eq(inventoryStockCountLines.id, line.id)); continue; }
        await tx.update(productVariants).set({ stockQuantity: counted, updatedAt: new Date() }).where(eq(productVariants.id, variant.id));
        await tx.update(inventoryStockCountLines).set({ differenceQuantity: counted - beforeQuantity, updatedAt: new Date() }).where(eq(inventoryStockCountLines.id, line.id));
        await tx.insert(inventoryMovements).values({ storeId: store.id, productId: line.productId, variantId: variant.id, type: "adjust", quantity: Math.abs(counted - beforeQuantity), beforeQuantity, afterQuantity: counted, reason: `stock_count:${count.id}`, actorId: session.userId });
        await tx.insert(variantChangeLogs).values({ variantId: variant.id, productId: line.productId, storeId: store.id, changeType: "stock_count", beforeData: { stockQuantity: beforeQuantity }, afterData: { stockQuantity: counted }, reason: count.title, actorId: session.userId });
      }
      const [applied] = await tx.update(inventoryStockCounts).set({ status: "applied", appliedBy: session.userId, appliedAt: new Date(), updatedAt: new Date() }).where(eq(inventoryStockCounts.id, count.id)).returning();
      return { applied: true, count: applied, updatedLines: lines.length };
    });
    await writeAuditLog({ actorId: session.userId, action: "update", category: "inventory", entityType: "inventory.stock_count", entityId: id, afterData: result });
    return ok({ result, message: result.applied ? "تم تطبيق الجرد وإنشاء حركات ضبط للمخزون" : "تم حفظ كميات الجرد" });
  } catch (error) { return handleApiError(error, "تعذر تحديث جرد المخزون"); }
}
