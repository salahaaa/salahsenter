import { and, desc, eq, sql } from "drizzle-orm";
import {
  auditLogs,
  db,
  inventoryMovements,
  merchantApplications,
  merchantContracts,
  orders,
  productVariants,
  products,
  storeOfferCollections,
  stores,
  users,
  wings
} from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";

export async function getAdminCommandCenterData() {
  if (!hasDatabase()) {
    return {
      metrics: emptyMetrics(),
      pendingApplications: [],
      nearExpiryContracts: [],
      pendingOffers: [],
      frozenStores: [],
      lowStock: [],
      recentAudit: [],
      readiness: []
    };
  }

  const [
    usersCount,
    storesCount,
    activeStoresCount,
    productsCount,
    ordersCount,
    pendingApplicationsCount,
    pendingOffersCount,
    frozenStoresCount,
    nearExpiryContractsCount,
    pendingApplications,
    nearExpiryContracts,
    pendingOffers,
    frozenStores,
    lowStock,
    recentAudit
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(users),
    db.select({ count: sql<number>`count(*)::int` }).from(stores),
    db.select({ count: sql<number>`count(*)::int` }).from(stores).where(and(eq(stores.status, "active"), eq(stores.isActive, true))),
    db.select({ count: sql<number>`count(*)::int` }).from(products),
    db.select({ count: sql<number>`count(*)::int` }).from(orders),
    db.select({ count: sql<number>`count(*)::int` }).from(merchantApplications).where(sql`${merchantApplications.status} in ('pending','new','under_review','documents_required','pre_approved','contract_created','contract_signed','waiting_final_approval')`),
    db.select({ count: sql<number>`count(*)::int` }).from(storeOfferCollections).where(eq(storeOfferCollections.status, "pending_review")),
    db.select({ count: sql<number>`count(*)::int` }).from(stores).where(eq(stores.status, "frozen")),
    db.select({ count: sql<number>`count(*)::int` }).from(merchantContracts).where(sql`${merchantContracts.status} in ('active','near_expiry','grace','renewal_requested') and ${merchantContracts.endAt} <= now() + (${merchantContracts.alertBeforeDays} || ' days')::interval`),
    db.select().from(merchantApplications).where(sql`${merchantApplications.status} in ('pending','new','under_review','documents_required','pre_approved','contract_created','contract_signed','waiting_final_approval')`).orderBy(desc(merchantApplications.createdAt)).limit(8),
    db
      .select({ contract: merchantContracts, storeName: stores.name, storeNumber: stores.storeNumber })
      .from(merchantContracts)
      .innerJoin(stores, eq(merchantContracts.storeId, stores.id))
      .where(sql`${merchantContracts.status} in ('active','near_expiry','grace','renewal_requested') and ${merchantContracts.endAt} <= now() + (${merchantContracts.alertBeforeDays} || ' days')::interval`)
      .orderBy(merchantContracts.endAt)
      .limit(8),
    db
      .select({ offer: storeOfferCollections, storeName: stores.name, storeNumber: stores.storeNumber })
      .from(storeOfferCollections)
      .innerJoin(stores, eq(storeOfferCollections.storeId, stores.id))
      .where(eq(storeOfferCollections.status, "pending_review"))
      .orderBy(desc(storeOfferCollections.createdAt))
      .limit(8),
    db.select().from(stores).where(eq(stores.status, "frozen")).orderBy(desc(stores.updatedAt)).limit(8),
    db
      .select({ variant: productVariants, productName: products.name, storeName: stores.name })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .innerJoin(stores, eq(products.storeId, stores.id))
      .where(sql`${productVariants.stockQuantity} <= ${productVariants.lowStockThreshold}`)
      .orderBy(productVariants.stockQuantity)
      .limit(8),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(10)
  ]);

  const metrics = {
    users: Number(usersCount[0]?.count || 0),
    stores: Number(storesCount[0]?.count || 0),
    activeStores: Number(activeStoresCount[0]?.count || 0),
    products: Number(productsCount[0]?.count || 0),
    orders: Number(ordersCount[0]?.count || 0),
    pendingApplications: Number(pendingApplicationsCount[0]?.count || 0),
    pendingOffers: Number(pendingOffersCount[0]?.count || 0),
    frozenStores: Number(frozenStoresCount[0]?.count || 0),
    nearExpiryContracts: Number(nearExpiryContractsCount[0]?.count || 0)
  };

  const readiness = [
    { title: "قاعدة البيانات", ok: true, description: "الاتصال بقاعدة البيانات يعمل" },
    { title: "المتاجر النشطة", ok: metrics.activeStores > 0, description: metrics.activeStores > 0 ? "توجد متاجر نشطة" : "لا توجد متاجر نشطة بعد" },
    { title: "المنتجات", ok: metrics.products > 0, description: metrics.products > 0 ? "توجد منتجات في النظام" : "لا توجد منتجات بعد" },
    { title: "طلبات التجار", ok: metrics.pendingApplications === 0, description: metrics.pendingApplications ? "توجد طلبات تحتاج مراجعة" : "لا توجد طلبات معلقة" },
    { title: "العقود", ok: metrics.nearExpiryContracts === 0, description: metrics.nearExpiryContracts ? "توجد عقود قريبة الانتهاء" : "لا توجد عقود قريبة الانتهاء" }
  ];

  return { metrics, pendingApplications, nearExpiryContracts, pendingOffers, frozenStores, lowStock, recentAudit, readiness };
}

function emptyMetrics() {
  return { users: 0, stores: 0, activeStores: 0, products: 0, orders: 0, pendingApplications: 0, pendingOffers: 0, frozenStores: 0, nearExpiryContracts: 0 };
}
