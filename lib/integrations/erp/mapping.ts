import { z } from "zod";

export const erpOperationalMappingsSchema = z.object({
  warehouses: z.record(z.string()).default({}),
  branches: z.record(z.string()).default({}),
  customers: z.record(z.string()).default({}),
  payments: z.record(z.string()).default({}),
  priceLists: z.record(z.string()).default({})
});

export const mappingProfileSchema = z.object({
  identity: z.object({
    externalId: z.string().min(1),
    externalCode: z.string().optional(),
    barcode: z.string().optional(),
    sku: z.string().optional()
  }),
  fields: z.record(z.string()).default({}),
  transforms: z.record(z.object({ type: z.enum(["string", "number", "integer", "date", "boolean"]), defaultValue: z.unknown().optional() })).default({}),
  matching: z.object({
    strategy: z.enum(["external_id_first", "barcode_then_external", "sku_then_external"]).default("external_id_first"),
    allowNameFallback: z.boolean().default(false)
  }).default({ strategy: "external_id_first", allowNameFallback: false }),
  operational: erpOperationalMappingsSchema.default({ warehouses: {}, branches: {}, customers: {}, payments: {}, priceLists: {} })
});

export type MappingProfileDefinition = z.infer<typeof mappingProfileSchema>;

export function validateMappingProfile(mapping: unknown) {
  return mappingProfileSchema.parse(mapping);
}

function getByPath(row: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((value, key) => {
    if (value && typeof value === "object") return (value as Record<string, unknown>)[key];
    return undefined;
  }, row);
}

function castValue(value: unknown, transform?: { type: string; defaultValue?: unknown }) {
  if (value == null || value === "") return transform?.defaultValue ?? null;
  switch (transform?.type) {
    case "number": return Number(value);
    case "integer": return Math.trunc(Number(value));
    case "date": {
      const date = new Date(String(value));
      return Number.isFinite(date.getTime()) ? date.toISOString() : transform.defaultValue ?? null;
    }
    case "boolean": return ["1", "true", "yes", "y", "on"].includes(String(value).toLowerCase());
    default: return String(value);
  }
}

export function mapExternalRow(row: Record<string, unknown>, mapping: MappingProfileDefinition) {
  const normalized: Record<string, unknown> = {
    externalIdentity: {
      externalId: String(getByPath(row, mapping.identity.externalId) ?? ""),
      externalCode: mapping.identity.externalCode ? getByPath(row, mapping.identity.externalCode) : undefined,
      barcode: mapping.identity.barcode ? getByPath(row, mapping.identity.barcode) : undefined,
      sku: mapping.identity.sku ? getByPath(row, mapping.identity.sku) : undefined
    }
  };

  for (const [target, sourcePath] of Object.entries(mapping.fields)) {
    normalized[target] = castValue(getByPath(row, sourcePath), mapping.transforms[target]);
  }
  return normalized;
}

export function assertNoNameOnlyMatching(mapping: MappingProfileDefinition) {
  if (mapping.matching.allowNameFallback) {
    throw new Error("Name fallback matching is disabled for financial/ERP integrations. Use externalId/barcode/SKU mapping instead.");
  }
  if (!mapping.identity.externalId) throw new Error("externalId mapping is required; do not rely on product names.");
}
