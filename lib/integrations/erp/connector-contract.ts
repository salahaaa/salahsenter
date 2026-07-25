import { z } from "zod";

/**
 * Provider-neutral operational contract. A real ERP adapter must implement
 * every supported method; metadata-only adapter declarations are insufficient.
 */
export const erpReferenceSchema = z.object({ externalId: z.string().min(1), externalCode: z.string().optional(), storeId: z.string().uuid() });
export const erpWarehouseSchema = z.object({ externalId: z.string().min(1), code: z.string().min(1), name: z.string().min(1), branchExternalId: z.string().optional().nullable(), isActive: z.boolean().default(true) });
export const erpBranchSchema = z.object({ externalId: z.string().min(1), code: z.string().min(1), name: z.string().min(1), warehouseExternalId: z.string().optional().nullable(), isActive: z.boolean().default(true) });
export const erpCustomerSchema = z.object({ externalId: z.string().min(1), name: z.string().min(1), phone: z.string().optional().nullable(), email: z.string().email().optional().nullable() });
export const erpPaymentMethodSchema = z.object({ externalId: z.string().min(1), code: z.string().min(1), name: z.string().min(1), isActive: z.boolean().default(true) });
export const erpPriceListSchema = z.object({ externalId: z.string().min(1), code: z.string().min(1), name: z.string().min(1), currency: z.string().default("YER"), isActive: z.boolean().default(true) });
export const erpOrderCommandSchema = z.object({ orderId: z.string().uuid(), orderNumber: z.string().min(1), storeId: z.string().uuid(), customer: erpCustomerSchema.optional(), lines: z.array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid(), sku: z.string().optional().nullable(), quantity: z.number().positive(), unitPrice: z.number().min(0) })).min(1), currency: z.string().default("YER"), deliveryAddress: z.record(z.unknown()).default({}) });
export const erpInvoiceCommandSchema = z.object({ invoiceId: z.string().uuid(), orderId: z.string().uuid(), invoiceNumber: z.string().min(1), storeId: z.string().uuid(), total: z.number().min(0), currency: z.string().default("YER"), issuedAt: z.string().datetime() });
export const erpInventoryUpdateSchema = z.object({ storeId: z.string().uuid(), externalProductId: z.string().min(1), warehouseExternalId: z.string().optional().nullable(), quantityOnHand: z.number(), availableQuantity: z.number(), updatedAt: z.string().datetime() });
export const erpPaymentUpdateSchema = z.object({ storeId: z.string().uuid(), orderId: z.string().uuid(), paymentReference: z.string().min(1), status: z.enum(["pending", "paid", "failed", "refunded"]), paidAt: z.string().datetime().optional().nullable(), amount: z.number().min(0).optional() });

export type ErpConnectorContract = {
  createOrder(command: z.infer<typeof erpOrderCommandSchema>): Promise<{ externalOrderId: string }>;
  createInvoice(command: z.infer<typeof erpInvoiceCommandSchema>): Promise<{ externalInvoiceId: string }>;
  syncInventory(update: z.infer<typeof erpInventoryUpdateSchema>): Promise<void>;
  syncCustomers(customers: z.infer<typeof erpCustomerSchema>[]): Promise<void>;
  syncPayments(payments: z.infer<typeof erpPaymentUpdateSchema>[]): Promise<void>;
  fetchWarehouses(): Promise<z.infer<typeof erpWarehouseSchema>[]>;
  fetchBranches(): Promise<z.infer<typeof erpBranchSchema>[]>;
  fetchPriceLists(): Promise<z.infer<typeof erpPriceListSchema>[]>;
  fetchPaymentMethods(): Promise<z.infer<typeof erpPaymentMethodSchema>[]>;
};

export const ERP_REQUIRED_CONTRACT_METHODS = ["createOrder", "createInvoice", "syncInventory", "syncCustomers", "syncPayments", "fetchWarehouses", "fetchBranches", "fetchPriceLists", "fetchPaymentMethods"] as const;
