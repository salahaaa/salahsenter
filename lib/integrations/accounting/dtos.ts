import { z } from "zod";

export const moneySchema = z.object({
  amount: z.coerce.number(),
  currency: z.string().min(2).max(10).default("YER")
});

export const productVariantSyncSchema = z.object({
  variantId: z.string(),
  externalVariantId: z.string().optional(),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  price: moneySchema,
  compareAtPrice: moneySchema.optional(),
  stockQuantity: z.coerce.number().int(),
  attributes: z.record(z.string()).default({}),
  isActive: z.boolean().default(true),
  updatedAt: z.string()
});

export const productSyncSchema = z.object({
  productId: z.string(),
  externalProductId: z.string().optional(),
  storeId: z.string(),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  productCode: z.string().nullable().optional(),
  name: z.string(),
  englishName: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  status: z.string(),
  basePrice: moneySchema.optional(),
  discountPercent: z.coerce.number().default(0),
  variants: z.array(productVariantSyncSchema).default([]),
  updatedAt: z.string()
});

export const inventorySyncSchema = z.object({
  storeId: z.string(),
  productId: z.string(),
  variantId: z.string(),
  externalProductId: z.string().optional(),
  externalVariantId: z.string().optional(),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  productName: z.string(),
  variantTitle: z.string().nullable().optional(),
  quantityOnHand: z.coerce.number().int(),
  reservedQuantity: z.coerce.number().int().default(0),
  availableQuantity: z.coerce.number().int(),
  lowStockThreshold: z.coerce.number().int().default(0),
  updatedAt: z.string()
});

export const orderLineSyncSchema = z.object({
  lineId: z.string(),
  productId: z.string(),
  variantId: z.string(),
  sku: z.string().nullable().optional(),
  productCode: z.string().nullable().optional(),
  productName: z.string(),
  variantTitle: z.string().nullable().optional(),
  quantity: z.coerce.number().int(),
  unitPrice: moneySchema,
  totalPrice: moneySchema
});

export const orderSyncSchema = z.object({
  orderId: z.string(),
  externalOrderId: z.string().optional(),
  orderNumber: z.string(),
  storeId: z.string(),
  customerId: z.string(),
  statusCode: z.string(),
  paymentStatus: z.string(),
  currency: z.string(),
  subtotal: moneySchema,
  shippingFee: moneySchema,
  discountTotal: moneySchema,
  grandTotal: moneySchema,
  deliveryAddress: z.record(z.unknown()).default({}),
  customerNote: z.string().nullable().optional(),
  lines: z.array(orderLineSyncSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const invoiceSyncSchema = z.object({
  invoiceId: z.string(),
  externalInvoiceId: z.string().optional(),
  invoiceNumber: z.string(),
  orderId: z.string(),
  orderNumber: z.string().optional(),
  storeId: z.string(),
  status: z.string(),
  currency: z.string(),
  total: moneySchema,
  issuedAt: z.string(),
  lines: z.array(orderLineSyncSchema).default([]),
  sellerSnapshot: z.record(z.unknown()).default({}),
  buyerSnapshot: z.record(z.unknown()).default({}),
  totalsSnapshot: z.record(z.unknown()).default({}),
  updatedAt: z.string()
});

export const paymentSyncSchema = z.object({
  paymentId: z.string().optional(),
  externalPaymentId: z.string().optional(),
  orderId: z.string().optional(),
  orderNumber: z.string().optional(),
  storeId: z.string(),
  paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]),
  paymentReference: z.string().optional().nullable(),
  paidAt: z.string().optional().nullable(),
  updatedAt: z.string()
});

export const accountingPushEnvelopeSchema = z.object({
  storeId: z.string().uuid().optional(),
  sourceSystem: z.string().min(2).max(120),
  sourceType: z.enum(["access", "sql_server", "pos", "desktop_erp", "desktop_accounting", "other"]).default("other"),
  batchId: z.string().max(180).optional(),
  idempotencyKey: z.string().max(220).optional(),
  items: z.array(z.record(z.unknown())).min(1).max(500)
});

export type ProductSyncDTO = z.infer<typeof productSyncSchema>;
export type InventorySyncDTO = z.infer<typeof inventorySyncSchema>;
export type OrderSyncDTO = z.infer<typeof orderSyncSchema>;
export type InvoiceSyncDTO = z.infer<typeof invoiceSyncSchema>;
export type PaymentSyncDTO = z.infer<typeof paymentSyncSchema>;
export type AccountingPushEnvelope = z.infer<typeof accountingPushEnvelopeSchema>;

export type SyncPullResponse<T> = {
  data: T[];
  pageInfo: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
    generatedAt: string;
  };
};

export const INTEGRATION_API_VERSION = "2026-07-06.accounting.v1";
