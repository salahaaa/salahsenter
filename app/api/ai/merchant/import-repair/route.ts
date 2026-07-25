export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { buildImportRepairPlan, type ImportRepairInputRow } from "@/lib/ai/import-repair";
import { db, productImportRuns } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { userHasStoreOperation } from "@/lib/rbac";

const valueSchema = z.union([z.string().max(10_000), z.number(), z.null()]).optional();
const rowSchema = z.object({
  sourceRow: z.union([z.number().int().positive(), z.string().max(40), z.null()]).optional(),
  name: valueSchema,
  productName: valueSchema,
  sku: valueSchema,
  barcode: valueSchema,
  price: valueSchema,
  basePrice: valueSchema,
  stock: valueSchema,
  stockQuantity: valueSchema,
  description: valueSchema
});
const schema = z.object({
  runId: z.string().uuid().optional(),
  rows: z.array(rowSchema).min(1).max(1000).optional()
}).superRefine((payload, context) => {
  if (Boolean(payload.runId) === Boolean(payload.rows)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "أرسل runId أو rows فقط" });
  }
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store || !hasStoreAccess(session, store.id)) return fail("لا يوجد متجر", 403);
    if (!(await userHasStoreOperation(session.userId, store.id, "ai.use"))) return fail("لا تملك صلاحية ذكاء المتجر", 403);

    const payload = schema.parse(await request.json());
    let rows: ImportRepairInputRow[];
    let source: "draft_preview" | "saved_run";

    if (payload.rows) {
      rows = payload.rows;
      source = "draft_preview";
    } else {
      const [run] = await db.select().from(productImportRuns).where(eq(productImportRuns.id, payload.runId!)).limit(1);
      if (!run || run.storeId !== store.id) return fail("ملف الاستيراد غير موجود", 404);
      rows = Array.isArray(run.results) ? run.results as ImportRepairInputRow[] : [];
      source = "saved_run";
    }

    const plan = buildImportRepairPlan({ rows, storeNumber: store.storeNumber, storeId: store.id });
    return ok({
      runId: payload.runId || null,
      source,
      ...plan,
      message: "هذه خطة إصلاح ومراجعة فقط؛ لا يتم حفظ أو إنشاء منتجات أو تغيير سعر أو مخزون تلقائياً. الباركود المقترح مرجع داخلي وليس GS1/EAN."
    });
  } catch (error) {
    return handleApiError(error, "تعذر تحليل ملف الاستيراد");
  }
}
