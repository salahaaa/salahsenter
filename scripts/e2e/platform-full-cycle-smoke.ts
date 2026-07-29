import "dotenv/config";
import { and, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../../lib/db";
import {
  adminPromotionalOffers,
  announcements,
  auditLogs,
  backgroundJobs,
  categories,
  commissionRules,
  couponRedemptions,
  coupons,
  idempotencyKeys,
  inventoryMovements,
  merchantFinancialAccounts,
  merchantLedgerEntries,
  merchantPayoutRequests,
  news,
  orderInvoices,
  orderItems,
  orderPayments,
  orders,
  orderShipments,
  orderStatusHistory,
  orderStatusDefinitions,
  paymentMethods,
  paymentReceipts,
  permissions,
  productAttributeValues,
  productAttributes,
  productVariantAttributeValues,
  productVariants,
  products,
  reviews,
  wishlists,
  customerAddresses,
  returnRequestItems,
  returnRequests,
  rolePermissions,
  roles,
  shippingMethods,
  storeMedia,
  stores,
  storeOfferCollections,
  storeOfferItems,
  units,
  userRoles,
  users,
  wings,
  platformEmployees,
  storeEmployees
} from "../../lib/db/schema";
import { hashPassword } from "../../lib/auth";
import { reserveOrderStock } from "../../lib/inventory/atomic-inventory";
import { beginIdempotentRequest, completeIdempotentRequest, hashRequestPayload } from "../../lib/orders/idempotency";
import { settleClosedPaidOrder, recordRefundLedger } from "../../lib/finance/settlements";
import { enqueueJob, processDueJobs } from "../../lib/queue";
import { smartSearch } from "../../lib/smart-search";

if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production" || process.env.VERCEL_ENV === "production") {
  throw new Error("E2E full-cycle writes are permanently blocked in production.");
}
if (process.env.E2E_ALLOW_STAGING_WRITE !== "true") {
  throw new Error("E2E full-cycle writes are disabled. Set E2E_ALLOW_STAGING_WRITE=true only on a dedicated staging/test database.");
}

const runId = `E2E-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${nanoid(6)}`;
const password = `Test-${nanoid(10)}!`;

type Check = { name: string; ok: boolean; details?: unknown };
const checks: Check[] = [];
function check(name: string, ok: boolean, details?: unknown) {
  checks.push({ name, ok, details });
  console.log(`${ok ? "✓" : "✗"} ${name}${details ? ` — ${JSON.stringify(details)}` : ""}`);
}

