export const dynamic = "force-dynamic";

import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { db, productImportRuns } from "@/lib/db";
import { createProductFromDraft } from "@/lib/enterprise/product-intake";
import { formatSetupMissingMessage, getStoreSetupStatus } from "@/lib/merchant-readiness";
import { writeAuditLog } from "@/lib/audit";

const duplicateCandidateSchema = z.object({ id: z.string(), name: z.string(), slug: z.string(), barcode: z.string().nullable().optional(), productCode: z.string().nullable().optional(), mainImageUrl: z.string().nullable().optional(), score: z.number(), reason: z.string() });

const draftVariantSchema = z.object({
  title: z.string().min(1),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  price: z.coerce.number().min(0).optional(),
  stockQuantity: z.coerce.number().int().min(0).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  imageUrl: z.string().optional(),
  images: z.array(z.string()).optional(),
  attributes: z.record(z.string()).default({})
});

const draftSchema = z.object({
  name: z.string().min(2),
  categoryId: z.string().uuid().optional().nullable(),
  categoryName: z.string().optional(),
  brand: z.string().optional(),
  barcode: z.string().optional(),
  basePrice: z.coerce.number().min(0).optional(),
  stockQuantity: z.coerce.number().int().min(0).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  mainImageUrl: z.string().optional(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  attributes: z.record(z.string()).optional(),
  variants: z.array(draftVariantSchema).optional(),
  confidenceScore: z.number().optional(),
  classificationMode: z.enum(["auto", "suggested", "needs_review"]).optional(),
  duplicateCandidates: z.array(duplicateCandidateSchema).optional(),
  status: z.enum(["draft", "review", "active", "paused", "inactive", "archived"]).optional().default("draft")
});
const schema = z.object({ mode: z.enum(["create", "update"]).default("create"), sourceFileName: z.string().max(255).optional().nullable(), drafts: z.array(draftSchema).min(1).max(500) });

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية إدارة هذا المتجر", 403);
    const setupStatus = await getStoreSetupStatus(session.userId, store);
    if (!setupStatus.ready) return fail(formatSetupMissingMessage(setupStatus), 409, { setup: setupStatus });
    const payload = schema.parse(await request.json());
    const results = [];
    for (const draft of payload.drafts) {
      try {
        const result = await createProductFromDraft(store, draft, session.userId, payload.mode);
        results.push({ ok: true, id: result.product.id, name: result.product.name, action: result.action });
      } catch (error) {
        results.push({ ok: false, name: draft.name, error: error instanceof Error ? error.message : "تعذر الحفظ" });
      }
    }
    const importedProductIds = results.filter((row) => row.ok && row.action === "created").map((row: any) => row.id).filter(Boolean);
    const [run] = await db.insert(productImportRuns).values({ storeId: store.id, sourceFileName: payload.sourceFileName || null, mode: payload.mode, status: "completed", totalRows: results.length, successRows: results.filter((row) => row.ok).length, failedRows: results.filter((row) => !row.ok).length, importedProductIds, results: results as any, createdBy: session.userId }).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "smart_product_bulk_import", entityId: run.id, afterData: { count: results.length, mode: payload.mode, importedProductIds } });
    return ok({ run, results, created: results.filter((row) => row.ok).length, failed: results.filter((row) => !row.ok).length, message: "تم تنفيذ الاستيراد الذكي" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ المنتجات دفعة واحدة");
  }
}
