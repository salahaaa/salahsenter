import "dotenv/config";
import { eq, like, or, inArray, sql } from "drizzle-orm";
import {
  client,
  db,
  stores,
  users,
  userRoles,
  merchants,
  merchantApplications,
  merchantApplicationDocuments,
  merchantApplicationDocumentRequirements,
  merchantApplicationArchives,
  merchantContracts,
  merchantRevenueTerms,
  storeRentalAgreements,
  storeRentalAddonAssignments,
  storeWings,
  storeMedia,
  storeEmployees,
  products,
  productVariants,
  inventoryMovements,
  coupons,
  offerCampaigns,
  orders,
  orderItems,
  contractEvents
} from "@/lib/db";

async function runCleanup() {
  console.log("=== بدء حذف المتاجر الجديدة وحسابات إيميلات التجار لإتاحة استخدامها من جديد ===");

  // 1. Identify users to delete: m777017092@gmail.com and any test.local e2e users
  const targetUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(or(eq(users.email, "m777017092@gmail.com"), like(users.email, "%@test.local")));

  const targetUserIds = targetUsers.map((u) => u.id);
  const targetEmails = targetUsers.map((u) => u.email);

  console.log(`Found ${targetUserIds.length} users to clean up:`, targetEmails);

  if (targetUserIds.length) {
    // 2. Find associated stores
    const targetStores = await db
      .select({ id: stores.id, name: stores.name })
      .from(stores)
      .where(or(inArray(stores.merchantId, targetUserIds), like(stores.name, "E2E-%"), eq(stores.name, "صلاح للالكترونيات")));

    const targetStoreIds = targetStores.map((s) => s.id);
    console.log(`Found ${targetStoreIds.length} stores to delete:`, targetStores.map((s) => s.name));

    if (targetStoreIds.length) {
      // Delete store child records
      await db.delete(orderItems).where(inArray(orderItems.storeId, targetStoreIds));
      await db.delete(orders).where(inArray(orders.storeId, targetStoreIds));
      await db.delete(coupons).where(inArray(coupons.storeId, targetStoreIds));
      await db.delete(offerCampaigns).where(inArray(offerCampaigns.storeId, targetStoreIds));
      await db.delete(inventoryMovements).where(inArray(inventoryMovements.storeId, targetStoreIds));
      await db.delete(productVariants).where(inArray(productVariants.storeId, targetStoreIds));
      await db.delete(products).where(inArray(products.storeId, targetStoreIds));
      await db.delete(storeEmployees).where(inArray(storeEmployees.storeId, targetStoreIds));
      await db.delete(storeMedia).where(inArray(storeMedia.storeId, targetStoreIds));
      await db.delete(storeWings).where(inArray(storeWings.storeId, targetStoreIds));
      await db.delete(storeRentalAddonAssignments).where(inArray(storeRentalAddonAssignments.storeId, targetStoreIds));
      await db.delete(storeRentalAgreements).where(inArray(storeRentalAgreements.storeId, targetStoreIds));
      await db.delete(merchantRevenueTerms).where(inArray(merchantRevenueTerms.storeId, targetStoreIds));
      await db.delete(contractEvents).where(inArray(contractEvents.storeId, targetStoreIds));
      await db.delete(merchantContracts).where(inArray(merchantContracts.storeId, targetStoreIds));
      await db.delete(stores).where(inArray(stores.id, targetStoreIds));
      console.log("✓ All store records deleted.");
    }

    // 3. Find and delete merchant applications for these users/emails
    const targetApps = await db
      .select({ id: merchantApplications.id })
      .from(merchantApplications)
      .where(
        or(
          inArray(merchantApplications.applicantUserId, targetUserIds),
          eq(merchantApplications.applicantEmail, "m777017092@gmail.com"),
          eq(merchantApplications.applicantEmail, "admin@mall.com"),
          like(merchantApplications.applicantEmail, "%@test.local")
        )
      );

    const targetAppIds = targetApps.map((a) => a.id);
    if (targetAppIds.length) {
      await db.delete(merchantApplicationDocuments).where(inArray(merchantApplicationDocuments.applicationId, targetAppIds));
      await db.delete(merchantApplicationDocumentRequirements).where(inArray(merchantApplicationDocumentRequirements.applicationId, targetAppIds));
      await db.delete(merchantApplicationArchives).where(inArray(merchantApplicationArchives.applicationId, targetAppIds));
      await db.delete(merchantContracts).where(inArray(merchantContracts.applicationId, targetAppIds));
      await db.delete(merchants).where(inArray(merchants.applicationId, targetAppIds));
      await db.delete(merchantApplications).where(inArray(merchantApplications.id, targetAppIds));
      console.log(`✓ Deleted ${targetAppIds.length} merchant applications.`);
    }

    // 4. Delete user roles and users
    await db.delete(merchants).where(inArray(merchants.userId, targetUserIds));
    await db.delete(userRoles).where(inArray(userRoles.userId, targetUserIds));
    await db.delete(users).where(inArray(users.id, targetUserIds));
    console.log("✓ Users deleted successfully.");
  }

  // Verify remaining users and stores
  const remainingUsers = await db.select({ id: users.id, email: users.email, name: users.fullName }).from(users);
  const remainingStores = await db.select({ id: stores.id, name: stores.name }).from(stores);
  const remainingApps = await db.select({ id: merchantApplications.id, storeName: merchantApplications.storeName }).from(merchantApplications);

  console.log("\n=== النتيجة النهائية بعد التنظيف ===");
  console.log("المستخدمون المتبقون في النظام:", remainingUsers.map((u) => `${u.name} (${u.email})`));
  console.log("المتاجر المتبقية في المول:", remainingStores.length ? remainingStores.map((s) => s.name) : "0 متاجر (نظيف بالكامل)");
  console.log("طلبات المتاجر المتبقية:", remainingApps.length ? remainingApps.map((a) => a.storeName) : "0 طلبات (نظيف بالكامل)");
  console.log("\nSUCCESS: الإيميل m777017092@gmail.com أصبح متاحاً وجاهزاً 100% للتسجيل وإنشاء متجر جديد من الصفر!");
}

runCleanup().catch((e) => {
  console.error("Cleanup failed:", e);
  process.exit(1);
}).finally(() => {
  client.end({ timeout: 5 }).catch(() => undefined);
});
