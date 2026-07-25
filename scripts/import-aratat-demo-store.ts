import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  banners,
  categories,
  db,
  merchants,
  products,
  productVariants,
  roles,
  storeMedia,
  stores,
  storeWings,
  userRoles,
  users,
  wings
} from "@/lib/db";
import { slugify, uniqueSlug } from "@/lib/slug";

const appScreenshots = [
  "https://play-lh.googleusercontent.com/0fishXFv9QExV9J-24Wf68Uny5xPoTU6xKd2K9IAjDRDjx-G_MEr_7QVHx2qOISqoZJEkEPd6iZ_zDJBkduOww=w526-h296-rw",
  "https://play-lh.googleusercontent.com/u9CCMwvzZRTliqxBFfzBsQnN2_JTVHfMpKXvEt_qtzc2srXqdk7RYld4S1_mK-tWCPAwjVkeVkhtHWSPWCNB8g=w526-h296-rw",
  "https://play-lh.googleusercontent.com/i17rvV7MB_2F_qzB-vmjQtV8XiysYCmjQIneLL4i-thi9Docgsla0c4xOKkGwgC-vf9FlrWttZVHJXSZn9ugFQ=w526-h296-rw",
  "https://play-lh.googleusercontent.com/Scbh8WSWZB4-2rnnQ2-LArECLdbYvMonKsUNz_2aHS-ESL57Sv1-NcdqM_PuQy64fblSRn7pP0-2yK-5aJW-2Q=w526-h296-rw"
];

const iconUrl = "https://play-lh.googleusercontent.com/_2LeGr7kyYP1fQKJ8KHmgukMLRnfRobm8WAreqZqvunpmPuso1zxGNNOEY3MeLxBQ-RksRjzUL4tp9s7yl2VgQ=w240-h480-rw";

const categorySeeds = [
  { name: "ملابس وأحذية", products: ["طقم ملابس يومي", "حذاء رجالي مريح"] },
  { name: "شنط نسائية", products: ["شنطة نسائية عملية", "حقيبة خروج أنيقة"] },
  { name: "مواد غذائية", products: ["سلة مواد غذائية", "عرض تموين منزلي"] },
  { name: "أدوات منزلية", products: ["منظم مطبخ متعدد", "طقم أواني منزلي"] },
  { name: "العناية والجمال", products: ["مجموعة عناية شخصية", "كريم عناية يومي"] },
  { name: "إكسسوارات", products: ["إكسسوار نسائي", "ساعة عملية"] },
  { name: "مستلزمات أطفال", products: ["طقم أطفال", "حقيبة مستلزمات طفل"] }
];

async function ensureRole(code: string, name: string, scope: "system" | "store") {
  let [role] = await db.select().from(roles).where(eq(roles.code, code)).limit(1);
  if (!role) [role] = await db.insert(roles).values({ code, name, scope, isSystem: true }).returning();
  return role;
}

function requireDemoImportConfiguration() {
  if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("استيراد بيانات demo محظور في بيئة الإنتاج.");
  }
  if (process.env.ARATAT_DEMO_IMPORT !== "1") {
    throw new Error("للحماية: شغل الأمر مع ARATAT_DEMO_IMPORT=1 لأنه سيضيف بيانات تجريبية إلى قاعدة البيانات.");
  }
  const email = process.env.ARATAT_DEMO_EMAIL?.trim().toLowerCase();
  const password = process.env.ARATAT_DEMO_PASSWORD?.trim();
  if (!email || !password || password.length < 16) {
    throw new Error("ARATAT_DEMO_EMAIL و ARATAT_DEMO_PASSWORD (16+ حرفاً) مطلوبان لبيانات التجربة خارج الإنتاج.");
  }
  return { email, password };
}

async function ensureMerchantUser() {
  const { email, password } = requireDemoImportConfiguration();
  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    [user] = await db.insert(users).values({
      fullName: "تاجر عرطات التجريبي",
      email,
      passwordHash: await bcrypt.hash(password, 12),
      status: "active",
      emailVerifiedAt: new Date()
    }).returning();
  }

  const merchantRole = await ensureRole("merchant", "Merchant", "store");
  await db.insert(userRoles).values({ userId: user.id, roleId: merchantRole.id }).onConflictDoNothing();

  let [merchant] = await db.select().from(merchants).where(eq(merchants.userId, user.id)).limit(1);
  if (!merchant) {
    [merchant] = await db.insert(merchants).values({
      userId: user.id,
      merchantNumber: `M-ARATAT-${Date.now()}`,
      status: "active",
      activatedAt: new Date()
    }).returning();
  }

  return { user, merchant };
}

async function ensureWing() {
  const slug = "aratat-demo-wing";
  let [wing] = await db.select().from(wings).where(eq(wings.slug, slug)).limit(1);
  if (!wing) {
    [wing] = await db.insert(wings).values({
      name: "متاجر متنوعة مستوردة",
      slug,
      description: "جناح تجريبي لاستقبال متاجر وتطبيقات خارجية داخل صلاح سنتر.",
      iconUrl,
      heroImageUrl: appScreenshots[0],
      desktopImageUrl: appScreenshots[1],
      mobileImageUrl: appScreenshots[2],
      isActive: true,
      sortOrder: 50
    }).returning();
  }
  return wing;
}

