export const QA_TEST_STATUSES = ["planned", "running", "passed", "failed", "blocked"] as const;
export type QaTestStatus = (typeof QA_TEST_STATUSES)[number];

export type QaTestSeverity = "info" | "warning" | "critical";
export type QaTestCase = {
  key: string;
  category: string;
  title: string;
  description: string;
  severity: QaTestSeverity;
};

/** Shared test plan used by individual QA accounts and the administrator control center. */
export const QA_TEST_CATALOG: readonly QaTestCase[] = [
  { key: "DB-SCHEMA-01", category: "Database readiness", title: "Schema readiness", description: "Health deep reports ready schema and no missing operational tables.", severity: "critical" },
  { key: "PUBLIC-DATA-01", category: "Public data", title: "Honest public pages", description: "Offers, wings and store pages distinguish empty data from a schema or connection failure.", severity: "critical" },
  { key: "RBAC-01", category: "Access control", title: "Role isolation", description: "Customer, merchant and platform staff cannot access another role or store through URL/API direct access.", severity: "critical" },
  { key: "COMMERCE-01", category: "Commerce", title: "Merchant product lifecycle", description: "Merchant sets draft product price, stock and publication before it becomes visible to customers.", severity: "warning" },
  { key: "CHECKOUT-01", category: "Commerce", title: "Multi-store checkout", description: "A basket with multiple stores creates independent orders without duplicate successful-store items.", severity: "critical" },
  { key: "A11Y-01", category: "Accessibility", title: "Keyboard and Axe audit", description: "Public pages pass the Staging Axe critical/serious gate and keyboard navigation checks.", severity: "warning" },
  { key: "TEXT-01", category: "Customer text", title: "Shopper text source", description: "Customer-facing static text is managed by its correct source without duplicate values.", severity: "info" },
  { key: "PAYMENT-01", category: "Payment sandbox", title: "Valid and failed payment", description: "Sandbox payment success and failure transitions are recorded without platform custody of customer money.", severity: "critical" },
  { key: "PAYMENT-02", category: "Payment sandbox", title: "Webhook replay protection", description: "Invalid signature and duplicate/replay webhook events do not mutate an order twice.", severity: "critical" },
  { key: "ERP-01", category: "ERP sandbox", title: "Order and inventory sync", description: "Sandbox order/invoice/inventory events are reconciled with retry evidence.", severity: "warning" },
  { key: "PERF-01", category: "Performance", title: "Public performance", description: "Staging browser and load evidence meet the agreed error-rate and latency thresholds.", severity: "warning" },
  { key: "RECOVERY-01", category: "Recovery", title: "R2 backup recovery", description: "Verified R2 checksum backup restores only to the authorized isolated recovery target.", severity: "critical" }
] as const;

export function findQaTestCase(key: string) {
  return QA_TEST_CATALOG.find((item) => item.key === key) || null;
}