async function ensurePermission(code: string, name = code, group = "e2e") {
  const [existing] = await db.select().from(permissions).where(eq(permissions.code, code)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(permissions).values({ code, name, group }).returning();
  return created;
}
async function ensureRole(input: { name: string; code: string; scope: "system" | "store"; permissionCodes: string[] }) {
  let [role] = await db.select().from(roles).where(eq(roles.code, input.code)).limit(1);
  if (!role) [role] = await db.insert(roles).values({ name: input.name, code: input.code, scope: input.scope, isSystem: false }).returning();
  const perms = await db.select().from(permissions).where(inArray(permissions.code, input.permissionCodes));
  if (perms.length) {
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    await db.insert(rolePermissions).values(perms.map((p) => ({ roleId: role.id, permissionId: p.id }))).onConflictDoNothing();
  }
  return role;
}
async function createUser(email: string, fullName: string, phone?: string) {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(users).values({ fullName, email, phone, passwordHash: await hashPassword(password), status: "active", emailVerifiedAt: new Date() }).returning();
  return created;
}

async function ensureOrderStatuses() {
  const defs = [
    { code: "new", name: "جديد", allowedNextCodes: ["confirmed", "cancelled"] },
    { code: "confirmed", name: "مؤكد", allowedNextCodes: ["preparing", "cancelled"] },
    { code: "preparing", name: "قيد التجهيز", allowedNextCodes: ["ready_to_ship", "cancelled"] },
    { code: "ready_to_ship", name: "جاهز للشحن", allowedNextCodes: ["shipped", "cancelled"] },
    { code: "shipped", name: "تم الشحن", allowedNextCodes: ["delivered"] },
    { code: "delivered", name: "تم التسليم", allowedNextCodes: ["closed"] },
    { code: "closed", name: "مغلق", allowedNextCodes: [] },
    { code: "cancelled", name: "ملغي", allowedNextCodes: [] }
  ];
  for (const def of defs) await db.insert(orderStatusDefinitions).values({ ...def, isActive: true, sortOrder: defs.findIndex((x) => x.code === def.code) }).onConflictDoNothing();
}

async function main() {
  console.log(`FULL PLATFORM SMOKE TEST: ${runId}`);
  await ensureOrderStatuses();

  const platformPermissionCodes = ["admin.access", "offers.manage", "roles.manage", "reports.view", "stores.manage", "wings.manage", "announcements.manage"];
  const merchantPermissionCodes = ["merchant.access", "products.manage", "inventory.manage", "orders.manage", "store_settings.manage", "announcements.manage", "news.manage", "store_media.manage"];
  for (const code of [...platformPermissionCodes, ...merchantPermissionCodes]) await ensurePermission(code, code, code.includes("merchant") || code.includes("products") ? "store" : "system");
  const adminRole = await ensureRole({ name: `${runId} أدمن تجريبي`, code: `${runId.toLowerCase()}_admin`, scope: "system", permissionCodes: platformPermissionCodes });
  const merchantRole = await ensureRole({ name: `${runId} تاجر تجريبي`, code: `${runId.toLowerCase()}_merchant`, scope: "store", permissionCodes: merchantPermissionCodes });
  const storeEmployeeRole = await ensureRole({ name: `${runId} موظف متجر`, code: `${runId.toLowerCase()}_store_employee`, scope: "store", permissionCodes: ["merchant.access", "products.manage", "orders.manage", "inventory.manage"] });

  const admin = await createUser(`admin-${runId.toLowerCase()}@test.local`, `${runId} مدير منصة`, "+967700000001");
  const merchant = await createUser(`merchant-${runId.toLowerCase()}@test.local`, `${runId} تاجر الطاقة الشمسية`, "+967700000002");
  const customer = await createUser(`customer-${runId.toLowerCase()}@test.local`, `${runId} عميل تجريبي`, "+967700000003");
  const storeEmployeeUser = await createUser(`employee-${runId.toLowerCase()}@test.local`, `${runId} موظف متجر`, "+967700000004");
  const platformEmployeeUser = await createUser(`platform-employee-${runId.toLowerCase()}@test.local`, `${runId} موظف منصة`, "+967700000005");
  await db.insert(userRoles).values({ userId: admin.id, roleId: adminRole.id }).onConflictDoNothing();

  const [wing] = await db.insert(wings).values({ name: `${runId} جناح الطاقة الشمسية`, slug: `${runId.toLowerCase()}-solar-energy`, description: "ألواح، بطاريات، انفرترات، منظمات شحن وتجهيزات الطاقة المتجددة", isActive: true, sortOrder: 1 }).returning();
  check("إنشاء جناح الطاقة الشمسية", Boolean(wing.id), { wingId: wing.id });

  const [store] = await db.insert(stores).values({ merchantId: merchant.id, storeNumber: `SOL-${runId.slice(-6)}`, name: `${runId} متجر حلول الطاقة الشمسية`, slug: `${runId.toLowerCase()}-solar-store`, description: "متجر تجريبي متخصص في الطاقة الشمسية", primaryWingId: wing.id, status: "active", isActive: true, profileCompleteness: 95, contactPhone: "+967700000002", contactEmail: merchant.email }).returning();
  await db.insert(userRoles).values({ userId: merchant.id, roleId: merchantRole.id, storeId: store.id }).onConflictDoNothing();
  check("إنشاء متجر تاجر وربط صلاحياته", Boolean(store.id), { storeId: store.id });

  await db.insert(platformEmployees).values({ userId: platformEmployeeUser.id, directRoleId: adminRole.id, employeeNumber: `ADM-${runId.slice(-6)}`, jobTitle: "مراجع عروض", status: "active" }).onConflictDoNothing();
  await db.insert(userRoles).values({ userId: platformEmployeeUser.id, roleId: adminRole.id }).onConflictDoNothing();
  await db.insert(storeEmployees).values({ storeId: store.id, userId: storeEmployeeUser.id, roleId: storeEmployeeRole.id, employeeCode: `EMP-${runId.slice(-6)}`, jobTitle: "مدير منتجات", status: "active" }).onConflictDoNothing();
  await db.insert(userRoles).values({ userId: storeEmployeeUser.id, roleId: storeEmployeeRole.id, storeId: store.id }).onConflictDoNothing();
  check("إضافة موظف منصة وموظف متجر ومنح الصلاحيات", true);

  const [unit] = await db.insert(units).values({ storeId: store.id, name: "قطعة", symbol: "1 قطعة", isActive: true }).returning();
  const [catPanels] = await db.insert(categories).values({ storeId: store.id, name: "ألواح شمسية", slug: `${runId.toLowerCase()}-solar-panels`, code: "SOL1000", codeMode: "manual", isActive: true, level: 0 }).returning();
  const [catBatteries] = await db.insert(categories).values({ storeId: store.id, name: "بطاريات", slug: `${runId.toLowerCase()}-batteries`, code: "SOL2000", codeMode: "manual", isActive: true, level: 0 }).returning();
  const [attrPower] = await db.insert(productAttributes).values({ storeId: store.id, name: "القدرة", code: `${runId.toLowerCase()}_power`, displayType: "button", isVariantOption: true, isActive: true }).returning();
  const [attrVoltage] = await db.insert(productAttributes).values({ storeId: store.id, name: "الجهد", code: `${runId.toLowerCase()}_voltage`, displayType: "button", isVariantOption: true, isActive: true }).returning();
  const [v550] = await db.insert(productAttributeValues).values({ attributeId: attrPower.id, value: "550W", code: "550W", isActive: true }).returning();
  const [v48] = await db.insert(productAttributeValues).values({ attributeId: attrVoltage.id, value: "48V", code: "48V", isActive: true }).returning();
  check("تهيئة الأصناف والوحدات والمتغيرات لنشاط الطاقة الشمسية", true, { categories: [catPanels.name, catBatteries.name], unit: unit.name });

  const [product] = await db.insert(products).values({ storeId: store.id, categoryId: catPanels.id, name: `${runId} لوح شمسي 550W`, slug: `${runId.toLowerCase()}-solar-panel-550w`, productCode: `P-${runId.slice(-6)}`, codeMode: "manual", shortDescription: "لوح شمسي عالي الكفاءة", description: "منتج تجريبي لدورة شراء كاملة", type: "variable", status: "active", basePrice: "120", mainImageUrl: "", pricingMode: "independent", inventoryMode: "variant", discountPercent: "0" }).returning();
  const [variant] = await db.insert(productVariants).values({ productId: product.id, sku: `SKU-${runId.slice(-6)}-550W-48V`, title: "550W / 48V", unitId: unit.id, price: "120", stockQuantity: 20, lowStockThreshold: 3, attributes: { القدرة: "550W", الجهد: "48V" }, isActive: true }).returning();
  await db.insert(productVariantAttributeValues).values([{ variantId: variant.id, attributeId: attrPower.id, valueId: v550.id }, { variantId: variant.id, attributeId: attrVoltage.id, valueId: v48.id }]).onConflictDoNothing();
  await db.insert(inventoryMovements).values({ storeId: store.id, productId: product.id, variantId: variant.id, type: "add", quantity: 20, beforeQuantity: 0, afterQuantity: 20, reason: `${runId} initial stock`, actorId: merchant.id }).onConflictDoNothing();
  check("إنشاء منتج ومتغير ومخزون", true, { productId: product.id, variantId: variant.id, stock: 20 });

  const [payment] = await db.insert(paymentMethods).values({ storeId: store.id, name: "محفظة إلكترونية تجريبية", code: `${runId.toLowerCase()}_wallet`, provider: "wallet", description: "دفع عبر محفظة محلية", config: { walletName: "محفظة تجريبية", walletNumber: "+967700000002", requiresProof: true, instructions: "حوّل المبلغ ثم ارفع الإيصال" }, isActive: true }).returning();
  const [shipping] = await db.insert(shippingMethods).values({ storeId: store.id, name: "توصيل محلي للطاقة الشمسية", code: `${runId.toLowerCase()}_delivery`, fee: "10", estimatedDaysMin: 1, estimatedDaysMax: 3, isActive: true }).returning();
  check("تهيئة الدفع والشحن", true, { paymentProvider: payment.provider, shippingFee: shipping.fee });

  const [announcement] = await db.insert(announcements).values({ level: "store", storeId: store.id, title: `${runId} إعلان عرض ألواح شمسية`, summary: "خصومات على أنظمة الطاقة", status: "active", isPinned: true, createdBy: merchant.id }).returning();
  const [newsItem] = await db.insert(news).values({ level: "store", storeId: store.id, title: `${runId} وصول دفعة انفرترات`, status: "active", isTicker: true, createdBy: merchant.id }).returning();
  check("إضافة إعلان وخبر للمتجر", true, { announcement: announcement.id, news: newsItem.id });

  const [offer] = await db.insert(storeOfferCollections).values({ storeId: store.id, title: `${runId} باقة لوح شمسي مع توصيل`, description: "عرض تجريبي مجمع", imageUrl: "", status: "approved", startsAt: new Date(), endsAt: new Date(Date.now() + 7 * 86400000), promotionPackage: JSON.stringify({ bundlePrice: 115, offerType: "bundle", publishMode: "direct" }), submittedBy: merchant.id, reviewedBy: admin.id, reviewedAt: new Date() }).returning();
  await db.insert(storeOfferItems).values({ offerId: offer.id, productId: product.id, variantId: variant.id, title: product.name, originalPrice: "120", offerPrice: "115", sortOrder: 0 }).returning();
  const [adminOffer] = await db.insert(adminPromotionalOffers).values({ title: `${runId} إعلان إدارة للطاقة النظيفة`, slug: `${runId.toLowerCase()}-admin-solar-promo`, category: "seasonal", description: "ترويج إداري تجريبي للطاقة الشمسية", status: "active", isFeatured: true, contactPhone: "+967700000001", externalUrl: "https://example.com", createdBy: admin.id }).returning();
  check("إنشاء عرض تاجر وعرض إدارة", true, { offerId: offer.id, adminOfferId: adminOffer.id });

  const [coupon] = await db.insert(coupons).values({ storeId: store.id, code: `${runId.replace(/-/g, "")}`.slice(0, 30), title: "خصم اختبار", discountType: "fixed", discountValue: "5", minOrderAmount: "50", status: "active", createdBy: merchant.id }).returning();

  const requestHash = hashRequestPayload({ userId: customer.id, test: runId, items: [{ variantId: variant.id, quantity: 2 }] });
  const idem = await db.transaction(async (tx) => beginIdempotentRequest(tx, { scope: "orders:create", key: runId, userId: customer.id, requestHash }));
  check("بدء idempotency للطلب", !idem.replay);

  const result = await db.transaction(async (tx) => {
    const subtotal = 240;
    const discount = 5;
    const shippingFee = 10;
    const grandTotal = subtotal - discount + shippingFee;
    const [order] = await tx.insert(orders).values({ orderNumber: `ORD-${runId}`, customerId: customer.id, storeId: store.id, statusCode: "confirmed", paymentStatus: "pending", currency: "YER", subtotal: subtotal.toString(), shippingFee: shippingFee.toString(), discountTotal: discount.toString(), grandTotal: grandTotal.toString(), deliveryAddress: { city: "Aden", addressLine: "E2E test" }, customerNote: "E2E full cycle" }).returning();
    const [item] = await tx.insert(orderItems).values({ orderId: order.id, productId: product.id, variantId: variant.id, productName: product.name, variantTitle: variant.title, sku: variant.sku, productCode: product.productCode, imageUrl: null, productSnapshot: { attributes: variant.attributes, sku: variant.sku, productCode: product.productCode }, quantity: 2, unitPrice: "120", totalPrice: "240" }).returning();
    const [invoice] = await tx.insert(orderInvoices).values({ orderId: order.id, invoiceNumber: `INV-${runId}`, sellerSnapshot: { storeName: store.name }, buyerSnapshot: { customerId: customer.id, fullName: customer.fullName }, totalsSnapshot: { subtotal, discount, shippingFee, grandTotal } }).returning();
    const [pay] = await tx.insert(orderPayments).values({ orderId: order.id, paymentMethodId: payment.id, amount: grandTotal.toString(), status: "pending" }).returning();
    const [ship] = await tx.insert(orderShipments).values({ orderId: order.id, shippingMethodId: shipping.id, status: "pending" }).returning();
    await tx.insert(couponRedemptions).values({ couponId: coupon.id, orderId: order.id, userId: customer.id, storeId: store.id, code: coupon.code, discountAmount: discount.toString() });
    await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(eq(coupons.id, coupon.id));
    await tx.insert(orderStatusHistory).values({ orderId: order.id, fromStatus: null, toStatus: "confirmed", actorId: customer.id, note: "E2E order created" });
    await reserveOrderStock(tx, { storeId: store.id, orderId: order.id, orderNumber: order.orderNumber, actorId: customer.id, items: [{ productId: product.id, variantId: variant.id, quantity: 2, productName: product.name }] });
    await completeIdempotentRequest(tx, { scope: "orders:create", key: runId, responseBody: { order, invoice, items: 1 }, statusCode: 201 });
    return { order, item, invoice, pay, ship };
  });
  const [afterReserve] = await db.select({ stockQuantity: productVariants.stockQuantity, reservedQuantity: productVariants.reservedQuantity }).from(productVariants).where(eq(productVariants.id, variant.id)).limit(1);
  check("إنشاء طلب وحجز المخزون ذرياً", afterReserve.stockQuantity - (afterReserve.reservedQuantity || 0) === 18, { stockAfterReserve: afterReserve.stockQuantity, reservedQuantity: afterReserve.reservedQuantity, availableStock: afterReserve.stockQuantity - (afterReserve.reservedQuantity || 0) });

  const replay = await db.transaction(async (tx) => beginIdempotentRequest(tx, { scope: "orders:create", key: runId, userId: customer.id, requestHash }));
  check("إعادة نفس idempotency تعيد replay ولا تنشئ طلباً", replay.replay === true);

  const [receipt] = await db.insert(paymentReceipts).values({ orderId: result.order.id, orderPaymentId: result.pay.id, userId: customer.id, storeId: store.id, provider: "wallet", transactionReference: `TRX-${runId}`, senderName: customer.fullName, senderPhone: customer.phone, amount: result.order.grandTotal, currency: "YER", proofUrl: "https://example.com/proof.jpg", status: "pending" }).returning();
  await db.update(paymentReceipts).set({ status: "approved", reviewedBy: merchant.id, reviewedAt: new Date() }).where(eq(paymentReceipts.id, receipt.id));
  await db.update(orderPayments).set({ status: "paid", paidAt: new Date(), transactionReference: receipt.transactionReference, providerResponse: { receiptId: receipt.id } }).where(eq(orderPayments.id, result.pay.id));
  await db.update(orders).set({ paymentStatus: "paid" }).where(eq(orders.id, result.order.id));
  check("رفع إثبات دفع وقبوله", true, { receiptId: receipt.id });

  const statusFlow = ["preparing", "ready_to_ship", "shipped", "delivered", "closed"];
  let current = "confirmed";
  for (const next of statusFlow) {
    await db.update(orders).set({ statusCode: next, deliveredAt: next === "delivered" ? new Date() : undefined, updatedAt: new Date() }).where(eq(orders.id, result.order.id));
    await db.insert(orderStatusHistory).values({ orderId: result.order.id, fromStatus: current, toStatus: next, actorId: merchant.id, note: `${runId} status ${next}` });
    current = next;
  }
  await db.update(orderShipments).set({ status: "delivered", carrierName: "E2E Solar Express", trackingNumber: `TRK-${runId}`, shippedAt: new Date(), deliveredAt: new Date() }).where(eq(orderShipments.id, result.ship.id));
  const settlement = await db.transaction(async (tx) => settleClosedPaidOrder(tx, result.order.id, merchant.id));
  check("إغلاق الطلب وتسوية رصيد التاجر", settlement.settled === true, settlement);

  const [review] = await db.insert(reviews).values({ userId: customer.id, storeId: store.id, productId: product.id, rating: 5, comment: `${runId} تقييم تجربة شراء الطاقة الشمسية`, isApproved: true }).returning();
  await db.insert(wishlists).values({ userId: customer.id, productId: product.id, storeId: store.id }).onConflictDoNothing();
  const [address] = await db.insert(customerAddresses).values({ userId: customer.id, label: "عنوان اختبار الطاقة", recipientName: customer.fullName, phone: customer.phone || "+967700000003", cityText: "عدن", districtText: "المنصورة", addressLine: "عنوان تجريبي", isDefault: true }).returning();
  check("تجربة العميل: عنوان + مفضلة + تقييم", true, { reviewId: review.id, addressId: address.id });

  const [returnRequest] = await db.insert(returnRequests).values({ orderId: result.order.id, customerId: customer.id, storeId: store.id, reason: "اختبار إرجاع", description: "إرجاع جزئي تجريبي", refundAmount: "120", status: "requested" }).returning();
  await db.insert(returnRequestItems).values({ returnRequestId: returnRequest.id, orderItemId: result.item.id, quantity: 1, reason: "اختبار", condition: "new" });
  await db.update(returnRequests).set({ status: "refunded", reviewedBy: merchant.id, reviewedAt: new Date(), receivedAt: new Date(), refundedAt: new Date() }).where(eq(returnRequests.id, returnRequest.id));
  await db.update(orderPayments).set({ status: "refunded", providerResponse: { e2eRefund: true }, updatedAt: new Date() }).where(eq(orderPayments.id, result.pay.id));
  await db.update(orders).set({ paymentStatus: "refunded" }).where(eq(orders.id, result.order.id));
  await recordRefundLedger(db, { orderId: result.order.id, amount: 120, reason: `${runId} refund ledger` });
  check("طلب إرجاع واسترداد وتسجيل Ledger", true, { returnRequestId: returnRequest.id });

  const [account] = await db.select().from(merchantFinancialAccounts).where(eq(merchantFinancialAccounts.storeId, store.id)).limit(1);
  const ledger = await db.select().from(merchantLedgerEntries).where(eq(merchantLedgerEntries.storeId, store.id));
  const [payout] = await db.insert(merchantPayoutRequests).values({ storeId: store.id, merchantId: merchant.id, amount: "10", currency: "YER", method: "wallet", destination: { walletNumber: "+967700000002" }, status: "requested" }).returning();
  await db.update(merchantPayoutRequests).set({ status: "approved", reviewedBy: admin.id, reviewedAt: new Date() }).where(eq(merchantPayoutRequests.id, payout.id));
  await db.update(merchantPayoutRequests).set({ status: "paid", paidAt: new Date() }).where(eq(merchantPayoutRequests.id, payout.id));
  check("مالية التاجر: حساب + Ledger + طلب سحب", Boolean(account && ledger.length >= 3 && payout.id), { ledgerCount: ledger.length, payoutId: payout.id });

  await enqueueJob(db, { type: "outbound.message", dedupeKey: `${runId}:outbound`, payload: { channel: "sms", to: customer.phone || "+967700000003", message: `${runId} test outbound` } });
  const jobSummary = await processDueJobs({ limit: 10 });
  check("معالجة background jobs", jobSummary.completed >= 1, jobSummary);

  const search = await smartSearch("طاقة شمسية", { limit: 5 });
  check("البحث الذكي يجد بيانات الطاقة الشمسية", search.products.some((p) => p.id === product.id) || search.stores.some((s) => s.id === store.id) || search.wings.some((w) => w.id === wing.id), { products: search.products.length, stores: search.stores.length, wings: search.wings.length });

  const [negativeStock] = await db.select({ count: sql<number>`count(*)::int` }).from(productVariants).where(sql`${productVariants.stockQuantity} < 0`);
  const duplicateIdempotency = await db.execute(sql`select count(*)::int as count from (select scope, key from idempotency_keys group by scope, key having count(*) > 1) t`);
  const duplicateMovements = await db.execute(sql`select count(*)::int as count from (select reference_id, variant_id, type from inventory_movements where reference_type='order' group by reference_id, variant_id, type having count(*) > 1) t`);
  check("لا يوجد مخزون سالب", Number(negativeStock.count) === 0, { negativeStock: negativeStock.count });
  check("لا يوجد idempotency مكرر", Number((duplicateIdempotency as any)[0]?.count || 0) === 0);
  check("لا توجد حركات مخزون مكررة للطلب", Number((duplicateMovements as any)[0]?.count || 0) === 0);

  await db.insert(auditLogs).values({ actorId: admin.id, action: "create", entityType: "e2e_full_cycle", entityId: runId, afterData: { runId, storeId: store.id, orderId: result.order.id, checks } }).catch(() => undefined);

  const failed = checks.filter((c) => !c.ok);
  console.log("\nSUMMARY", JSON.stringify({ runId, checks: checks.length, failed: failed.length, failedChecks: failed, ids: { wingId: wing.id, storeId: store.id, productId: product.id, variantId: variant.id, orderId: result.order.id }, credentialNote: "Generated E2E credentials are intentionally not printed." }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error("E2E FAILED", error);
  process.exit(1);
});
