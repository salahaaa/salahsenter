export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError } from "@/lib/api";
import { db, stores } from "@/lib/db";
import { assertStoreAllowed, authenticateIntegrationRequest, IntegrationAuthError } from "@/lib/integrations/accounting/auth";
import { submitMerchantSalesReport } from "@/lib/platform-revenue/service";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ storeId: z.string().uuid(), periodStart: z.string().datetime(), periodEnd: z.string().datetime(), salesTotal: z.coerce.number().min(0), currency: z.string().trim().min(3).max(10).default("YER"), externalReference: z.string().trim().max(180).optional().nullable(), metadata: z.record(z.unknown()).default({}) });

/** Inbound ERP/API sales declaration. It creates a submitted report only; an admin still approves commission basis. */
export async function POST(request: Request) {
  try {
    const context = await authenticateIntegrationRequest(request, "sales_reports:write");
    const payload = schema.parse(await request.json());
    assertStoreAllowed(context, payload.storeId);
    if (new Date(payload.periodEnd) <= new Date(payload.periodStart)) return fail("نهاية الفترة يجب أن تكون بعد البداية", 422);
    const [store] = await db.select({ merchantId: stores.merchantId }).from(stores).where(eq(stores.id, payload.storeId)).limit(1);
    if (!store) return fail("المتجر غير موجود", 404);
    const result = await submitMerchantSalesReport({ storeId: payload.storeId, merchantId: store.merchantId, periodStart: new Date(payload.periodStart), periodEnd: new Date(payload.periodEnd), salesTotal: payload.salesTotal, currency: payload.currency, source: "erp", externalReference: payload.externalReference, note: `ERP/API client: ${context.clientId}` });
    await writeAuditLog({ action: "create", category: "financial", entityType: "merchant_sales_report_erp_submitted", entityId: result.report.id, afterData: { report: result.report, integrationClientId: context.clientId, provider: context.provider, metadata: payload.metadata } });
    return created({ report: result.report, message: "تم استلام تقرير مبيعات ERP وهو بانتظار اعتماد الإدارة قبل احتساب العمولة" });
  } catch (error) {
    if (error instanceof IntegrationAuthError) return fail(error.message, error.status);
    return handleApiError(error, "تعذر استلام تقرير مبيعات التكامل");
  }
}
