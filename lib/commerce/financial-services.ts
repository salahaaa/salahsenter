import { and, eq, sql } from "drizzle-orm";
import { inventoryMovements, orderInvoices, productVariants } from "@/lib/db";
import { settleClosedPaidOrder } from "@/lib/finance/settlements";
import type { MerchantIntegrationSettings } from "@/lib/commerce/financial-strategy";
import { platformIsFinancialIntermediary } from "@/lib/platform-revenue/customer-money-policy";

export type FinancialOrderItem = {
  productId: string;
  variantId: string;
  quantity: number;
  productName?: string | null;
};

type DbLike = any;

function generateInvoiceNumber() {
  return `INV-${new Date().getFullYear()}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export interface InvoiceService {
  mode: "ERP" | "STANDALONE";
  createForOrder(tx: DbLike, input: { order: any; sellerSnapshot: Record<string, unknown>; buyerSnapshot: Record<string, unknown>; totalsSnapshot: Record<string, unknown> }): Promise<any | null>;
}

export interface InventoryService {
  mode: "ERP" | "STANDALONE";
  finalizeOrderReservation(tx: DbLike, input: { storeId: string; orderId: string; orderNumber: string; actorId?: string | null; items: FinancialOrderItem[] }): Promise<{ finalized: boolean; reason?: string }>;
  cancelInvoicedOrder(tx: DbLike, input: { storeId: string; orderId: string; orderNumber: string; actorId?: string | null; items: FinancialOrderItem[] }): Promise<{ returned: boolean; reason?: string }>;
}

export interface RevenueService {
  mode: "ERP" | "STANDALONE";
  settleClosedPaidOrder(tx: DbLike, orderId: string, actorId?: string | null): Promise<unknown>;
}

export class ERPInvoiceService implements InvoiceService {
  mode = "ERP" as const;
  async createForOrder() {
    // ERP creates the financial invoice. Platform waits for invoice.created from integration.
    return null;
  }
}

export class PlatformInvoiceService implements InvoiceService {
  mode = "STANDALONE" as const;
  async createForOrder(tx: DbLike, input: { order: any; sellerSnapshot: Record<string, unknown>; buyerSnapshot: Record<string, unknown>; totalsSnapshot: Record<string, unknown> }) {
    const [invoice] = await tx.insert(orderInvoices).values({
      orderId: input.order.id,
      invoiceNumber: generateInvoiceNumber(),
      status: "issued",
      sourceSystem: "salah_center",
      sellerSnapshot: input.sellerSnapshot,
      buyerSnapshot: input.buyerSnapshot,
      totalsSnapshot: { ...input.totalsSnapshot, financialMode: "STANDALONE" },
      integrationMetadata: { authority: "platform", generatedBy: "PlatformInvoiceService" }
    }).returning();
    return invoice;
  }
}

export class ERPInventoryService implements InventoryService {
  mode = "ERP" as const;
  async finalizeOrderReservation() {
    // ERP deducts actual stock. Platform reservation is released when ERP sends invoice.created/inventory.updated.
    return { finalized: false, reason: "erp_inventory_authority" };
  }
  async cancelInvoicedOrder() {
    // ERP must issue return/credit note and send inventory.updated.
    return { returned: false, reason: "erp_return_authority" };
  }
}

export class PlatformInventoryService implements InventoryService {
  mode = "STANDALONE" as const;

  async finalizeOrderReservation(tx: DbLike, input: { storeId: string; orderId: string; orderNumber: string; actorId?: string | null; items: FinancialOrderItem[] }) {
    for (const item of input.items) {
      const [updated] = await tx
        .update(productVariants)
        .set({
          stockQuantity: sql`${productVariants.stockQuantity} - ${item.quantity}`,
          reservedQuantity: sql`greatest(${productVariants.reservedQuantity} - ${item.quantity}, 0)`,
          updatedAt: new Date()
        })
        .where(and(eq(productVariants.id, item.variantId), sql`${productVariants.stockQuantity} >= ${item.quantity}`))
        .returning({ stockQuantity: productVariants.stockQuantity, reservedQuantity: productVariants.reservedQuantity });
      if (!updated) throw new Error(`المخزون غير كافٍ لإتمام الفاتورة: ${item.productName || item.variantId}`);
      await tx.insert(inventoryMovements).values({
        storeId: input.storeId,
        productId: item.productId,
        variantId: item.variantId,
        type: "deduct",
        quantity: item.quantity,
        beforeQuantity: Number(updated.stockQuantity || 0) + item.quantity,
        afterQuantity: Number(updated.stockQuantity || 0),
        reason: `Standalone invoice ${input.orderNumber} stock deducted by platform`,
        referenceType: "standalone_invoice",
        referenceId: input.orderId,
        actorId: input.actorId || null
      }).onConflictDoNothing();
    }
    return { finalized: true };
  }

  async cancelInvoicedOrder(tx: DbLike, input: { storeId: string; orderId: string; orderNumber: string; actorId?: string | null; items: FinancialOrderItem[] }) {
    for (const item of input.items) {
      const [variant] = await tx.select().from(productVariants).where(eq(productVariants.id, item.variantId)).limit(1);
      if (!variant) continue;
      const beforeQuantity = Number(variant.stockQuantity || 0);
      const afterQuantity = beforeQuantity + item.quantity;
      await tx.update(productVariants).set({ stockQuantity: sql`${productVariants.stockQuantity} + ${item.quantity}`, updatedAt: new Date() }).where(eq(productVariants.id, item.variantId));
      await tx.insert(inventoryMovements).values({
        storeId: input.storeId,
        productId: item.productId,
        variantId: item.variantId,
        type: "return",
        quantity: item.quantity,
        beforeQuantity,
        afterQuantity,
        reason: `Standalone invoice ${input.orderNumber} cancelled/returned by platform`,
        referenceType: "standalone_invoice_cancelled",
        referenceId: input.orderId,
        actorId: input.actorId || null
      }).onConflictDoNothing();
    }
    return { returned: true };
  }
}

/** Customer money goes to the merchant; platform records order state only. */
export class MerchantCollectsRevenueService implements RevenueService {
  mode = "STANDALONE" as const;
  async settleClosedPaidOrder() {
    return { settled: false, reason: "merchant_collects_direct_payment" };
  }
}

export class ERPRevenueService implements RevenueService {
  mode = "ERP" as const;
  async settleClosedPaidOrder(tx: DbLike, orderId: string, actorId?: string | null) {
    // ERP remains accounting revenue authority. This method writes only the
    // marketplace settlement mirror after a verified ERP invoice/payment update.
    return settleClosedPaidOrder(tx, orderId, actorId);
  }
}

export class PlatformRevenueService implements RevenueService {
  mode = "STANDALONE" as const;
  async settleClosedPaidOrder(tx: DbLike, orderId: string, actorId?: string | null) {
    return settleClosedPaidOrder(tx, orderId, actorId);
  }
}

export function createFinancialServices(settings: MerchantIntegrationSettings) {
  const erp = settings.integrationEnabled && settings.integrationMode === "ERP";
  return {
    invoice: erp ? new ERPInvoiceService() : new PlatformInvoiceService(),
    inventory: erp ? new ERPInventoryService() : new PlatformInventoryService(),
    // Default commercial policy does not create a merchant balance, ledger credit or payout.
    // A platform-settlement mode can only be enabled explicitly by environment and governance review.
    revenue: platformIsFinancialIntermediary() ? (erp ? new ERPRevenueService() : new PlatformRevenueService()) : new MerchantCollectsRevenueService(),
    mode: erp ? "ERP" as const : "STANDALONE" as const
  };
}