async function ensureStore(merchantUserId: string, merchantProfileId: string, wingId: string) {
  const slug = "aratat-demo-store";
  let [store] = await db.select().from(stores).where(eq(stores.slug, slug)).limit(1);
  if (!store) {
    [store] = await db.insert(stores).values({
      merchantId: merchantUserId,
      merchantProfileId,
      storeNumber: "STR-ARATAT-DEMO",
      name: "عرطات - متجر تجريبي مستورد",
      slug,
      description: "متجر تجريبي مبني من بيانات عامة من صفحة Google Play فقط. لا يحتوي على كتالوج التطبيق الحقيقي إلا إذا توفرت API أو Excel أو قاعدة بيانات مصرح بها.",
      status: "active",
      primaryWingId: wingId,
      contactEmail: "4gonlinea@gmail.com",
      coverImageUrl: appScreenshots[0],
      logoUrl: iconUrl,
      introImageUrl: appScreenshots[1],
      ratingAverage: "5.00",
      ratingCount: 301,
      profileCompleteness: 85,
      isActive: true
    }).returning();
  }
  await db.insert(storeWings).values({ storeId: store.id, wingId }).onConflictDoNothing();
  return store;
}

async function ensureStoreMedia(storeId: string) {
  await db.insert(storeMedia).values([
    { storeId, mediaType: "logo", url: iconUrl, alt: "شعار عرطات", sortOrder: 1, isActive: true },
    ...appScreenshots.map((url, index) => ({ storeId, mediaType: index === 0 ? "cover" as const : "banner" as const, url, alt: `صورة واجهة عرطات ${index + 1}`, sortOrder: index + 2, isActive: true }))
  ]).onConflictDoNothing();
}

async function ensureBanners() {
  await db.insert(banners).values(appScreenshots.slice(0, 3).map((imageUrl, index) => ({
    title: ["تجربة تسوق متنوعة", "عروض ومجموعات", "منتجات لكل احتياج"][index],
    description: "بانر تجريبي مستورد من بيانات عامة للتطبيق.",
    imageUrl,
    linkUrl: "/store/aratat-demo-store",
    placement: index === 0 ? "homepage_promo" : "homepage_slider",
    status: "active" as const,
    sortOrder: 80 + index
  }))).onConflictDoNothing();
}

async function ensureCategoriesAndProducts(storeId: string) {
  for (const [categoryIndex, seed] of categorySeeds.entries()) {
    const categorySlug = slugify(seed.name);
    let [category] = await db.select().from(categories).where(eq(categories.slug, categorySlug)).limit(1);
    if (!category || category.storeId !== storeId) {
      [category] = await db.insert(categories).values({
        storeId,
        name: seed.name,
        slug: categorySlug,
        code: `AR-CAT-${categoryIndex + 1}`,
        codeMode: "manual",
        imageUrl: appScreenshots[categoryIndex % appScreenshots.length],
        isActive: true,
        sortOrder: categoryIndex + 1
      }).returning();
    }

    for (const [productIndex, productName] of seed.products.entries()) {
      const productSlug = uniqueSlug(productName);
      const imageUrl = appScreenshots[(categoryIndex + productIndex) % appScreenshots.length];
      const price = String(2500 + categoryIndex * 900 + productIndex * 650);
      const [product] = await db.insert(products).values({
        storeId,
        categoryId: category.id,
        name: productName,
        slug: productSlug,
        productCode: `AR-P-${categoryIndex + 1}-${productIndex + 1}`,
        codeMode: "manual",
        shortDescription: `${productName} ضمن مجموعة ${seed.name} في متجر عرطات التجريبي.`,
        description: `منتج تجريبي لإثبات إسقاط متجر كامل داخل صلاح سنتر مع الأصناف والمجموعات والصور.\nالمصدر الحالي: بيانات عامة من صفحة Google Play، وليس كتالوج التطبيق الحقيقي.`,
        type: "simple",
        status: "draft",
        basePrice: price,
        mainImageUrl: imageUrl,
        images: [imageUrl],
        specifications: { المصدر: "Google Play public listing demo", المجموعة: seed.name },
        pricingMode: "independent",
        inventoryMode: "variant"
      }).returning();

      await db.insert(productVariants).values({
        productId: product.id,
        sku: `AR-${categoryIndex + 1}-${productIndex + 1}`,
        title: "افتراضي",
        price,
        stockQuantity: 10,
        lowStockThreshold: 2,
        imageUrl,
        images: [imageUrl],
        attributes: { المجموعة: seed.name }
      }).onConflictDoNothing();
    }
  }
}

async function main() {
  requireDemoImportConfiguration();

  const { user, merchant } = await ensureMerchantUser();
  const wing = await ensureWing();
  const store = await ensureStore(user.id, merchant.id, wing.id);
  await ensureStoreMedia(store.id);
  await ensureBanners();
  await ensureCategoriesAndProducts(store.id);

  console.log("ARATAT_DEMO_IMPORT_DONE");
  console.log(`Store URL: /store/${store.slug}`);
  console.log(`Merchant email: ${user.email}`);
  console.log("Merchant password: configured through ARATAT_DEMO_PASSWORD (not printed).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
