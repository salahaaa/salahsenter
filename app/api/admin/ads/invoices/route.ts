export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { adInvoices, db, stores, users } from "@/lib/db";
import { issueAdInvoicesForDay, settleAdInvoice } from "@/lib/ads/billing";
import { writeAuditLog } from "@/lib/audit";
import { assertAdminOperation } from "@/lib/rbac";

const issuanceSchema = z.object({
  date: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  note: z.string().trim().min(3).max(1_500).optional()
});

const settlementSchema = z.object({
  invoiceId: z.string().uuid(),
  action: z.enum(["mark_paid", "void"]),
  note: z.string().trim().min(3).max(1_500).optional()
});

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "ads.billing.view");
    const invoices = await db
      .select({ invoice: adInvoices, storeName: stores.name, storeNumber: stores.storeNumber, merchantName: users.fullName, merchantEmail: users.email })
      .from(adInvoices)
      .innerJoin(stores, eq(adInvoices.storeId, stores.id))
      .innerJoin(users, eq(adInvoices.merchantId, users.id))
      .orderBy(desc(adInvoices.createdAt))
      .limit(300);
    return ok({ invoices });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل فواتير الإعلانات للإدارة");
  }
}


export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "ads.billing.issue");
    const payload = issuanceSchema.parse(await request.json().catch(() => ({})));
    const result = await issueAdInvoicesForDay({ date: payload.date ? new Date(payload.date) : undefined, limit: payload.limit });
    await writeAuditLog({ actorId: session.userId, action: "create", category: "financial", entityType: "ad_invoice_issue_run", entityId: result.periodStart.toISOString(), afterData: { issuedCount: result.issuedCount, candidates: result.candidates, periodEnd: result.periodEnd, note: payload.note || null } });
    return ok({ ...result, message: `تمت مراجعة ${result.candidates} قيداً وإصدار ${result.issuedCount} فاتورة` });
  } catch (error) {
    return handleApiError(error, "تعذر إصدار فواتير الإعلانات");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "ads.billing.settle");
    const payload = settlementSchema.parse(await request.json());
    const result = await settleAdInvoice({ invoiceId: payload.invoiceId, actorId: session.userId, action: payload.action, note: payload.note });
    await writeAuditLog({
      actorId: session.userId,
      action: payload.action === "mark_paid" ? "approve" : "status_change",
      category: "financial",
      entityType: "ad_invoice",
      entityId: payload.invoiceId,
      beforeData: result.before,
      afterData: result.invoice
    });
    return ok({ invoice: result.invoice, message: payload.action === "mark_paid" ? "تم تسجيل تسوية الفاتورة" : "تم إلغاء الفاتورة مع الاحتفاظ بسجلها" });
  } catch (error) {
    return handleApiError(error, "تعذر تسوية فاتورة الإعلان");
  }
}
