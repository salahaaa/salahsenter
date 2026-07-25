import { and, eq } from "drizzle-orm";
import { db, storeCapabilities } from "@/lib/db";

export const PRODUCT_OS_CAPABILITIES = ["inventory_batches", "inventory_expiry"] as const;
export type ProductOsCapability = (typeof PRODUCT_OS_CAPABILITIES)[number];

export function calculateWeightedAverageCost(input: { previousQuantity: number; previousAverageCost: number; receivedQuantity: number; unitCost: number }) {
  const previousQuantity = Math.max(0, Number(input.previousQuantity || 0));
  const receivedQuantity = Math.max(0, Number(input.receivedQuantity || 0));
  const previousAverageCost = Math.max(0, Number(input.previousAverageCost || 0));
  const unitCost = Math.max(0, Number(input.unitCost || 0));
  const totalQuantity = previousQuantity + receivedQuantity;
  if (!totalQuantity) return 0;
  return Number((((previousQuantity * previousAverageCost) + (receivedQuantity * unitCost)) / totalQuantity).toFixed(2));
}

export function transferReference() {
  return `TRF-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function getStoreCapabilities(storeId: string) {
  const rows = await db.select({ code: storeCapabilities.code, isEnabled: storeCapabilities.isEnabled }).from(storeCapabilities).where(eq(storeCapabilities.storeId, storeId));
  return new Map(rows.map((row) => [row.code, row.isEnabled]));
}

export async function storeHasCapability(storeId: string, capability: ProductOsCapability) {
  const [row] = await db.select({ isEnabled: storeCapabilities.isEnabled }).from(storeCapabilities).where(and(eq(storeCapabilities.storeId, storeId), eq(storeCapabilities.code, capability))).limit(1);
  return Boolean(row?.isEnabled);
}

export async function assertStoreCapability(storeId: string, capability: ProductOsCapability) {
  if (!(await storeHasCapability(storeId, capability))) {
    throw new Error(capability === "inventory_batches" || capability === "inventory_expiry"
      ? "ميزة الدُفعات وتواريخ الصلاحية غير مفعلة لهذا المتجر. اطلب من الإدارة تفعيلها للقطاع المناسب."
      : "هذه الميزة غير مفعلة لهذا المتجر.");
  }
}
