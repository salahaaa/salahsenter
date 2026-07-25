import "dotenv/config";
import { eq } from "drizzle-orm";
import {
  cities,
  countries,
  client,
  db,
  districts,
  featuredRuleSettings,
  governorates,
  homeSections,
  orderStatusDefinitions,
  paymentMethods,
  permissions,
  roleTemplates,
  notificationTemplates,
  contractTemplates,
  rolePermissions,
  roles,
  shippingMethods,
  subscriptions,
  wings
} from "@/lib/db";
import { slugify } from "@/lib/slug";
import { defaultHomeSections } from "@/lib/home-layout";

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.APP_ENV === "production" || process.env.VERCEL_ENV === "production";
}

const permissionSeeds = [
  ["admin.access", "دخول لوحة الأدمن", "admin"],
  ["admin.settings.manage", "إدارة إعدادات النظام", "admin"],
  ["master.manage", "إدارة النظام المركزي", "admin"],
  ["theme.manage", "إدارة الهوية البصرية", "design"],
  ["home.manage", "إدارة الصفحة الرئيسية", "content"],
  ["cms.manage", "إدارة المحتوى CMS", "content"],
  ["contracts.manage", "إدارة العقود", "operations"],
  ["branches.manage", "إدارة الفروع", "stores"],
  ["commissions.manage", "إدارة العمولات", "finance"],
  ["taxes.manage", "إدارة الضرائب", "finance"],
  ["wings.manage", "إدارة الأجنحة", "catalog"],
  ["stores.manage", "إدارة المتاجر", "stores"],
  ["merchant_applications.manage", "إدارة طلبات التجار", "stores"],
  ["geography.manage", "إدارة المناطق", "settings"],
  ["announcements.manage", "إدارة الإعلانات", "content"],
  ["ads.manage", "إدارة الحملات الإعلانية", "advertising"],
  ["offers.manage", "إدارة نافذة العروض", "marketing"],
  ["news.manage", "إدارة الأخبار", "content"],
  ["notifications.manage", "إدارة الإشعارات والقوالب", "notifications"],
  ["roles.manage", "إدارة الصلاحيات", "security"],
  ["security.manage", "إدارة أمن المنصة", "security"],
  ["payments.manage", "إدارة وسائل الدفع", "operations"],
  ["shipping.manage", "إدارة وسائل الشحن", "operations"],
  ["backups.manage", "إدارة النسخ الاحتياطي", "operations"],
  ["reports.view", "عرض التقارير", "reports"],
  ["users.manage", "إدارة المستخدمين", "security"],
  ["subscriptions.manage", "إدارة الاشتراكات", "billing"],
  ["tenants.manage", "إدارة المستأجرين SaaS", "saas"],
  ["default_media.manage", "إدارة الصور الافتراضية", "design"],
  ["merchant.access", "دخول لوحة التاجر", "merchant"],
  ["products.manage", "إدارة المنتجات", "merchant"],
  ["inventory.manage", "إدارة المخزون", "merchant"],
  ["orders.manage", "إدارة الطلبات", "merchant"],
  ["store_media.manage", "إدارة وسائط المتجر", "merchant"],
  ["store_settings.manage", "إدارة إعدادات المتجر", "merchant"],
  ["product_taxonomy.manage", "إدارة أصناف ومتغيرات المنتجات", "merchant.catalog"],
  ["store_offers.manage", "إدارة عروض المتجر", "merchant.marketing"],
  ["store_coupons.manage", "إدارة كوبونات المتجر", "merchant.marketing"],
  ["store_ads.manage", "إدارة طلبات إعلانات المتجر", "merchant.marketing"],
  ["store_finance.view", "عرض مالية المتجر والتسويات", "merchant.finance"],
  ["store_payment_receipts.manage", "مراجعة إثباتات الدفع", "merchant.finance"],
  ["store_returns.manage", "إدارة المرتجعات والاسترداد", "merchant.orders"],
  ["store_shipping.manage", "إدارة شحن المتجر", "merchant.operations"],
  ["store_payments.manage", "إدارة وسائل دفع المتجر", "merchant.operations"]
] as const;

