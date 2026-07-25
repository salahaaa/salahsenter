import { repairImportRow } from "@/lib/ai/product-intelligence";

export type ImportRepairInputRow = {
  sourceRow?: number | string | null;
  name?: string | number | null;
  productName?: string | number | null;
  sku?: string | number | null;
  barcode?: string | number | null;
  price?: string | number | null;
  basePrice?: string | number | null;
  stock?: string | number | null;
  stockQuantity?: string | number | null;
  description?: string | number | null;
};

export type ImportRepairPlan = {
  repairs: Array<ReturnType<typeof repairImportRow> & { sourceRow: number | string }>;
  summary: { rows: number; valid: number; invalid: number };
};

/**
 * Creates a deterministic, review-only repair plan. It never changes the rows
 * or persists a product, price, stock value, or barcode.
 */
export function buildImportRepairPlan(input: {
  rows: ImportRepairInputRow[];
  storeNumber: string;
  storeId: string;
  maxRows?: number;
}): ImportRepairPlan {
  const cappedRows = input.rows.slice(0, Math.min(input.maxRows || 1000, 1000));
  const repairs = cappedRows.map((row, index) => ({
    sourceRow: row.sourceRow ?? index + 1,
    ...repairImportRow({
      name: stringValue(row.name) || stringValue(row.productName),
      sku: stringValue(row.sku),
      barcode: stringValue(row.barcode),
      price: numberOrStringValue(row.price) ?? numberOrStringValue(row.basePrice),
      stock: numberOrStringValue(row.stock) ?? numberOrStringValue(row.stockQuantity),
      description: stringValue(row.description),
      storeNumber: input.storeNumber,
      storeId: input.storeId,
      index: index + 1
    })
  }));

  return {
    repairs,
    summary: {
      rows: repairs.length,
      valid: repairs.filter((repair) => repair.valid).length,
      invalid: repairs.filter((repair) => !repair.valid).length
    }
  };
}

function stringValue(value: string | number | null | undefined) {
  return value === null || value === undefined ? undefined : String(value);
}

function numberOrStringValue(value: string | number | null | undefined) {
  return value === null || value === undefined ? undefined : value;
}
