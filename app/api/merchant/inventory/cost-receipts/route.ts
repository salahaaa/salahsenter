export const dynamic = "force-dynamic";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, inventoryBatches, inventoryCostReceipts, inventoryMovements, productSuppliers, productVariants, products, suppliers, variantChangeLogs } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { assertStoreCapability, calculateWeightedAverageCost } from "@/lib/products/advanced-inventory";
import { userHasStoreOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { assertNotGeneratedOfferInventory } from "@/lib/offers/guards";

const schema = z.object({
  storeId: z.string().uuid().optional(),
  variantId: z.string().uuid(),
  supplierId: z.string().uuid().optional().nullable(),
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().min(0),
  referenceNumber: z.string().trim().max(140).optional().nullable(),
  note: z.string().trim().max(2_000).optional().nullable(),
  batchNumber: z.string().trim().max(140).optional().nullable(),
  expiryDate: z.string().datetime().optional().nullable()
});

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const requested = new URL(request.url).searchParams.get("storeId");
    const store = requested ? { id: requested } : await getMerchantPrimaryStore(session.userId);
    if (!store || !hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية هذا المتجر", 403);
    if (!(await userHasStoreOperation(session.userId, store.id, "inventory.view"))) return fail("لا تملك صلاحية عرض تكلفة المخزون", 403);
    const receipts = await db.select({ receipt: inventoryCostReceipts, supplierName: suppliers.name, variantSku: productVariants.sku, variantTitle: productVariants.title, productName: products.name })
      .from(inventoryCostReceipts)
      .innerJoin(productVariants, eq(inventoryCostReceipts.variantId, productVariants.id))
      .innerJoin(products, eq(inventoryCostReceipts.productId, products.id))
      .leftJoin(suppliers, eq(inventoryCostReceipts.supplierId, suppliers.id))
      .where(eq(inventoryCostReceipts.storeId, store.id)).orderBy(desc(inventoryCostReceipts.receivedAt)).limit(100);
    return ok({ receipts });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل إيصالات التكلفة");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const storeId = payload.storeId || (await getMerchantPrimaryStore(session.userId))?.id;
    if (!storeId || !hasStoreAccess(session, storeId)) return fail("لا تملك صلاحية هذا المتجر", 403);
    if (!(await userHasStoreOperation(session.userId, storeId, "inventory.manage"))) return fail("لا تملك صلاحية استلام المخزون", 403);
    if (payload.batchNumber || payload.expiryDate) await assertStoreCapability(storeId, "inventory_batches");

    const result = await db.transaction(async (tx) => {
      const [variantRow] = await tx.select({ variant: productVariants, product: products }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).where(and(eq(productVariants.id, payload.variantId), eq(products.storeId, storeId))).limit(1);
      if (!variantRow) throw new Error("المتغير غير موجود أو لا يتبع هذا المتجر");
      await assertNotGeneratedOfferInventory({ productId: variantRow.product.id, variantId: variantRow.variant.id, tx });
      if (payload.supplierId) {
        const [supplier] = await tx.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, payload.supplierId), eq(suppliers.storeId, storeId), eq(suppliers.status, "active"))).limit(1);
        if (!supplier) throw new Error("المورد غير صالح أو لا يتبع المتجر");
      }
      const previousQuantity = variantRow.variant.stockQuantity;
      const previousAverageCost = Number(variantRow.variant.averageCost || 0);
      const resultingAverageCost = calculateWeightedAverageCost({ previousQuantity, previousAverageCost, receivedQuantity: payload.quantity, unitCost: payload.unitCost });
      const [receipt] = await tx.insert(inventoryCostReceipts).values({
        storeId, productId: variantRow.product.id, variantId: variantRow.variant.id, supplierId: payload.supplierId || null,
        quantity: payload.quantity, unitCost: payload.unitCost.toString(), previousQuantity, previousAverageCost: previousAverageCost.toString(), resultingAverageCost: resultingAverageCost.toString(),
        referenceNumber: payload.referenceNumber || null, note: payload.note || null, receivedBy: session.userId
      }).returning();
      const [variant] = await tx.update(productVariants).set({ stockQuantity: previousQuantity + payload.quantity, lastCost: payload.unitCost.toString(), averageCost: resultingAverageCost.toString(), updatedAt: new Date() }).where(eq(productVariants.id, variantRow.variant.id)).returning();
      await tx.insert(inventoryMovements).values({ storeId, productId: variantRow.product.id, variantId: variant.id, type: "add", quantity: payload.quantity, beforeQuantity: previousQuantity, afterQuantity: variant.stockQuantity, reason: payload.note || "استلام مخزون بتكلفة", referenceType: "inventory_cost_receipt", referenceId: receipt.id, actorId: session.userId });
      await tx.insert(variantChangeLogs).values({ variantId: variant.id, productId: variantRow.product.id, storeId, changeType: "cost_receipt", beforeData: { stockQuantity: previousQuantity, averageCost: previousAverageCost }, afterData: { stockQuantity: variant.stockQuantity, averageCost: resultingAverageCost, lastCost: payload.unitCost }, reason: payload.referenceNumber || payload.note || null, actorId: session.userId });
      if (payload.supplierId) {
        const [supplierLink] = await tx.select({ id: productSuppliers.id }).from(productSuppliers).where(and(eq(productSuppliers.supplierId, payload.supplierId), eq(productSuppliers.productId, variantRow.product.id), eq(productSuppliers.variantId, variant.id))).limit(1);
        if (supplierLink) await tx.update(productSuppliers).set({ purchaseCost: payload.unitCost.toString(), updatedAt: new Date() }).where(eq(productSuppliers.id, supplierLink.id));
        else await tx.insert(productSuppliers).values({ storeId, productId: variantRow.product.id, variantId: variant.id, supplierId: payload.supplierId, purchaseCost: payload.unitCost.toString(), isPreferred: false });
      }
      let batch = null;
      if (payload.batchNumber) {
        const [existingBatch] = await tx.select().from(inventoryBatches).where(and(eq(inventoryBatches.storeId, storeId), eq(inventoryBatches.variantId, variant.id), eq(inventoryBatches.batchNumber, payload.batchNumber))).limit(1);
        if (existingBatch) {
          [batch] = await tx.update(inventoryBatches).set({ receivedQuantity: existingBatch.receivedQuantity + payload.quantity, availableQuantity: existingBatch.availableQuantity + payload.quantity, unitCost: payload.unitCost.toString(), expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : existingBatch.expiryDate, updatedAt: new Date() }).where(eq(inventoryBatches.id, existingBatch.id)).returning();
        } else {
          [batch] = await tx.insert(inventoryBatches).values({ storeId, productId: variantRow.product.id, variantId: variant.id, supplierId: payload.supplierId || null, batchNumber: payload.batchNumber, expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : null, receivedQuantity: payload.quantity, availableQuantity: payload.quantity, unitCost: payload.unitCost.toString(), createdBy: session.userId }).returning();
        }
      }
      return { receipt, variant, batch, resultingAverageCost };
    });
    await writeAuditLog({ actorId: session.userId, action: "create", category: "inventory", entityType: "inventory.cost_receipt", entityId: result.receipt.id, afterData: result });
    return created({ ...result, message: "تم استلام المخزون وتحديث متوسط التكلفة المرجح" });
  } catch (error) {
    return handleApiError(error, "تعذر تسجيل استلام المخزون");
  }
}
