export const dynamic = "force-dynamic";

import { and, eq, inArray } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db, productImportRuns, products } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { userHasStoreOperation } from "@/lib/rbac";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const session = await requireAuth(); const store = await getMerchantPrimaryStore(session.userId);
    if (!store || !hasStoreAccess(session, store.id) || !(await userHasStoreOperation(session.userId, store.id, "products.lifecycle"))) return fail("لا تملك صلاحية rollback الاستيراد", 403);
    const [run] = await db.select().from(productImportRuns).where(and(eq(productImportRuns.id, id), eq(productImportRuns.storeId, store.id))).limit(1);
    if (!run) return fail("دفعة الاستيراد غير موجودة", 404);
    if (run.rolledBackAt) return fail("تم rollback لهذه الدفعة مسبقًا", 409);
    const ids = run.importedProductIds || [];
    const archived = ids.length ? await db.update(products).set({ status: "archived", reviewNote: `rollback import ${run.id}`, updatedAt: new Date() }).where(and(eq(products.storeId, store.id), inArray(products.id, ids))).returning({ id: products.id }) : [];
    const [updated] = await db.update(productImportRuns).set({ status: "rolled_back", rolledBackAt: new Date(), rolledBackBy: session.userId, updatedAt: new Date() }).where(eq(productImportRuns.id, run.id)).returning();
    await writeAuditLog({ actorId: session.userId, action: "update", category: "inventory", entityType: "product_import.rollback", entityId: run.id, beforeData: run, afterData: { run: updated, archivedProductIds: archived.map((row) => row.id) } });
    return ok({ run: updated, archivedCount: archived.length, message: "تم rollback آمن عبر أرشفة المنتجات التي أنشأتها الدفعة فقط" });
  } catch (error) { return handleApiError(error, "تعذر rollback الاستيراد"); }
}
