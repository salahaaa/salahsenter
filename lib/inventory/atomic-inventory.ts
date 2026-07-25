import { and, eq, sql } from "drizzle-orm";
import { inventoryMovements, productVariants } from "@/lib/db";

type DbLike = any;

type OrderInventoryItem = {
  productId: string;
  variantId: string;
  quantity: number;
  productName?: string | null;
};

export class InsufficientStockError extends Error {
  readonly statusCode = 409;
  constructor(productName = "المنتج") {
    super(`المخزون غير كافٍ للمنتج: ${productName}`);
    this.name = "InsufficientStockError";
  }
}

function assertPositiveQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("كمية المخزون غير صحيحة");
}

export async function reserveOrderStock(
  tx: DbLike,
  input: { storeId: string; orderId: string; orderNumber: string; actorId: string; items: OrderInventoryItem[] }
) {
  for (const item of input.items) {
    assertPositiveQuantity(item.quantity);
    const [updated] = await tx
      .update(productVariants)
      .set({ reservedQuantity: sql`${productVariants.reservedQuantity} + ${item.quantity}`, updatedAt: new Date() })
      .where(and(eq(productVariants.id, item.variantId), sql`${productVariants.stockQuantity} - ${productVariants.reservedQuantity} >= ${item.quantity}`))
      .returning({ id: productVariants.id, stockQuantity: productVariants.stockQuantity, reservedQuantity: productVariants.reservedQuantity });

    if (!updated) throw new InsufficientStockError(item.productName || item.variantId);

    const afterQuantity = Number(updated.stockQuantity || 0) - Number(updated.reservedQuantity || 0);
    const beforeQuantity = afterQuantity + item.quantity;
    await tx
      .insert(inventoryMovements)
      .values({
        storeId: input.storeId,
        productId: item.productId,
        variantId: item.variantId,
        type: "reserve",
        quantity: item.quantity,
        beforeQuantity,
        afterQuantity,
        reason: `Order ${input.orderNumber} stock reserved in platform; ERP remains source of truth`,
        referenceType: "order",
        referenceId: input.orderId,
        actorId: input.actorId
      })
      .onConflictDoNothing();
  }
}

export async function deductOrderStockForLegacyUnreservedOrder(
  _tx: DbLike,
  _input: { storeId: string; orderId: string; orderNumber: string; actorId: string; items: OrderInventoryItem[] }
) {
  // ERP is the source of truth for real stock deduction.
  // Platform must not deduct actual inventory during order status changes; it only reserves/releases.
  return;
}

export async function releaseOrderStock(
  tx: DbLike,
  input: { storeId: string; orderId: string; orderNumber: string; actorId: string; items: OrderInventoryItem[]; movementType?: "release" | "return" }
) {
  const movementType = input.movementType || "release";
  for (const item of input.items) {
    assertPositiveQuantity(item.quantity);

    const [variant] = await tx.select().from(productVariants).where(eq(productVariants.id, item.variantId)).limit(1);
    if (!variant) continue;
    const beforeQuantity = Number(variant.stockQuantity || 0) - Number(variant.reservedQuantity || 0);
    const releaseQuantity = Math.min(Number(variant.reservedQuantity || 0), item.quantity);
    const afterQuantity = beforeQuantity + releaseQuantity;

    const [movement] = await tx
      .insert(inventoryMovements)
      .values({
        storeId: input.storeId,
        productId: item.productId,
        variantId: item.variantId,
        type: movementType,
        quantity: item.quantity,
        beforeQuantity,
        afterQuantity,
        reason: `Order ${input.orderNumber} ${movementType === "release" ? "reservation released" : "return acknowledged; ERP controls physical stock"}`,
        referenceType: "order",
        referenceId: input.orderId,
        actorId: input.actorId
      })
      .onConflictDoNothing()
      .returning({ id: inventoryMovements.id });

    if (!movement) continue;

    await tx
      .update(productVariants)
      .set({ reservedQuantity: sql`greatest(${productVariants.reservedQuantity} - ${item.quantity}, 0)`, updatedAt: new Date() })
      .where(eq(productVariants.id, item.variantId));
  }
}
