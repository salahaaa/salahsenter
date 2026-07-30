import "dotenv/config";
import { and, eq, like } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import {
  client,
  db,
  stores,
  users,
  userRoles,
  roles,
  merchants,
  storeWings,
  categories,
  products,
  productVariants,
  announcements,
  news,
  banners,
  storeMedia
} from "@/lib/db";

async function runAlWafaSetup() {
  console.log("=== 1. تجهيز متجر سوبر الوفاء (Super Al-Wafa) في جناح السوبرماركت ===");
  const now = new Date();

  // 1. Create or update Merchant User for Super Al-Wafa
  const email = "alwafa@mall.com";
  const password = "AlWafa2026!@#";
  const hash = await bcrypt.hash(password, 12);

  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    [user] = await db.insert(users).values({
      id: crypto.randomUUID(),
      email,
      fullName: "أحمد صالح الوفائي",
      phone: "+967770000111",
      passwordHash: hash,
      status: "active",
      mustChangePassword: false,
      emailVerifiedAt: now,
      createdAt: now,
      updatedAt: now
    }).returning();
    console.log("✓ Created Merchant User:", user.email);
  } else {
    [user] = await db.update(users).set({
      passwordHash: hash,
      status: "active",
      mustChangePassword: false,
      fullName: "أحمد صالح الوفائي",
      phone: "+967770000111",
      updatedAt: now
    }).where(eq(users.id, user.id)).returning();
    console.log("✓ Updated Merchant User:", user.email);
  }

  // Ensure merchant role
  let [role] = await db.select().from(roles).where(eq(roles.code, "merchant_owner")).limit(1);
  if (!role) {
    [role] = await db.select().from(roles).where(eq(roles.code, "merchant")).limit(1);
  }
  if (role) {
    await db.insert(userRoles).values({
      id: crypto.randomUUID(),
      userId: user.id,
      roleId: role.id,
      createdAt: now
    }).onConflictDoNothing();
  }

  // Ensure merchant profile
  let [merchantProfile] = await db.select().from(merchants).where(eq(merchants.userId, user.id)).limit(1);
  if (!merchantProfile) {
    [merchantProfile] = await db.insert(merchants).values({
      id: crypto.randomUUID(),
      userId: user.id,
      merchantNumber: "MER-2026-ALWAFA",
      status: "active",
      activatedAt: now,
      createdAt: now,
      updatedAt: now
    }).returning();
  }

  // 2. Create or update Super Al-Wafa Store
  const storeNumber = "STR-ALWAFA";
  const storeName = "سوبر الوفاء - للمواد الغذائية والاستهلاكية";
  const storeSlug = "super-alwafa";
  const groceryWingId = "d473c621-3743-40ae-a77e-9ad4ac9b0ea4";

  let [store] = await db.select().from(stores).where(eq(stores.slug, storeSlug)).limit(1);
  if (!store) {
    [store] = await db.insert(stores).values({
      id: crypto.randomUUID(),
      merchantId: user.id,
      merchantProfileId: merchantProfile.id,
      storeNumber,
      name: storeName,
      slug: storeSlug,
      description: "سوبر الوفاء الأول للجملة والتجزئة - مواد غذائية طازجة، معلبات، أرز وزيوت، ألبان، وحلويات بأسعار الجملة وتوصيل سريع داخل العاصمة.",
      logoUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80",
      coverImageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1400&q=80",
      primaryWingId: groceryWingId,
      status: "active",
      isActive: true,
      profileCompleteness: 100,
      contactPhone: "+967770000111",
      contactEmail: email,
      createdAt: now,
      updatedAt: now
    }).returning();
    console.log("✓ Created Store:", store.name);
  } else {
    [store] = await db.update(stores).set({
      name: storeName,
      description: "سوبر الوفاء الأول للجملة والتجزئة - مواد غذائية طازجة، معلبات، أرز وزيوت، ألبان، وحلويات بأسعار الجملة وتوصيل سريع داخل العاصمة.",
      logoUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80",
      coverImageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1400&q=80",
      status: "active",
      isActive: true,
      profileCompleteness: 100,
      contactPhone: "+967770000111",
      contactEmail: email,
      updatedAt: now
    }).where(eq(stores.id, store.id)).returning();
    console.log("✓ Updated Store:", store.name);
  }

  await db.insert(storeWings).values({
    id: crypto.randomUUID(),
    storeId: store.id,
    wingId: groceryWingId
  }).onConflictDoNothing();

  // 3. Create Store News Ticker & Announcements
  await db.delete(announcements).where(eq(announcements.storeId, store.id));
  await db.insert(announcements).values([
    {
      id: crypto.randomUUID(),
      storeId: store.id,
      title: "توصيل مجاني لعملاء سوبر الوفاء داخل العاصمة صنعاء للطلبات فوق 20,000 ريال • طازج يومياً من مزارعنا",
      level: "store",
      status: "active",
      isPinned: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: crypto.randomUUID(),
      storeId: store.id,
      title: "عروض نهاية الأسبوع الكبرى — خصومات تصل لـ 35% على الأرز والزيوت والمعلبات",
      level: "store",
      status: "active",
      isPinned: true,
      createdAt: now,
      updatedAt: now
    }
  ]);
  console.log("✓ Inserted Store News Ticker Announcements");

  // 4. Create 6 Supermarket Categories
  await db.delete(categories).where(eq(categories.storeId, store.id));
  const categoryDefs = [
    { name: "الأرز والزيوت والسكر", slug: "rice-oils-sugar", sortOrder: 1, icon: "🌾" },
    { name: "المعلبات والمواد الغذائية", slug: "canned-staples", sortOrder: 2, icon: "🥫" },
    { name: "الألبان والأجبان الطازجة", slug: "dairy-cheese", sortOrder: 3, icon: "🧀" },
    { name: "المشروبات والعصائر", slug: "beverages-juices", sortOrder: 4, icon: "🧃" },
    { name: "المنظفات والعناية المنزلية", slug: "home-detergents", sortOrder: 5, icon: "🧼" },
    { name: "الشوكولاتة والحلويات", slug: "chocolates-sweets", sortOrder: 6, icon: "🍫" }
  ];

  const catMap = new Map<string, string>();
  for (const c of categoryDefs) {
    const [cat] = await db.insert(categories).values({
      id: crypto.randomUUID(),
      storeId: store.id,
      name: c.name,
      slug: c.slug,
      sortOrder: c.sortOrder,
      status: "active",
      createdAt: now,
      updatedAt: now
    }).returning();
    catMap.set(c.slug, cat.id);
  }
  console.log(`✓ Inserted ${categoryDefs.length} Supermarket Categories`);

  // 5. Create 12 Realistic Supermarket Products with uncropped food imagery
  await db.delete(products).where(eq(products.storeId, store.id));
  const productDefs = [
    {
      name: "أرز بسمتي هندي فاخر حبة طويلة - كيس 10 كجم",
      slug: "basmati-rice-10kg",
      catSlug: "rice-oils-sugar",
      basePrice: "22000",
      compareAtPrice: "24500",
      soldCount: 140,
      ratingAverage: "4.9",
      mainImageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80"
    },
    {
      name: "زيت دوار الشمس نقي ممتاز - عبوة 5 لتر",
      slug: "sunflower-oil-5l",
      catSlug: "rice-oils-sugar",
      basePrice: "9500",
      compareAtPrice: "11000",
      soldCount: 95,
      ratingAverage: "4.8",
      mainImageUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80"
    },
    {
      name: "سكر أبيض ناعم نقي - كيس 10 كجم",
      slug: "white-sugar-10kg",
      catSlug: "rice-oils-sugar",
      basePrice: "8800",
      compareAtPrice: "9500",
      soldCount: 110,
      ratingAverage: "4.9",
      mainImageUrl: "https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=800&q=80"
    },
    {
      name: "حليب مجفف مدعم كامل الدسم - عبوة 2.5 كجم",
      slug: "milk-powder-2500g",
      catSlug: "dairy-cheese",
      basePrice: "16500",
      compareAtPrice: "18000",
      soldCount: 125,
      ratingAverage: "4.9",
      mainImageUrl: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=800&q=80"
    },
    {
      name: "جبنة شيدر طبيعية فاخرة - قالب 1 كجم",
      slug: "cheddar-cheese-1kg",
      catSlug: "dairy-cheese",
      basePrice: "7200",
      compareAtPrice: "8000",
      soldCount: 88,
      ratingAverage: "4.8",
      mainImageUrl: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=800&q=80"
    },
    {
      name: "تونة فاخرة بزيت دوار الشمس - كرتون 12 علبة",
      slug: "tuna-can-pack-12",
      catSlug: "canned-staples",
      basePrice: "11500",
      compareAtPrice: "13000",
      soldCount: 160,
      ratingAverage: "4.9",
      mainImageUrl: "https://images.unsplash.com/photo-1534483509719-3feaee7c30da?auto=format&fit=crop&w=800&q=80"
    },
    {
      name: "صلصة طماطم طبيعية مركزة - كرتون 24 علبة",
      slug: "tomato-paste-pack-24",
      catSlug: "canned-staples",
      basePrice: "6800",
      compareAtPrice: "7500",
      soldCount: 130,
      ratingAverage: "4.8",
      mainImageUrl: "https://images.unsplash.com/photo-1592924357228-91a4daadc9e7?auto=format&fit=crop&w=800&q=80"
    },
    {
      name: "عصير طبيعي مشكل بدون سكر - كرتون 24 عبوة",
      slug: "mixed-juice-pack-24",
      catSlug: "beverages-juices",
      basePrice: "7500",
      compareAtPrice: "8500",
      soldCount: 105,
      ratingAverage: "4.8",
      mainImageUrl: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=800&q=80"
    },
    {
      name: "شاي كيني أسود ممتاز فرط - عبوة 900 جرام",
      slug: "black-tea-900g",
      catSlug: "beverages-juices",
      basePrice: "5400",
      compareAtPrice: "6000",
      soldCount: 115,
      ratingAverage: "4.9",
      mainImageUrl: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80"
    },
    {
      name: "مسحوق غسيل أوتوماتيك مركز - كيس 5 كجم",
      slug: "laundry-powder-5kg",
      catSlug: "home-detergents",
      basePrice: "8900",
      compareAtPrice: "10500",
      soldCount: 90,
      ratingAverage: "4.8",
      mainImageUrl: "https://images.unsplash.com/photo-1585814546833-16214532b260?auto=format&fit=crop&w=800&q=80"
    },
    {
      name: "سائل غسيل صحون بتركيبة الليمون - 4 علب",
      slug: "dishwashing-liquid-4pack",
      catSlug: "home-detergents",
      basePrice: "3600",
      compareAtPrice: "4200",
      soldCount: 150,
      ratingAverage: "4.9",
      mainImageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80"
    },
    {
      name: "تشكيلة شوكولاتة فاخرة مشكلة - عبوة 750 جرام",
      slug: "chocolate-assorted-750g",
      catSlug: "chocolates-sweets",
      basePrice: "6500",
      compareAtPrice: "7800",
      soldCount: 175,
      ratingAverage: "4.9",
      mainImageUrl: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=800&q=80"
    }
  ];

  for (const p of productDefs) {
    const catId = catMap.get(p.catSlug) || null;
    const prodId = crypto.randomUUID();
    const varId = crypto.randomUUID();

    await db.insert(products).values({
      id: prodId,
      storeId: store.id,
      name: p.name,
      slug: p.slug,
      categoryId: catId,
      description: `منتج غذائي/استهلاكي أصلي عالي الجودة من سوبر الوفاء بضمان الطراوة والسعر الأفضل في المول.`,
      basePrice: p.basePrice,
      compareAtPrice: p.compareAtPrice,
      soldCount: p.soldCount,
      ratingAverage: p.ratingAverage,
      mainImageUrl: p.mainImageUrl,
      defaultVariantId: varId,
      status: "active",
      createdAt: now,
      updatedAt: now
    });

    await db.insert(productVariants).values({
      id: varId,
      productId: prodId,
      storeId: store.id,
      name: "العبوة الافتراضية",
      sku: `ALWAFA-${p.slug.toUpperCase()}`,
      price: p.basePrice,
      compareAtPrice: p.compareAtPrice,
      stockQuantity: 100,
      reservedQuantity: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });
  }

  console.log(`✓ Inserted ${productDefs.length} Supermarket Products & Variants`);
  console.log("\n=== النتيجة النهائية لتأسيس سوبر الوفاء ===");
  console.log("اسم المتجر:", store.name);
  console.log("رابط المتجر الحي:", `https://salahsenter.vercel.app/store/${store.slug}`);
  console.log("البريد الإلكتروني لمالك المتجر:", email);
  console.log("كلمة المرور:", password);
  console.log("عدد التصنيفات المضافة:", categoryDefs.length);
  console.log("عدد المنتجات الحية:", productDefs.length);
  console.log("SUCCESS: متجر سوبر الوفاء جاهز الآن للعمل والعرض باحترافية كاملة!");
}

runAlWafaSetup().catch((e) => {
  console.error("Setup failed:", e);
  process.exit(1);
}).finally(() => {
  client.end({ timeout: 5 }).catch(() => undefined);
});
