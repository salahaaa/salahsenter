export const dynamic = "force-dynamic";

import { and, asc, eq, lte } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, inventoryBatches, productVariants, products, suppliers } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { assertStoreCapability } from "@/lib/products/advanced-inventory";
import { userHasStoreOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { assertNotGeneratedOfferInventory } from "@/lib/offers/guards";

const schema = z.object({ variantId: z.string().uuid(), supplierId: z.string().uuid().optional().nullable(), batchNumber: z.string().trim().min(1).max(140), expiryDate: z.string().datetime().optional().nullable(), receivedQuantity: z.coerce.number().int().positive(), unitCost: z.coerce.number().min(0).default(0) });

export async function GET(request: Request) {
  try {
    const session = await requireAuth(); const store = await getMerchantPrimaryStore(session.userId);
    if (!store || !hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية هذا المتجر", 403);
    if (!(await userHasStoreOperation(session.userId, store.id, "inventory.view"))) return fail("لا تملك صلاحية عرض الدُفعات", 403);
    await assertStoreCapability(store.id, "inventory_batches");
    const expiringBefore = new URL(request.url).searchParams.get("expiringBefore");
    const conditions = [eq(inventoryBatches.storeId, store.id)];
    if (expiringBefore) conditions.push(lte(inventoryBatches.expiryDate, new Date(expiringBefore)));
    const batches = await db.select({ batch: inventoryBatches, productName: products.name, variantSku: productVariants.sku, supplierName: suppliers.name }).from(inventoryBatches).innerJoin(products, eq(inventoryBatches.productId, products.id)).innerJoin(productVariants, eq(inventoryBatches.variantId, productVariants.id)).leftJoin(suppliers, eq(inventoryBatches.supplierId, suppliers.id)).where(and(...conditions)).orderBy(asc(inventoryBatches.expiryDate)).limit(500);
    return ok({ batches });
  } catch (error) { return handleApiError(error, "تعذر تحميل الدُفعات"); }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(); const payload = schema.parse(await request.json()); const store = await getMerchantPrimaryStore(session.userId);
    if (!store || !hasStoreAccess(session, store.id) || !(await userHasStoreOperation(session.userId, store.id, "inventory.manage"))) return fail("لا تملك صلاحية إدارة الدُفعات", 403);
    await assertStoreCapability(store.id, "inventory_batches");
    const [row] = await db.select({ productId: products.id }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).where(and(eq(productVariants.id, payload.variantId), eq(products.storeId, store.id))).limit(1);
    if (!row) return fail("المتغير غير موجود في هذا المتجر", 404);
    await assertNotGeneratedOfferInventory({ productId: row.productId, variantId: payload.variantId });
    const [batch] = await db.insert(inventoryBatches).values({ storeId: store.id, productId: row.productId, variantId: payload.variantId, supplierId: payload.supplierId || null, batchNumber: payload.batchNumber, expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : null, receivedQuantity: payload.receivedQuantity, availableQuantity: payload.receivedQuantity, unitCost: payload.unitCost.toString(), createdBy: session.userId }).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", category: "inventory", entityType: "inventory.batch", entityId: batch.id, afterData: batch });
    return created({ batch, message: "تم حفظ الدُفعة" });
  } catch (error) { return handleApiError(error, "تعذر حفظ الدُفعة"); }
}