async function main() {
  if (isProductionRuntime()) {
    throw new Error("npm run db:seed محظور في الإنتاج. لا تُنشأ بيانات seed أو حسابات افتراضية في production.");
  }
  console.log("Seeding marketplace reference data for a non-production environment...");

  await db
    .insert(permissions)
    .values(permissionSeeds.map(([code, name, group]) => ({ code, name, group })))
    .onConflictDoNothing();

  await db
    .insert(roles)
    .values([
      { code: "super_admin", name: "Super Admin", scope: "system", isSystem: true, description: "صلاحية كاملة على المنصة" },
      { code: "merchant", name: "Merchant", scope: "store", isSystem: true, description: "إدارة متجر واحد أو أكثر" },
      { code: "store_employee", name: "Store Employee", scope: "store", isSystem: true, description: "موظف متجر بصلاحيات محددة" },
      { code: "customer", name: "Customer", scope: "system", isSystem: true, description: "عميل المنصة" }
    ])
    .onConflictDoNothing();

  const allRoles = await db.select().from(roles);
  const allPermissions = await db.select().from(permissions);
  const roleByCode = new Map(allRoles.map((role) => [role.code, role]));
  const permissionByCode = new Map(allPermissions.map((permission) => [permission.code, permission]));

  const grant = async (roleCode: string, permissionCodes: string[]) => {
    const role = roleByCode.get(roleCode);
    if (!role) return;
    const values = permissionCodes
      .map((code) => permissionByCode.get(code))
      .filter(Boolean)
      .map((permission) => ({ roleId: role.id, permissionId: permission!.id }));
    if (values.length) await db.insert(rolePermissions).values(values).onConflictDoNothing();
  };

  await grant("super_admin", permissionSeeds.map(([code]) => code));
  await grant("merchant", [
    "merchant.access",
    "products.manage",
    "product_taxonomy.manage",
    "inventory.manage",
    "orders.manage",
    "store_payment_receipts.manage",
    "store_returns.manage",
    "store_offers.manage",
    "store_coupons.manage",
    "store_ads.manage",
    "store_finance.view",
    "store_media.manage",
    "store_shipping.manage",
    "store_payments.manage",
    "store_settings.manage",
    "announcements.manage",
    "news.manage"
  ]);
  await grant("store_employee", ["merchant.access", "products.manage", "inventory.manage", "orders.manage"]);

  // No user accounts are created by this seed. Use the explicit, guarded
  // `npm run admin:bootstrap` flow for the first production administrator.

  await db
    .insert(orderStatusDefinitions)
    .values([
      { code: "new", name: "جديد", color: "blue", sortOrder: 10, allowedNextCodes: ["confirmed", "cancelled"] },
      { code: "confirmed", name: "مؤكد", color: "indigo", sortOrder: 20, allowedNextCodes: ["preparing", "cancelled"] },
      { code: "preparing", name: "قيد التجهيز", color: "amber", sortOrder: 30, allowedNextCodes: ["ready_to_ship", "cancelled"] },
      { code: "ready_to_ship", name: "جاهز للشحن", color: "purple", sortOrder: 40, allowedNextCodes: ["shipped"] },
      { code: "shipped", name: "تم الشحن", color: "cyan", sortOrder: 50, allowedNextCodes: ["delivered"] },
      { code: "delivered", name: "تم التسليم", color: "emerald", sortOrder: 60, allowedNextCodes: ["closed"] },
      { code: "closed", name: "مغلق", color: "slate", sortOrder: 70, allowedNextCodes: [], isTerminal: true },
      { code: "cancelled", name: "ملغي", color: "red", sortOrder: 80, allowedNextCodes: [], isTerminal: true }
    ])
    .onConflictDoNothing();

  await db
    .insert(homeSections)
    .values(defaultHomeSections)
    .onConflictDoNothing();

  await db
    .insert(subscriptions)
    .values([
      { code: "free", name: "باقة مجانية", price: "0", durationDays: 30, maxProducts: 50, maxEmployees: 1, maxAnnouncements: 3, maxNews: 10, maxBranches: 1 },
      { code: "silver", name: "باقة فضية", price: "5000", durationDays: 30, maxProducts: 200, maxEmployees: 3, maxAnnouncements: 8, maxNews: 20, maxBranches: 2 },
      { code: "gold", name: "باقة ذهبية", price: "12000", durationDays: 30, maxProducts: 1000, maxEmployees: 10, maxAnnouncements: 20, maxNews: 50, maxBranches: 5 },
      { code: "diamond", name: "باقة ماسية", price: "25000", durationDays: 30, maxProducts: 5000, maxEmployees: 30, maxAnnouncements: 50, maxNews: 100, maxBranches: 20 }
    ])
    .onConflictDoNothing();

  await db
    .insert(paymentMethods)
    .values([
      { code: "cash_on_delivery", name: "الدفع عند الاستلام", provider: "manual", sortOrder: 1, isActive: true },
      { code: "bank_transfer", name: "تحويل بنكي", provider: "manual", sortOrder: 2, isActive: true }
    ])
    .onConflictDoNothing();

  await db
    .insert(shippingMethods)
    .values([
      { code: "standard_delivery", name: "توصيل عادي", fee: "1000", estimatedDaysMin: 1, estimatedDaysMax: 3, sortOrder: 1, isActive: true },
      { code: "express_delivery", name: "توصيل سريع", fee: "2500", estimatedDaysMin: 0, estimatedDaysMax: 1, sortOrder: 2, isActive: true }
    ])
    .onConflictDoNothing();

  await db
    .insert(featuredRuleSettings)
    .values([
      { target: "store", mode: "automatic", limit: 12, durationDays: 7, weights: { sales: 35, orders: 25, rating: 20, activity: 10, completeness: 10 } },
      { target: "product", mode: "automatic", limit: 24, durationDays: 7, weights: { sold: 40, views: 25, rating: 20, promoted: 15 } }
    ])
    .onConflictDoNothing();

  await db
    .insert(notificationTemplates)
    .values([
      { code: "merchant_final_approval", channel: "in_app", titleTemplate: "تم تفعيل متجرك", bodyTemplate: "رقم المتجر: {{storeNumber}}\nاسم المستخدم: {{username}}\nحالة الاعتماد: {{status}}", variables: ["storeNumber", "username", "status"] },
      { code: "order_status_updated", channel: "in_app", titleTemplate: "تم تحديث حالة طلبك", bodyTemplate: "الحالة الجديدة: {{statusName}}", variables: ["statusName"] }
    ])
    .onConflictDoNothing();

  await db
    .insert(contractTemplates)
    .values([
      { name: "عقد فتح متجر إلكتروني", code: "merchant_onboarding", version: "1.0", body: "عقد فتح متجر إلكتروني داخل منصة صلاح سنتر\n\nالطرف الأول: إدارة المنصة.\nالطرف الثاني: {{merchantName}} مالك متجر {{storeName}}.\n\nيلتزم الطرف الثاني بسياسات المنصة وصحة البيانات.", variables: ["merchantName", "storeName"], isDefault: true, isActive: true }
    ])
    .onConflictDoNothing();

  await db
    .insert(roleTemplates)
    .values([
      { name: "مدير متجر", code: "store_manager_template", scope: "store", permissionCodes: ["merchant.access", "products.manage", "inventory.manage", "orders.manage", "store_media.manage", "store_settings.manage"] },
      { name: "مدير مخزون", code: "inventory_manager_template", scope: "store", permissionCodes: ["merchant.access", "inventory.manage"] },
      { name: "مدير مبيعات", code: "sales_manager_template", scope: "store", permissionCodes: ["merchant.access", "orders.manage"] }
    ])
    .onConflictDoNothing();

  const wingSeeds = [
    { name: "السوبرات", activityTemplateKey: "grocery" },
    { name: "الإلكترونيات", activityTemplateKey: "electronics" },
    { name: "الأزياء", activityTemplateKey: "fashion" },
    { name: "الصيدليات", activityTemplateKey: "pharmacy" },
    { name: "المطاعم", activityTemplateKey: "restaurant" },
    { name: "مواد البناء", activityTemplateKey: "hardware-building" }
  ];
  await db
    .insert(wings)
    .values(
      wingSeeds.map((wing, index) => ({
        ...wing,
        slug: slugify(wing.name),
        description: "كل جناح هو قطاع تاجر واحد ويرتبط بقالب تجهيز واحد يحدده الأدمن.",
        sortOrder: index + 1,
        isActive: true
      }))
    )
    .onConflictDoNothing();

  const [yemen] = await db
    .insert(countries)
    .values({ name: "اليمن", iso2: "YE", phoneCode: "+967", sortOrder: 1, isActive: true })
    .onConflictDoNothing()
    .returning();

  const country = yemen || (await db.select().from(countries).where(eq(countries.name, "اليمن")).limit(1))[0];
  if (country) {
    await db
      .insert(governorates)
      .values(["تعز", "عدن", "حضرموت", "صنعاء"].map((name, index) => ({ countryId: country.id, name, sortOrder: index + 1 })))
      .onConflictDoNothing();

    const taiz = (await db.select().from(governorates).where(eq(governorates.name, "تعز")).limit(1))[0];
    if (taiz) {
      await db
        .insert(cities)
        .values(["مدينة تعز", "التربة", "المخا"].map((name, index) => ({ governorateId: taiz.id, name, sortOrder: index + 1 })))
        .onConflictDoNothing();
      const taizCity = (await db.select().from(cities).where(eq(cities.name, "مدينة تعز")).limit(1))[0];
      if (taizCity) {
        await db
          .insert(districts)
          .values(["الحوبان", "الجحملية", "بير باشا"].map((name, index) => ({ cityId: taizCity.id, name, sortOrder: index + 1 })))
          .onConflictDoNothing();
      }
    }
  }


  // This non-production seed inserts only platform reference data.
  // User accounts and demo storefront data are intentionally absent.

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end({ timeout: 5 }).catch(() => undefined);
  });
