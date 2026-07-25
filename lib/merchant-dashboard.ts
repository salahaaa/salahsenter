import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import {
  announcements,
  categories,
  db,
  merchantContracts,
  merchantPlatformStatements,
  news,
  notifications,
  orders,
  paymentMethods,
  products,
  productVariants,
  reviews,
  shippingMethods,
  storeEmployees,
  storeOfferCollections,
  stores
} from "@/lib/db";
import { getMerchantPrimaryStore, hasDatabase } from "@/lib/db/queries";
import { inlineMediaSql } from "@/lib/inline-media";

const TREND_DAYS = 14;

export async function getMerchantDashboardData(userId: string) {
  if (!hasDatabase()) return emptyDashboardData();

  const store = await getMerchantPrimaryStore(userId);
  if (!store) return emptyDashboardData();

  const now = new Date();
  const [ownedStores, statementRows] = await Promise.all([
    db.select({ id: stores.id, name: stores.name, slug: stores.slug, storeNumber: stores.storeNumber, status: stores.status, isActive: stores.isActive, salesTotal: stores.salesTotal, governorateId: stores.governorateId, cityId: stores.cityId }).from(stores).where(eq(stores.merchantId, userId)).orderBy(desc(stores.createdAt)).limit(100),
    db.select({ id: merchantPlatformStatements.id, storeId: merchantPlatformStatements.storeId, statementNumber: merchantPlatformStatements.statementNumber, totalAmount: merchantPlatformStatements.totalAmount, currency: merchantPlatformStatements.currency, status: merchantPlatformStatements.status, dueAt: merchantPlatformStatements.dueAt }).from(merchantPlatformStatements).where(eq(merchantPlatformStatements.merchantId, userId)).orderBy(desc(merchantPlatformStatements.createdAt)).limit(100)
  ]);
  const availableStores = ownedStores.length ? ownedStores : [{ id: store.id, name: store.name, slug: store.slug, storeNumber: store.storeNumber, status: store.status, isActive: store.isActive, salesTotal: store.salesTotal, governorateId: store.governorateId, cityId: store.cityId }];
  const openStatement = (status: string) => !["paid", "settled", "cancelled", "void"].includes(status);
  const currentStatements = statementRows.filter((row) => row.storeId === store.id && openStatement(row.status));
  const totalsByCurrency = (rows: Array<{ totalAmount: string; currency: string }>) => Object.fromEntries(Object.entries(rows.reduce<Record<string, number>>((totals, row) => ({ ...totals, [row.currency]: (totals[row.currency] || 0) + Number(row.totalAmount || 0) }), {})).map(([currency, total]) => [currency, Math.round(total * 100) / 100]));
  const financial = {
    currentOutstandingByCurrency: totalsByCurrency(currentStatements),
    portfolioOutstandingByCurrency: totalsByCurrency(statementRows.filter((row) => openStatement(row.status))),
    openStatements: statementRows.filter((row) => openStatement(row.status)).length,
    nextDueAt: currentStatements.map((row) => row.dueAt).filter(Boolean).sort((a, b) => new Date(a!).getTime() - new Date(b!).getTime())[0] || null
  };
  const portfolio = { storeCount: availableStores.length, activeStoreCount: availableStores.filter((row) => row.status === "active" && row.isActive).length, totalSales: availableStores.reduce((sum, row) => sum + Number(row.salesTotal || 0), 0) };
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const trendStart = new Date(startOfToday);
  trendStart.setDate(trendStart.getDate() - (TREND_DAYS - 1));

  const [
    productsCount,
    activeProductsCount,
    draftProductsCount,
    promotedProductsCount,
    categoriesCount,
    variantsCount,
    activeVariantsCount,
    lowStockCount,
    inventorySnapshot,
    ordersCount,
    newOrdersCount,
    inProgressOrdersCount,
    todayOrdersSummary,
    monthOrdersSummary,
    pendingPaymentsCount,
    salesTotal,
    employeesCount,
    announcementsCount,
    newsCount,
    activePaymentMethodsCount,
    activeShippingMethodsCount,
    approvedOffersCount,
    pendingOffersCount,
    unreadNotificationsCount,
    reviewsSummary,
    recentOrders,
    lowStock,
    topProducts,
    contractRows,
    salesTrendRows,
    orderStatusRows,
    productStatusRows,
    recentNotifications
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(eq(products.storeId, store.id)),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(and(eq(products.storeId, store.id), eq(products.status, "active"))),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(and(eq(products.storeId, store.id), eq(products.status, "draft"))),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(and(eq(products.storeId, store.id), eq(products.isPromoted, true))),
    db.select({ count: sql<number>`count(*)::int` }).from(categories).where(eq(categories.storeId, store.id)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(products.storeId, store.id)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(and(eq(products.storeId, store.id), eq(productVariants.isActive, true))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(and(eq(products.storeId, store.id), sql`${productVariants.stockQuantity} <= ${productVariants.lowStockThreshold}`)),
    db
      .select({
        stock: sql<string>`coalesce(sum(${productVariants.stockQuantity}), 0)::text`,
        value: sql<string>`coalesce(sum(${productVariants.stockQuantity} * ${productVariants.price}), 0)::text`
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(products.storeId, store.id)),
    db.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.storeId, store.id)),
    db.select({ count: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.storeId, store.id), eq(orders.statusCode, "new"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.storeId, store.id), sql`${orders.statusCode} not in ('delivered', 'completed', 'cancelled', 'rejected', 'returned')`)),
    db
      .select({ count: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(${orders.grandTotal}), 0)::text` })
      .from(orders)
      .where(and(eq(orders.storeId, store.id), gte(orders.createdAt, startOfToday))),
    db
      .select({ count: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(${orders.grandTotal}), 0)::text` })
      .from(orders)
      .where(and(eq(orders.storeId, store.id), gte(orders.createdAt, startOfMonth))),
    db.select({ count: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.storeId, store.id), eq(orders.paymentStatus, "pending"))),
    db.select({ total: sql<string>`coalesce(sum(${orders.grandTotal}), 0)::text` }).from(orders).where(eq(orders.storeId, store.id)),
    db.select({ count: sql<number>`count(*)::int` }).from(storeEmployees).where(eq(storeEmployees.storeId, store.id)),
    db.select({ count: sql<number>`count(*)::int` }).from(announcements).where(and(eq(announcements.storeId, store.id), eq(announcements.level, "store"))),
    db.select({ count: sql<number>`count(*)::int` }).from(news).where(and(eq(news.storeId, store.id), eq(news.level, "store"))),
    db.select({ count: sql<number>`count(*)::int` }).from(paymentMethods).where(and(eq(paymentMethods.storeId, store.id), eq(paymentMethods.isActive, true))),
    db.select({ count: sql<number>`count(*)::int` }).from(shippingMethods).where(and(eq(shippingMethods.storeId, store.id), eq(shippingMethods.isActive, true))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(storeOfferCollections)
      .where(
        and(
          eq(storeOfferCollections.storeId, store.id),
          eq(storeOfferCollections.status, "approved"),
          or(isNull(storeOfferCollections.startsAt), lte(storeOfferCollections.startsAt, now)),
          or(isNull(storeOfferCollections.endsAt), gte(storeOfferCollections.endsAt, now))
        )
      ),
    db.select({ count: sql<number>`count(*)::int` }).from(storeOfferCollections).where(and(eq(storeOfferCollections.storeId, store.id), eq(storeOfferCollections.status, "pending_review"))),
    db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
    db
      .select({ count: sql<number>`count(*)::int`, average: sql<string>`coalesce(avg(${reviews.rating}), 0)::text` })
      .from(reviews)
      .where(eq(reviews.storeId, store.id)),
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        statusCode: orders.statusCode,
        paymentStatus: orders.paymentStatus,
        currency: orders.currency,
        grandTotal: orders.grandTotal,
        createdAt: orders.createdAt,
        customerId: orders.customerId
      })
      .from(orders)
      .where(eq(orders.storeId, store.id))
      .orderBy(desc(orders.createdAt))
      .limit(6),
    db
      .select({
        variantId: productVariants.id,
        sku: productVariants.sku,
        title: productVariants.title,
        stockQuantity: productVariants.stockQuantity,
        lowStockThreshold: productVariants.lowStockThreshold,
        productName: products.name,
        productSlug: products.slug,
        imageUrl: inlineMediaSql("productVariants", productVariants.id, "imageUrl", productVariants.imageUrl),
        productImageUrl: inlineMediaSql("products", products.id, "mainImageUrl", products.mainImageUrl)
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(and(eq(products.storeId, store.id), sql`${productVariants.stockQuantity} <= ${productVariants.lowStockThreshold}`))
      .orderBy(productVariants.stockQuantity)
      .limit(8),
    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        soldCount: products.soldCount,
        viewCount: products.viewCount,
        ratingAverage: products.ratingAverage,
        status: products.status,
        mainImageUrl: inlineMediaSql("products", products.id, "mainImageUrl", products.mainImageUrl)
      })
      .from(products)
      .where(eq(products.storeId, store.id))
      .orderBy(desc(products.soldCount), desc(products.viewCount), desc(products.ratingAverage))
      .limit(6),
    db
      .select({
        id: merchantContracts.id,
        contractNumber: merchantContracts.contractNumber,
        title: merchantContracts.title,
        status: merchantContracts.status,
        startAt: merchantContracts.startAt,
        endAt: merchantContracts.endAt
      })
      .from(merchantContracts)
      .where(eq(merchantContracts.storeId, store.id))
      .orderBy(desc(merchantContracts.createdAt))
      .limit(1),
    db
      .select({
        day: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${orders.grandTotal}), 0)::text`
      })
      .from(orders)
      .where(and(eq(orders.storeId, store.id), gte(orders.createdAt, trendStart)))
      .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`),
    db
      .select({ status: orders.statusCode, count: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(${orders.grandTotal}), 0)::text` })
      .from(orders)
      .where(eq(orders.storeId, store.id))
      .groupBy(orders.statusCode),
    db
      .select({ status: products.status, count: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.storeId, store.id))
      .groupBy(products.status),
    db
      .select({ id: notifications.id, title: notifications.title, body: notifications.body, type: notifications.type, readAt: notifications.readAt, createdAt: notifications.createdAt })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(6)
  ]);

  const contract = contractRows[0] || null;
  const contractRemainingDays = contract ? Math.ceil((new Date(contract.endAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const metrics = {
    products: Number(productsCount[0]?.count || 0),
    activeProducts: Number(activeProductsCount[0]?.count || 0),
    draftProducts: Number(draftProductsCount[0]?.count || 0),
    promotedProducts: Number(promotedProductsCount[0]?.count || 0),
    categories: Number(categoriesCount[0]?.count || 0),
    variants: Number(variantsCount[0]?.count || 0),
    activeVariants: Number(activeVariantsCount[0]?.count || 0),
    lowStock: Number(lowStockCount[0]?.count || 0),
    availableStock: Number(inventorySnapshot[0]?.stock || 0),
    inventoryValue: Number(inventorySnapshot[0]?.value || 0),
    orders: Number(ordersCount[0]?.count || 0),
    newOrders: Number(newOrdersCount[0]?.count || 0),
    inProgressOrders: Number(inProgressOrdersCount[0]?.count || 0),
    todayOrders: Number(todayOrdersSummary[0]?.count || 0),
    todaySales: Number(todayOrdersSummary[0]?.total || 0),
    monthOrders: Number(monthOrdersSummary[0]?.count || 0),
    monthSales: Number(monthOrdersSummary[0]?.total || 0),
    pendingPayments: Number(pendingPaymentsCount[0]?.count || 0),
    salesTotal: Number(salesTotal[0]?.total || 0),
    employees: Number(employeesCount[0]?.count || 0),
    announcements: Number(announcementsCount[0]?.count || 0),
    news: Number(newsCount[0]?.count || 0),
    activePaymentMethods: Number(activePaymentMethodsCount[0]?.count || 0),
    activeShippingMethods: Number(activeShippingMethodsCount[0]?.count || 0),
    activeOffers: Number(approvedOffersCount[0]?.count || 0),
    pendingOffers: Number(pendingOffersCount[0]?.count || 0),
    unreadNotifications: Number(unreadNotificationsCount[0]?.count || 0),
    reviews: Number(reviewsSummary[0]?.count || 0),
    ratingAverage: Number(reviewsSummary[0]?.average || 0)
  };

  const storeHealth = buildStoreHealth(store, metrics, contract, contractRemainingDays);
  const readinessTotalWeight = storeHealth.reduce((sum, item) => sum + item.weight, 0);
  const readinessCompletedWeight = storeHealth.reduce((sum, item) => sum + (item.ok ? item.weight : 0), 0);
  const readiness = {
    score: readinessTotalWeight ? Math.round((readinessCompletedWeight / readinessTotalWeight) * 100) : 0,
    completed: storeHealth.filter((item) => item.ok).length,
    total: storeHealth.length
  };

  const operationalAlerts = buildOperationalAlerts(store, metrics, contract, contractRemainingDays);
  const dailyWorkQueue = buildDailyWorkQueue(metrics);
  const quickWins = storeHealth
    .filter((item) => !item.ok)
    .slice(0, 5)
    .map((item) => ({ title: item.label, description: item.hint, href: item.actionHref, actionLabel: item.actionLabel, severity: item.severity }));

  const salesTrend = fillSalesTrend(salesTrendRows, trendStart);
  const orderStatusBreakdown = orderStatusRows
    .map((row) => ({ status: row.status, count: Number(row.count || 0), total: Number(row.total || 0) }))
    .sort((a, b) => b.count - a.count);
  const productStatusBreakdown = productStatusRows
    .map((row) => ({ status: row.status, count: Number(row.count || 0) }))
    .sort((a, b) => b.count - a.count);

  return {
    store,
    metrics,
    recentOrders,
    lowStock,
    topProducts,
    contract,
    contractRemainingDays,
    storeHealth,
    readiness,
    salesTrend,
    orderStatusBreakdown,
    productStatusBreakdown,
    recentNotifications,
    operationalAlerts,
    dailyWorkQueue,
    quickWins,
    availableStores,
    portfolio,
    financial
  };
}

function buildStoreHealth(
  store: typeof stores.$inferSelect,
  metrics: ReturnType<typeof emptyMetrics>,
  contract: { id: string; status: string; startAt: Date; endAt: Date } | null,
  contractRemainingDays: number | null
) {
  return [
    {
      key: "profile",
      label: "هوية المتجر وبيانات التواصل",
      ok: Boolean(store.description && store.contactPhone && store.contactEmail),
      hint: "أكمل الوصف ورقم الجوال والبريد ليظهر المتجر بشكل موثوق.",
      actionHref: "/merchant/settings",
      actionLabel: "تعديل البيانات",
      severity: "high" as const,
      weight: 14
    },
    {
      key: "media",
      label: "الشعار والغلاف والوسائط",
      ok: Boolean(store.coverImageUrl && store.logoUrl),
      hint: "ارفع شعاراً واضحاً وغلافاً احترافياً لرفع معدل الثقة.",
      actionHref: "/merchant/media",
      actionLabel: "إدارة الوسائط",
      severity: "medium" as const,
      weight: 12
    },
    {
      key: "catalog",
      label: "كتالوج منتجات نشط",
      ok: metrics.activeProducts > 0,
      hint: "أضف منتجات نشطة بصور وأسعار ومتغيرات قابلة للشراء.",
      actionHref: "/merchant/products",
      actionLabel: "إضافة منتج",
      severity: "high" as const,
      weight: 16
    },
    {
      key: "taxonomy",
      label: "الأصناف والخصائص",
      ok: metrics.categories > 0,
      hint: "رتّب منتجاتك داخل أصناف وخصائص لتسهيل تصفح العملاء.",
      actionHref: "/merchant/product-taxonomy",
      actionLabel: "ضبط الأصناف",
      severity: "medium" as const,
      weight: 8
    },
    {
      key: "inventory",
      label: "مخزون صحي",
      ok: metrics.activeProducts === 0 ? true : metrics.lowStock === 0,
      hint: "راجع المنتجات قرب النفاد حتى لا تتوقف المبيعات.",
      actionHref: "/merchant/inventory",
      actionLabel: "تحديث المخزون",
      severity: metrics.lowStock > 0 ? ("high" as const) : ("low" as const),
      weight: 12
    },
    {
      key: "payments",
      label: "طرق دفع مفعلة",
      ok: metrics.activePaymentMethods > 0,
      hint: "فعّل طريقة دفع واحدة على الأقل ليستطيع العميل إكمال الطلب.",
      actionHref: "/merchant/operations-settings",
      actionLabel: "إعداد الدفع",
      severity: "high" as const,
      weight: 10
    },
    {
      key: "shipping",
      label: "طرق شحن وتسليم",
      ok: metrics.activeShippingMethods > 0,
      hint: "أضف خيارات الشحن والتسليم ورسومها المتوقعة.",
      actionHref: "/merchant/operations-settings",
      actionLabel: "إعداد الشحن",
      severity: "high" as const,
      weight: 10
    },
    {
      key: "contract",
      label: "العقد والتفعيل",
      ok: Boolean(contract && ["active", "grace", "near_expiry", "renewal_requested"].includes(contract.status) && (contractRemainingDays === null || contractRemainingDays >= 0)),
      hint: "تابع حالة العقد واطلب التجديد قبل انتهاء المدة.",
      actionHref: "/merchant/onboarding",
      actionLabel: "إدارة العقد",
      severity: "high" as const,
      weight: 10
    },
    {
      key: "marketing",
      label: "حضور تسويقي داخل المتجر",
      ok: metrics.announcements > 0 || metrics.news > 0 || metrics.activeOffers > 0,
      hint: "أضف إعلاناً أو خبراً أو عرضاً لزيادة التفاعل داخل المتجر.",
      actionHref: "/merchant/announcements",
      actionLabel: "إدارة التسويق",
      severity: "low" as const,
      weight: 5
    },
    {
      key: "team",
      label: "فريق العمل والصلاحيات",
      ok: metrics.employees > 0,
      hint: "أضف موظفين بصلاحيات محددة لتوزيع المهام التشغيلية.",
      actionHref: "/merchant/employees",
      actionLabel: "إدارة الموظفين",
      severity: "low" as const,
      weight: 3
    }
  ];
}

function buildOperationalAlerts(
  store: typeof stores.$inferSelect,
  metrics: ReturnType<typeof emptyMetrics>,
  contract: { id: string; status: string; startAt: Date; endAt: Date } | null,
  contractRemainingDays: number | null
) {
  const alerts: Array<{ title: string; description: string; href: string; severity: "danger" | "warning" | "info" | "success" }> = [];

  if (store.status !== "active" || !store.isActive) {
    alerts.push({ title: "المتجر غير مفعل بالكامل", description: "لن يظهر المتجر للعملاء إلا بعد تفعيل الحالة من الإدارة.", href: "/merchant/onboarding", severity: "danger" });
  }
  if (!contract) {
    alerts.push({ title: "لا يوجد عقد نشط مرتبط", description: "راجع صفحة العقد والاعتماد للتأكد من اكتمال ملف المتجر.", href: "/merchant/onboarding", severity: "warning" });
  } else if (contractRemainingDays !== null && contractRemainingDays < 0) {
    alerts.push({ title: "العقد منتهي", description: "اطلب التجديد أو راجع الإدارة لإعادة تفعيل المتجر.", href: "/merchant/onboarding", severity: "danger" });
  } else if (contractRemainingDays !== null && contractRemainingDays <= 30) {
    alerts.push({ title: "العقد يقترب من الانتهاء", description: `متبقي ${contractRemainingDays} يوم. ابدأ طلب التجديد الآن.`, href: "/merchant/onboarding", severity: "warning" });
  }
  if (metrics.newOrders > 0) {
    alerts.push({ title: "طلبات جديدة تحتاج متابعة", description: `${metrics.newOrders} طلب جديد بانتظار الإجراء.`, href: "/merchant/orders", severity: "info" });
  }
  if (metrics.pendingPayments > 0) {
    alerts.push({ title: "مدفوعات معلقة", description: `${metrics.pendingPayments} طلب يحتاج تأكيد الدفع أو المتابعة.`, href: "/merchant/orders", severity: "warning" });
  }
  if (metrics.lowStock > 0) {
    alerts.push({ title: "منتجات قاربت على النفاد", description: `${metrics.lowStock} متغير/منتج يحتاج تعزيز مخزون.`, href: "/merchant/inventory", severity: "warning" });
  }
  if (metrics.activePaymentMethods === 0) {
    alerts.push({ title: "لا توجد طريقة دفع مفعلة", description: "فعّل طريقة دفع ليتمكن العملاء من إكمال الطلب.", href: "/merchant/operations-settings", severity: "danger" });
  }
  if (metrics.activeShippingMethods === 0) {
    alerts.push({ title: "لا توجد طريقة شحن مفعلة", description: "أضف طريقة شحن أو تسليم محلي قبل استقبال الطلبات.", href: "/merchant/operations-settings", severity: "danger" });
  }
  if (metrics.activeProducts === 0) {
    alerts.push({ title: "لا توجد منتجات نشطة", description: "أضف أول منتج نشط ليصبح المتجر قابلاً للبيع.", href: "/merchant/products", severity: "danger" });
  }
  if (metrics.pendingOffers > 0) {
    alerts.push({ title: "عروض بانتظار مراجعة الإدارة", description: `${metrics.pendingOffers} عرض قيد المراجعة وسيظهر بعد الاعتماد.`, href: "/merchant/offers", severity: "info" });
  }

  return alerts.slice(0, 8);
}

function buildDailyWorkQueue(metrics: ReturnType<typeof emptyMetrics>) {
  const tasks: Array<{ key: string; title: string; description: string; count: number; href: string; priority: "critical" | "high" | "normal" }> = [];
  if (metrics.newOrders) tasks.push({ key: "new_orders", title: "طلبات جديدة", description: "اقبل الطلب أو ارفضه بسرعة حتى لا يفقد العميل الثقة.", count: metrics.newOrders, href: "/merchant/orders", priority: "critical" });
  if (metrics.pendingPayments) tasks.push({ key: "pending_payments", title: "طلبات نقدية/مدفوعات معلقة", description: "راجع حالة الطلبات قبل التسليم أو الإغلاق.", count: metrics.pendingPayments, href: "/merchant/orders", priority: "high" });
  if (metrics.lowStock) tasks.push({ key: "low_stock", title: "مخزون منخفض", description: "عدّل المخزون أو أوقف الصنف قبل نفاده.", count: metrics.lowStock, href: "/merchant/inventory", priority: "high" });
  if (metrics.draftProducts) tasks.push({ key: "draft_products", title: "منتجات مسودة", description: "أكمل السعر والصور ثم انشر المنتجات الجاهزة للبيع.", count: metrics.draftProducts, href: "/merchant/products?status=draft", priority: "normal" });
  if (metrics.pendingOffers) tasks.push({ key: "pending_offers", title: "عروض بانتظار الاعتماد", description: "راجع بيانات العرض أو انتظر قرار الإدارة.", count: metrics.pendingOffers, href: "/merchant/offers", priority: "normal" });
  if (metrics.unreadNotifications) tasks.push({ key: "notifications", title: "إشعارات غير مقروءة", description: "راجع رسائل العملاء والإدارة والتشغيل.", count: metrics.unreadNotifications, href: "/notifications", priority: "normal" });
  return tasks;
}

function fillSalesTrend(rows: Array<{ day: string; count: number; total: string }>, trendStart: Date) {
  const byDay = new Map(rows.map((row) => [row.day, { orders: Number(row.count || 0), sales: Number(row.total || 0) }]));
  return Array.from({ length: TREND_DAYS }, (_, index) => {
    const date = new Date(trendStart);
    date.setDate(trendStart.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    const value = byDay.get(key) || { orders: 0, sales: 0 };
    return {
      key,
      label: new Intl.DateTimeFormat("ar", { day: "numeric", month: "short" }).format(date),
      orders: value.orders,
      sales: value.sales
    };
  });
}

function emptyDashboardData() {
  return {
    store: null,
    metrics: emptyMetrics(),
    recentOrders: [],
    lowStock: [],
    topProducts: [],
    contract: null,
    contractRemainingDays: null,
    storeHealth: [],
    readiness: { score: 0, completed: 0, total: 0 },
    salesTrend: [],
    orderStatusBreakdown: [],
    productStatusBreakdown: [],
    recentNotifications: [],
    operationalAlerts: [],
    dailyWorkQueue: [],
    quickWins: [],
    availableStores: [],
    portfolio: { storeCount: 0, activeStoreCount: 0, totalSales: 0 },
    financial: { currentOutstandingByCurrency: {}, portfolioOutstandingByCurrency: {}, openStatements: 0, nextDueAt: null }
  };
}

function emptyMetrics() {
  return {
    products: 0,
    activeProducts: 0,
    draftProducts: 0,
    promotedProducts: 0,
    categories: 0,
    variants: 0,
    activeVariants: 0,
    lowStock: 0,
    availableStock: 0,
    inventoryValue: 0,
    orders: 0,
    newOrders: 0,
    inProgressOrders: 0,
    todayOrders: 0,
    todaySales: 0,
    monthOrders: 0,
    monthSales: 0,
    pendingPayments: 0,
    salesTotal: 0,
    employees: 0,
    announcements: 0,
    news: 0,
    activePaymentMethods: 0,
    activeShippingMethods: 0,
    activeOffers: 0,
    pendingOffers: 0,
    unreadNotifications: 0,
    reviews: 0,
    ratingAverage: 0
  };
}
