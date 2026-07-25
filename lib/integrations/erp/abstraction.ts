export type ErpSystemType = "sql_server" | "access" | "odbc" | "csv_excel" | "pos" | "desktop_erp" | "generic";
export type ErpResource = "products" | "inventory" | "orders" | "invoices" | "returns" | "events";
export type SyncDirection = "local_to_platform" | "platform_to_local" | "bidirectional";

export type ErpCapability = {
  resource: ErpResource;
  directions: SyncDirection[];
  supportsIncremental: boolean;
  requiresMapping: boolean;
  recommendedSourceOfTruth: "local" | "platform" | "hybrid";
};

export type ErpAdapterDefinition = {
  systemType: ErpSystemType;
  displayName: string;
  description: string;
  transport: "odbc" | "sql" | "file" | "sdk" | "api";
  capabilities: ErpCapability[];
  defaultMapping: Record<string, unknown>;
  securityNotes: string[];
};

const commonProductMapping = {
  identity: { externalId: "ItemCode", externalCode: "ItemCode", barcode: "Barcode", sku: "ItemCode" },
  fields: { name: "ItemName", basePrice: "SalePrice", stockQuantity: "Quantity", updatedAt: "LastModified" },
  matching: { strategy: "external_id_first", allowNameFallback: false }
};

export const ERP_ADAPTERS: ErpAdapterDefinition[] = [
  {
    systemType: "sql_server",
    displayName: "SQL Server Accounting / POS",
    description: "تكامل عبر SqlClient مع جداول محلية داخل شبكة التاجر.",
    transport: "sql",
    capabilities: [
      { resource: "products", directions: ["platform_to_local"], supportsIncremental: true, requiresMapping: true, recommendedSourceOfTruth: "platform" },
      { resource: "inventory", directions: ["local_to_platform"], supportsIncremental: true, requiresMapping: true, recommendedSourceOfTruth: "local" },
      { resource: "orders", directions: ["platform_to_local"], supportsIncremental: true, requiresMapping: true, recommendedSourceOfTruth: "platform" },
      { resource: "invoices", directions: ["local_to_platform"], supportsIncremental: true, requiresMapping: true, recommendedSourceOfTruth: "local" }
    ],
    defaultMapping: commonProductMapping,
    securityNotes: ["استخدم Windows Auth إن أمكن.", "لا تفتح SQL Server للإنترنت.", "Agent يعمل outbound HTTPS فقط."]
  },
  {
    systemType: "access",
    displayName: "Microsoft Access Accounting",
    description: "تكامل عبر ODBC/OLE DB مع ملفات accdb/mdb محلية.",
    transport: "odbc",
    capabilities: [
      { resource: "products", directions: ["platform_to_local"], supportsIncremental: true, requiresMapping: true, recommendedSourceOfTruth: "platform" },
      { resource: "inventory", directions: ["local_to_platform"], supportsIncremental: true, requiresMapping: true, recommendedSourceOfTruth: "local" },
      { resource: "orders", directions: ["platform_to_local"], supportsIncremental: false, requiresMapping: true, recommendedSourceOfTruth: "platform" }
    ],
    defaultMapping: commonProductMapping,
    securityNotes: ["احفظ ملف Access داخل مجلد محمي.", "استخدم نسخ احتياطي للملف قبل أول مزامنة."]
  },
  {
    systemType: "csv_excel",
    displayName: "CSV / Excel Export",
    description: "تكامل عبر ملفات export/import عند عدم توفر وصول مباشر للنظام.",
    transport: "file",
    capabilities: [
      { resource: "products", directions: ["platform_to_local"], supportsIncremental: false, requiresMapping: true, recommendedSourceOfTruth: "platform" },
      { resource: "inventory", directions: ["local_to_platform"], supportsIncremental: false, requiresMapping: true, recommendedSourceOfTruth: "local" }
    ],
    defaultMapping: commonProductMapping,
    securityNotes: ["راقب مجلد export فقط.", "انقل الملفات إلى processed/failed بعد المعالجة."]
  },
  {
    systemType: "generic",
    displayName: "Generic Desktop ERP/POS",
    description: "تعريف مجرد لأي ERP/POS غير معروف عبر mapping مخصص.",
    transport: "sdk",
    capabilities: [
      { resource: "products", directions: ["platform_to_local"], supportsIncremental: true, requiresMapping: true, recommendedSourceOfTruth: "platform" },
      { resource: "inventory", directions: ["local_to_platform"], supportsIncremental: true, requiresMapping: true, recommendedSourceOfTruth: "local" },
      { resource: "orders", directions: ["platform_to_local"], supportsIncremental: true, requiresMapping: true, recommendedSourceOfTruth: "platform" },
      { resource: "invoices", directions: ["local_to_platform"], supportsIncremental: true, requiresMapping: true, recommendedSourceOfTruth: "local" },
      { resource: "returns", directions: ["local_to_platform"], supportsIncremental: true, requiresMapping: true, recommendedSourceOfTruth: "local" }
    ],
    defaultMapping: commonProductMapping,
    securityNotes: ["استخدم plugin منفصل لكل vendor.", "لا تضع منطق ERP داخل منصة Salah Center."]
  }
];

export function getErpAdapter(systemType: string) {
  return ERP_ADAPTERS.find((adapter) => adapter.systemType === systemType) || ERP_ADAPTERS.find((adapter) => adapter.systemType === "generic")!;
}
