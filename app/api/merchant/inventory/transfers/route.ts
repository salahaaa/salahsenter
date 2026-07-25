export const dynamic = "force-dynamic";

import { and, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, inventoryTransferLines, inventoryTransfers, productVariants, products, stores } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { transferReference } from "@/lib/products/advanced-inventory";
import { userHasStoreOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const lineSchema = z.object({ sourceVariantId: z.string().uuid(), destinationVariantId: z.string().uuid(), quantity: z.coerce.number().int().positive() });
const schema = z.object({ sourceStoreId: z.string().uuid().optional(), destinationStoreId: z.string().uuid(), note: z.string().trim().max(2_000).optional().nullable(), lines: z.array(lineSchema).min(1).max(300) });

async function assertSameMerchantStores(sourceStoreId: string, destinationStoreId: string) {
  if (sourceStoreId === destinationStoreId) throw new Error("يجب اختيار فرع مختلف للاستلام");
  const rows = await db.select({ id: stores.id, merchantId: stores.merchantId }).from(stores).where(inArray(stores.id, [sourceStoreId, destinationStoreId]));
  if (rows.length !== 2 || rows[0].merchantId !== rows[1].merchantId) throw new Error("لا يمكن التحويل إلا بين فروع التاجر نفسها");
}

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store || !hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية هذا المتجر", 403);
    if (!(await userHasStoreOperation(session.userId, store.id, "inventory.view"))) return fail("لا تملك صلاحية عرض التحويلات", 403);
    const transfers = await db.select().from(inventoryTransfers).where(or(eq(inventoryTransfers.sourceStoreId, store.id), eq(inventoryTransfers.destinationStoreId, store.id))).orderBy(desc(inventoryTransfers.createdAt)).limit(100);
    return ok({ transfers });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل تحويلات المخزون");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const sourceStoreId = payload.sourceStoreId || (await getMerchantPrimaryStore(session.userId))?.id;
    if (!sourceStoreId || !hasStoreAccess(session, sourceStoreId)) return fail("لا تملك صلاحية المتجر المصدر", 403);
    if (!(await userHasStoreOperation(session.userId, sourceStoreId, "inventory.manage"))) return fail("لا تملك صلاحية إنشاء تحويل مخزون", 403);
    if (!hasStoreAccess(session, payload.destinationStoreId)) return fail("لا تملك صلاحية الفرع المستلم", 403);
    await assertSameMerchantStores(sourceStoreId, payload.destinationStoreId);

    const result = await db.transaction(async (tx) => {
      const variantIds = payload.lines.flatMap((line) => [line.sourceVariantId, line.destinationVariantId]);
      const rows = await tx.select({ variant: productVariants, product: products }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).where(inArray(productVariants.id, variantIds));
      const byId = new Map(rows.map((row) => [row.variant.id, row]));
      for (const line of payload.lines) {
        const source = byId.get(line.sourceVariantId); const destination = byId.get(line.destinationVariantId);
        if (!source || !destination || source.product.storeId !== sourceStoreId || destination.product.storeId !== payload.destinationStoreId) throw new Error("أحد المتغيرات لا يتبع الفرع الصحيح");
        if (source.variant.stockQuantity - source.variant.reservedQuantity < line.quantity) throw new Error(`المخزون المتاح غير كافٍ للمتغير ${source.variant.sku}`);
      }
      const [transfer] = await tx.insert(inventoryTransfers).values({ sourceStoreId, destinationStoreId: payload.destinationStoreId, referenceNumber: transferReference(), note: payload.note || null, requestedBy: session.userId, status: "draft" }).returning();
      const lines = await tx.insert(inventoryTransferLines).values(payload.lines.map((line) => {
        const source = byId.get(line.sourceVariantId)!; const destination = byId.get(line.destinationVariantId)!;
        return { transferId: transfer.id, sourceProductId: source.product.id, sourceVariantId: source.variant.id, destinationProductId: destination.product.id, destinationVariantId: destination.variant.id, quantity: line.quantity };
      })).returning();
      return { transfer, lines };
    });
    await writeAuditLog({ actorId: session.userId, action: "create", category: "inventory", entityType: "inventory.transfer", entityId: result.transfer.id, afterData: result });
    return created({ ...result, message: "تم إنشاء مسودة تحويل المخزون" });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء تحويل المخزون");
  }
}
