export const dynamic = "force-dynamic";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, integrationEvents, merchantFinancialAccounts, merchantLedgerEntries, merchantPayoutRequests, orders, paymentReceipts, products, stores } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { invalidatePrivateApiCacheTags } from "@/lib/cache/private-api-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

const schema = z.object({
  reason: z.string().trim().min(3).max(1_000),
  confirmationStoreNumber: z.string().trim().min(1)
});

/** Hard-delete only abandoned pending stores. Operational stores must use the normal close flow. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdminOperation(session, "stores.incomplete.delete");
    const payload = schema.parse(await request.json());
    const [store] = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
    if (!store) return fail("المتجر غير موجود", 404);
    if (payload.confirmationStoreNumber !== store.storeNumber) return fail("رمز تأكيد المتجر غير مطابق", 422);

    const [ordersCount, receiptsCount, financialAccountsCount, ledgerCount, payoutsCount, integrationEventsCount, productsCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.storeId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(paymentReceipts).where(eq(paymentReceipts.storeId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(merchantFinancialAccounts).where(eq(merchantFinancialAccounts.storeId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(merchantLedgerEntries).where(eq(merchantLedgerEntries.storeId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(merchantPayoutRequests).where(eq(merchantPayoutRequests.storeId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(integrationEvents).where(eq(integrationEvents.storeId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(products).where(eq(products.storeId, id))
    ]);
    const evidence = {
      status: store.status,
      isActive: store.isActive,
      profileCompleteness: store.profileCompleteness,
      orders: Number(ordersCount[0]?.count || 0),
      paymentReceipts: Number(receiptsCount[0]?.count || 0),
      financialAccounts: Number(financialAccountsCount[0]?.count || 0),
      ledgerEntries: Number(ledgerCount[0]?.count || 0),
      payouts: Number(payoutsCount[0]?.count || 0),
      integrationEvents: Number(integrationEventsCount[0]?.count || 0),
      products: Number(productsCount[0]?.count || 0)
    };
    const operationalEvidence = evidence.orders + evidence.paymentReceipts + evidence.financialAccounts + evidence.ledgerEntries + evidence.payouts + evidence.integrationEvents;
    if (store.status !== "pending" || operationalEvidence > 0 || Number(store.orderCount || 0) > 0 || Number(store.salesTotal || 0) > 0) {
      return fail("لا يمكن حذف هذا المتجر نهائياً لأنه ليس متجراً غير مكتمل خالياً من العمليات. استخدم الإغلاق/التجميد العادي للحفاظ على السجل.", 409, evidence);
    }

    await db.transaction(async (tx) => {
      // Products/media/settings that belong only to an abandoned pending store are removed by FK cascade.
      await tx.delete(stores).where(and(eq(stores.id, id), eq(stores.status, "pending")));
    });
    await writeAuditLog({ actorId: session.userId, action: "delete", category: "administrative", entityType: "store.incomplete_hard_delete", entityId: id, beforeData: store, afterData: { hardDeleted: true, reason: payload.reason, evidence } });
    await invalidatePrivateApiCacheTags(["admin:stores"]);
    await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.stores, PUBLIC_CACHE_TAGS.storeSlug(store.slug), PUBLIC_CACHE_TAGS.products], paths: ["/", `/store/${store.slug}`] });
    return ok({ message: "تم حذف المتجر غير المكتمل نهائياً مع الاحتفاظ بسجل تدقيق العملية", evidence });
  } catch (error) {
    return handleApiError(error, "تعذر حذف المتجر غير المكتمل");
  }
}
