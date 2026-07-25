export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, inventoryMovements, inventoryTransferLines, inventoryTransfers, productVariants, variantChangeLogs } from "@/lib/db";
import { userHasStoreOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { assertNotGeneratedOfferInventory } from "@/lib/offers/guards";

const schema = z.object({ action: z.enum(["send", "receive", "cancel"]), receivedQuantities: z.record(z.coerce.number().int().min(0)).optional().default({}) });

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const session = await requireAuth();
    const [transfer] = await db.select().from(inventoryTransfers).where(eq(inventoryTransfers.id, id)).limit(1);
    if (!transfer) return fail("تحويل المخزون غير موجود", 404);
    if (!hasStoreAccess(session, transfer.sourceStoreId) && !hasStoreAccess(session, transfer.destinationStoreId)) return fail("لا تملك صلاحية هذا التحويل", 403);
    const lines = await db.select().from(inventoryTransferLines).where(eq(inventoryTransferLines.transferId, id));
    return ok({ transfer, lines });
  } catch (error) { return handleApiError(error, "تعذر تحميل تحويل المخزون"); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const session = await requireAuth(); const payload = schema.parse(await request.json());
    const [before] = await db.select().from(inventoryTransfers).where(eq(inventoryTransfers.id, id)).limit(1);
    if (!before) return fail("تحويل المخزون غير موجود", 404);
    const actingStoreId = payload.action === "receive" ? before.destinationStoreId : before.sourceStoreId;
    if (!hasStoreAccess(session, actingStoreId) || !(await userHasStoreOperation(session.userId, actingStoreId, "inventory.manage"))) return fail("لا تملك صلاحية تنفيذ هذا التحويل", 403);
    if (payload.action === "send" && before.status !== "draft") return fail("يمكن إرسال التحويل من حالة مسودة فقط", 409);
    if (payload.action === "receive" && before.status !== "sent") return fail("يمكن استلام التحويل المرسل فقط", 409);
    if (payload.action === "cancel" && !["draft", "sent"].includes(before.status)) return fail("لا يمكن إلغاء هذا التحويل", 409);

    const result = await db.transaction(async (tx) => {
      const lines = await tx.select().from(inventoryTransferLines).where(eq(inventoryTransferLines.transferId, id));
      if (payload.action === "send") {
        for (const line of lines) {
          const [variant] = await tx.select().from(productVariants).where(eq(productVariants.id, line.sourceVariantId)).limit(1);
          if (!variant || variant.stockQuantity - variant.reservedQuantity < line.quantity) throw new Error("المخزون لم يعد كافياً لإرسال التحويل");
          await assertNotGeneratedOfferInventory({ productId: line.sourceProductId, variantId: variant.id, tx });
          const afterQuantity = variant.stockQuantity - line.quantity;
          await tx.update(productVariants).set({ stockQuantity: afterQuantity, updatedAt: new Date() }).where(eq(productVariants.id, variant.id));
          await tx.insert(inventoryMovements).values({ storeId: before.sourceStoreId, productId: line.sourceProductId, variantId: variant.id, type: "deduct", quantity: line.quantity, beforeQuantity: variant.stockQuantity, afterQuantity, reason: `transfer:${before.referenceNumber}`, referenceType: "inventory_transfer", referenceId: before.id, actorId: session.userId });
          await tx.insert(variantChangeLogs).values({ variantId: variant.id, productId: line.sourceProductId, storeId: before.sourceStoreId, changeType: "transfer_sent", beforeData: { stockQuantity: variant.stockQuantity }, afterData: { stockQuantity: afterQuantity }, reason: before.referenceNumber, actorId: session.userId });
        }
        const [transfer] = await tx.update(inventoryTransfers).set({ status: "sent", sentAt: new Date(), updatedAt: new Date() }).where(eq(inventoryTransfers.id, id)).returning();
        return { transfer, lines };
      }
      if (payload.action === "receive") {
        for (const line of lines) {
          if (!line.destinationVariantId || !line.destinationProductId) throw new Error("لم يتم ربط متغير الفرع المستلم");
          const receivedQuantity = payload.receivedQuantities[line.id] ?? line.quantity;
          if (receivedQuantity > line.quantity) throw new Error("لا يمكن استلام كمية أكبر من المرسلة");
          const [variant] = await tx.select().from(productVariants).where(eq(productVariants.id, line.destinationVariantId)).limit(1);
          if (!variant) throw new Error("متغير الفرع المستلم غير موجود");
          await assertNotGeneratedOfferInventory({ productId: line.destinationProductId, variantId: variant.id, tx });
          const afterQuantity = variant.stockQuantity + receivedQuantity;
          await tx.update(productVariants).set({ stockQuantity: afterQuantity, updatedAt: new Date() }).where(eq(productVariants.id, variant.id));
          await tx.update(inventoryTransferLines).set({ receivedQuantity }).where(eq(inventoryTransferLines.id, line.id));
          await tx.insert(inventoryMovements).values({ storeId: before.destinationStoreId, productId: line.destinationProductId, variantId: variant.id, type: "add", quantity: receivedQuantity, beforeQuantity: variant.stockQuantity, afterQuantity, reason: `transfer:${before.referenceNumber}`, referenceType: "inventory_transfer", referenceId: before.id, actorId: session.userId });
          await tx.insert(variantChangeLogs).values({ variantId: variant.id, productId: line.destinationProductId, storeId: before.destinationStoreId, changeType: "transfer_received", beforeData: { stockQuantity: variant.stockQuantity }, afterData: { stockQuantity: afterQuantity }, reason: before.referenceNumber, actorId: session.userId });
        }
        const [transfer] = await tx.update(inventoryTransfers).set({ status: "received", receivedBy: session.userId, receivedAt: new Date(), updatedAt: new Date() }).where(eq(inventoryTransfers.id, id)).returning();
        return { transfer, lines };
      }
      // Cancellation after send is intentionally not automatic: a sent transfer is an auditable physical event.
      if (before.status === "sent") throw new Error("لا يمكن إلغاء تحويل أُرسل فعلياً؛ استلمه ثم أنشئ تحويل عكسي");
      const [transfer] = await tx.update(inventoryTransfers).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(inventoryTransfers.id, id), eq(inventoryTransfers.status, "draft"))).returning();
      return { transfer, lines };
    });
    await writeAuditLog({ actorId: session.userId, action: "update", category: "inventory", entityType: "inventory.transfer", entityId: id, beforeData: before, afterData: { ...result, action: payload.action } });
    return ok({ ...result, message: payload.action === "send" ? "تم إرسال التحويل وخصم المخزون من الفرع المصدر" : payload.action === "receive" ? "تم استلام التحويل وإضافة المخزون للفرع" : "تم إلغاء مسودة التحويل" });
  } catch (error) { return handleApiError(error, "تعذر تنفيذ تحويل المخزون"); }
}
