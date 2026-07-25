import "dotenv/config";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";
import { categories, db, inventoryMovements, merchants, productImages, products, productVariants, roles, storeWings, stores, units, userRoles, users, wings } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { client } from "@/lib/db";

type ProductSeed = { name: string; category: string; price: number; compareAt?: number; stock: number; image: string; description: string; unit?: string; specs?: Record<string, string> };
type StoreSeed = { name: string; slug: string; wing: string; wingSlug: string; wingDescription: string; merchant: string; email: string; phone: string; description: string; coverImageUrl: string; logoUrl?: string; categories: string[]; products: ProductSeed[] };

const sourceNote = "بيانات تأسيسية احترافية معدة مسبقاً للمتجر";
const fixturePassword = randomBytes(32).toString("base64url");

function assertFixtureImportEnvironment() {
  if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("استيراد UI fixtures محظور في الإنتاج.");
  }
  if (process.env.UI_FIXTURES_IMPORT !== "true") {
    throw new Error("عيّن UI_FIXTURES_IMPORT=true لتأكيد استيراد بيانات fixtures خارج الإنتاج.");
  }
}

const storesSeed: StoreSeed[] = [
  {
    name: "الصبري للأدوات المنزلية",
    slug: "al-sabri-home-tools",
    wing: "الأدوات المنزلية ومستلزمات البيت",
    wingSlug: "home-tools-care",
    wingDescription: "مستلزمات المنزل والمطبخ والتنظيف والتنظيم والإضاءة.",
    merchant: "فريق الصبري",
    email: "alsabri.import@salah.center",
    phone: "+967700100101",
    description: "متجر متخصص في الأدوات المنزلية والنظافة والمطبخ والتنظيم وإكسسوارات الحمام، مستوحى من ملف كود بن باش.",
    coverImageUrl: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=1200&h=500&fit=crop",
    categories: ["أدوات النظافة", "أدوات المطبخ", "التخزين والتنظيم", "إكسسوارات الحمام", "الإضاءة"],
    products: [
      { name: "مكنسة كهربائية متعددة الوظائف 2000 واط", category: "أدوات النظافة", price: 450, compareAt: 560, stock: 24, image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=600&fit=crop", description: "مكنسة كهربائية قوية متعددة الاستخدامات لتنظيف المنزل بفعالية عالية." },
      { name: "طقم أواني طهي غير لاصق 12 قطعة", category: "أدوات المطبخ", price: 299, stock: 35, image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=600&fit=crop", description: "طقم أواني مطبخ غير لاصق بتوزيع حرارة متوازن وتصميم عملي." },
      { name: "منظف بالبخار متعدد الاستخدامات", category: "أدوات النظافة", price: 380, stock: 18, image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&h=600&fit=crop", description: "منظف بخاري لتعقيم الأسطح والمفروشات والمطابخ والحمامات." },
      { name: "منظم خزانة قابل للتعديل 5 طبقات", category: "التخزين والتنظيم", price: 129, stock: 42, image: "https://images.unsplash.com/photo-1558997519-83ea9252edf8?w=600&h=600&fit=crop", description: "منظم خزانة قابل للتعديل لتوفير مساحة وترتيب أفضل." },
      { name: "مجموعة تنظيف شاملة 25 قطعة", category: "أدوات النظافة", price: 85, compareAt: 100, stock: 60, image: "https://images.unsplash.com/photo-1513506003011-3b03c80175e8?w=600&h=600&fit=crop", description: "مجموعة تنظيف شاملة للاستخدام اليومي في المنزل والمكتب." },
      { name: "طقم إكسسوارات حمام ستانلس ستيل 6 قطع", category: "إكسسوارات الحمام", price: 199, stock: 22, image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&h=600&fit=crop", description: "طقم إكسسوارات حمام من الستانلس ستيل بتصميم أنيق مقاوم للصدأ." },
      { name: "ممسحة بخارية ذكية مع خزان ماء", category: "أدوات النظافة", price: 159, stock: 28, image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&h=600&fit=crop", description: "ممسحة بخارية خفيفة مع خزان ماء لتنظيف سريع وصحي." },
      { name: "محضرة طعام متعددة الوظائف 10 في 1", category: "أدوات المطبخ", price: 549, stock: 12, image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=600&fit=crop", description: "محضرة طعام متعددة الوظائف للتقطيع والخلط والعجن والتحضير." }
    ]
  },
  {
    name: "بيكي ستور للتسوق الذكي",
    slug: "biki-smart-shopping",
    wing: "المتاجر الشاملة والتسوق الذكي",
    wingSlug: "smart-department-stores",
    wingDescription: "متاجر شاملة تجمع الإلكترونيات والأزياء والجمال والرياضة والمنزل.",
    merchant: "فريق بيكي",
    email: "biki.import@salah.center",
    phone: "+967700100102",
    description: "متجر شامل بتجربة تطبيق عصرية، مستوحى من ملف كود تطبيق بيكي.",
    coverImageUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=500&fit=crop",
    categories: ["إلكترونيات", "أزياء", "جمال", "رياضة", "منزل", "ساعات", "عطور", "أحذية", "حقائب"],
    products: [
      { name: "سماعات بلوتوث لاسلكية بتصميم عصري", category: "إلكترونيات", price: 149, compareAt: 299, stock: 40, image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop", description: "سماعات لاسلكية بإلغاء ضوضاء وبطارية طويلة وصوت عميق." },
      { name: "هاتف ذكي بكاميرا 108 ميجابكسل", category: "إلكترونيات", price: 2499, compareAt: 3299, stock: 15, image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=600&fit=crop", description: "هاتف ذكي بشاشة AMOLED وكاميرا عالية الدقة وذاكرة كبيرة." },
      { name: "ساعة ذكية متطورة مع متتبع لياقة", category: "ساعات", price: 399, compareAt: 599, stock: 25, image: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&h=600&fit=crop", description: "ساعة ذكية لمراقبة النبض والرياضة ومقاومة للماء." },
      { name: "حقيبة ظهر جلدية فاخرة للعمل", category: "حقائب", price: 189, stock: 30, image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop", description: "حقيبة جلدية أنيقة للعمل والسفر مع حماية للابتوب." },
      { name: "عطر فرنسي فاخر للرجال 100 مل", category: "عطور", price: 275, compareAt: 350, stock: 33, image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&h=600&fit=crop", description: "عطر فرنسي أصلي بمزيج خشبي وعنبر وفانيليا." },
      { name: "حذاء رياضي خفيف الوزن للجري", category: "أحذية", price: 219, stock: 45, image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop", description: "حذاء رياضي خفيف بتقنية إرجاع الطاقة ونعل مقاوم للانزلاق." },
      { name: "شاحن لاسلكي سريع 15 واط", category: "إلكترونيات", price: 79, compareAt: 129, stock: 70, image: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&h=600&fit=crop", description: "شاحن لاسلكي سريع متوافق مع معظم الأجهزة الذكية." },
      { name: "قميص قطني كلاسيكي للرجال", category: "أزياء", price: 95, stock: 60, image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=600&fit=crop", description: "قميص قطني مريح مناسب للعمل والمناسبات." },
      { name: "مجموعة العناية بالبشرة الكاملة", category: "جمال", price: 199, compareAt: 320, stock: 32, image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=600&fit=crop", description: "مجموعة عناية متكاملة بمكونات مناسبة لمختلف أنواع البشرة." },
      { name: "دمبل قابل للتعديل من 2 إلى 24 كجم", category: "رياضة", price: 349, compareAt: 499, stock: 18, image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&h=600&fit=crop", description: "دمبل ذكي قابل للتعديل يستبدل عدة أوزان." },
      { name: "مصباح ذكي LED بتحكم صوتي", category: "منزل", price: 89, stock: 38, image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&h=600&fit=crop", description: "مصباح ذكي بألوان متعددة وتحكم عبر الهاتف والصوت." },
      { name: "نظارة شمسية بولارايزد فاخرة", category: "إلكترونيات", price: 165, compareAt: 250, stock: 28, image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&h=600&fit=crop", description: "نظارة شمسية بعدسات بولارايزد وإطار خفيف بتصميم عصري." },
      { name: "كيبورد ميكانيكي لاسلكي بإضاءة RGB", category: "إلكترونيات", price: 179, stock: 22, image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&h=600&fit=crop", description: "كيبورد ميكانيكي لاسلكي مع إضاءة RGB وبطارية طويلة." },
      { name: "جاكيت جلد طبيعي كلاسيكي", category: "أزياء", price: 450, compareAt: 650, stock: 14, image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=600&fit=crop", description: "جاكيت جلد طبيعي بتصميم كلاسيكي فاخر يناسب جميع الفصول." },
      { name: "سماعة أذن رياضية مقاومة للعرق", category: "إلكترونيات", price: 59, compareAt: 99, stock: 55, image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&h=600&fit=crop", description: "سماعات أذن رياضية مقاومة للعرق والماء مع باس قوي وميكروفون مدمج." },
      { name: "وسادة ذاكرة الشكل العلاجية", category: "منزل", price: 129, stock: 26, image: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=600&h=600&fit=crop", description: "وسادة ذاكرة الشكل لدعم الرقبة والكتف وتخفيف الإجهاد أثناء النوم." }
    ]
  },
  {
    name: "أزياء النخبة",
    slug: "elite-fashion-import",
    wing: "الأزياء",
    wingSlug: "fashion-wing-import",
    wingDescription: "ملابس رجالية ونسائية وأطفال بأحدث الموديلات.",
    merchant: "محمد العلي",
    email: "elite-fashion.import@salah.center",
    phone: "+967700100201",
    description: "متجر أزياء رجالية ونسائية مستوحى من ملف نظام المول.",
    coverImageUrl: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=1200&h=500&fit=crop",
    categories: ["ملابس رجالية", "ملابس نسائية"],
    products: [
      { name: "بنطلون جينز كلاسيكي", category: "ملابس رجالية", price: 250, stock: 50, image: "https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?w=600&h=600&fit=crop", description: "بنطلون جينز عالي الجودة بقماش مرن ومريح للاستخدام اليومي." },
      { name: "قميص رسمي قطني", category: "ملابس رجالية", price: 180, stock: 30, image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=600&fit=crop", description: "قميص 100% قطن مناسب للمناسبات الرسمية والعمل." },
      { name: "جاكيت جلد طبيعي", category: "ملابس رجالية", price: 750, stock: 15, image: "https://images.unsplash.com/photo-1551028919-ac76c9028d1b?w=600&h=600&fit=crop", description: "جاكيت فاخر من الجلد الطبيعي بتصميم كلاسيكي أنيق." },
      { name: "فستان سهرة أنيق", category: "ملابس نسائية", price: 450, stock: 12, image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&h=600&fit=crop", description: "فستان طويل فاخر للمناسبات والحفلات بقماش حريري ناعم." },
      { name: "بلوزة صيفية", category: "ملابس نسائية", price: 120, stock: 45, image: "https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=600&h=600&fit=crop", description: "بلوزة خفيفة ومنعشة بتصميم عصري مناسب للصيف." }
    ]
  },
  {
    name: "عالم التقنية",
    slug: "tech-world-import",
    wing: "الإلكترونيات",
    wingSlug: "electronics-wing-import",
    wingDescription: "أحدث الأجهزة الإلكترونية والكمبيوترات والهواتف الذكية.",
    merchant: "سعد المطيري",
    email: "tech-world.import@salah.center",
    phone: "+967700100202",
    description: "متجر إلكترونيات وكمبيوترات وهواتف ذكية مستورد من ملف نظام المول.",
    coverImageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&h=500&fit=crop",
    categories: ["كمبيوترات ولبتوبات", "هواتف ذكية"],
    products: [
      { name: "لابتوب برو 15 بوصة", category: "كمبيوترات ولبتوبات", price: 4500, stock: 8, image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&h=600&fit=crop", description: "معالج Intel i7 جيل 12، رام 16GB، SSD 512GB وشاشة 15.6 بوصة.", specs: { المعالج: "Intel Core i7", الرام: "16GB", التخزين: "512GB SSD", الضمان: "سنتان" } },
      { name: "كمبيوتر مكتبي للألعاب", category: "كمبيوترات ولبتوبات", price: 6200, stock: 5, image: "https://images.unsplash.com/photo-1587831990711-23ca6441447b?w=600&h=600&fit=crop", description: "تجميعة احترافية للألعاب والتصميم بتبريد قوي ومواصفات عالية.", specs: { المعالج: "Ryzen 9", كرت_الشاشة: "RTX 3080", الرام: "32GB", الضمان: "3 سنوات" } },
      { name: "فون برو ماكس", category: "هواتف ذكية", price: 3800, stock: 20, image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=600&fit=crop", description: "هاتف ذكي بكاميرا احترافية 108MP وشحن سريع 65W.", specs: { الذاكرة: "256GB", الرام: "12GB", الشبكة: "5G", الضمان: "سنة" } }
    ]
  },
  {
    name: "أثاث العائلة",
    slug: "family-furniture-import",
    wing: "الأثاث والمفروشات",
    wingSlug: "furniture-wing-import",
    wingDescription: "أثاث منزلي ومكتبي بتصاميم عصرية وكلاسيكية.",
    merchant: "فهد القحطاني",
    email: "family-furniture.import@salah.center",
    phone: "+967700100203",
    description: "متجر أثاث منزلي ومكتبي مستوحى من ملف نظام المول.",
    coverImageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&h=500&fit=crop",
    categories: ["غرف معيشة", "طاولات"],
    products: [
      { name: "كنبة زاوية حديثة", category: "غرف معيشة", price: 3200, stock: 6, image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=600&fit=crop", description: "كنبة زاوية 5 مقاعد بقماش مخمل فاخر مقاوم للبقع.", specs: { الأبعاد: "300x200 سم", الخامة: "مخمل تركي" } },
      { name: "طقم طاولات خشبية", category: "طاولات", price: 850, stock: 15, image: "https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=600&h=600&fit=crop", description: "طقم 3 طاولات خشب زان طبيعي بتصميم نورديك.", specs: { الخامة: "خشب زان طبيعي", اللون: "عسلي" } }
    ]
  }
];

async function ensureWing(seed: StoreSeed) {
  const slug = seed.wingSlug;
  let [wing] = await db.select().from(wings).where(eq(wings.slug, slug)).limit(1);
  if (!wing) [wing] = await db.select().from(wings).where(eq(wings.name, seed.wing)).limit(1);
  if (!wing) {
    [wing] = await db.insert(wings).values({ name: seed.wing, slug, description: seed.wingDescription, isActive: true, sortOrder: 50 }).returning();
  } else if (!wing.isActive) {
    [wing] = await db.update(wings).set({ isActive: true, updatedAt: new Date() }).where(eq(wings.id, wing.id)).returning();
  }
  return wing;
}

async function ensureMerchant(seed: StoreSeed) {
  const password = await hashPassword(fixturePassword);
  let [user] = await db.select().from(users).where(eq(users.email, seed.email)).limit(1);
  if (!user) {
    [user] = await db.insert(users).values({ fullName: seed.merchant, email: seed.email, phone: seed.phone, passwordHash: password, status: "active", mustChangePassword: true, emailVerifiedAt: new Date() }).returning();
  }
  let [merchant] = await db.select().from(merchants).where(eq(merchants.userId, user.id)).limit(1);
  if (!merchant) {
    [merchant] = await db.insert(merchants).values({ userId: user.id, merchantNumber: `IMP-${seed.slug.slice(0, 18).toUpperCase()}`, status: "active", activatedAt: new Date() }).returning();
  }
  return { user, merchant };
}

async function ensureStore(seed: StoreSeed, wingId: string, merchantUserId: string, merchantProfileId: string) {
  let [store] = await db.select().from(stores).where(eq(stores.slug, seed.slug)).limit(1);
  const values = { merchantId: merchantUserId, merchantProfileId, storeNumber: `IMP-${seed.slug.slice(0, 20).toUpperCase()}`, name: seed.name, slug: seed.slug, description: `${seed.description}\n\n${sourceNote}`, primaryWingId: wingId, contactPhone: seed.phone, contactEmail: seed.email, coverImageUrl: seed.coverImageUrl, status: "active" as const, isActive: true, profileCompleteness: 90 };
  if (!store) [store] = await db.insert(stores).values(values).returning();
  else [store] = await db.update(stores).set({ ...values, updatedAt: new Date() }).where(eq(stores.id, store.id)).returning();
  await db.insert(storeWings).values({ storeId: store.id, wingId }).onConflictDoNothing();
  const [merchantRole] = await db.select().from(roles).where(eq(roles.code, "merchant")).limit(1);
  if (merchantRole) await db.insert(userRoles).values({ userId: merchantUserId, roleId: merchantRole.id, storeId: store.id }).onConflictDoNothing();
  return store;
}

async function ensureCategory(storeId: string, name: string, index: number) {
  const slug = slugify(name) || `category-${index}`;
  let [category] = await db.select().from(categories).where(and(eq(categories.storeId, storeId), eq(categories.slug, slug))).limit(1);
  if (!category) [category] = await db.insert(categories).values({ storeId, name, slug, code: `CAT-${String(index + 1).padStart(3, "0")}`, codeMode: "manual", isActive: true, sortOrder: index }).returning();
  return category;
}

async function ensureUnit(storeId: string) {
  let [unit] = await db.select().from(units).where(and(eq(units.storeId, storeId), eq(units.name, "قطعة"))).limit(1);
  if (!unit) [unit] = await db.insert(units).values({ storeId, name: "قطعة", symbol: "pcs", isActive: true, sortOrder: 0 }).returning();
  return unit;
}

async function upsertProduct(storeId: string, unitId: string, categoryMap: Map<string, string>, seed: ProductSeed, index: number) {
  const slug = slugify(seed.name) || `product-${index}`;
  const categoryId = categoryMap.get(seed.category) || null;
  const discountPercent = seed.compareAt && seed.compareAt > seed.price ? Math.round((1 - seed.price / seed.compareAt) * 100) : 0;
  let [product] = await db.select().from(products).where(and(eq(products.storeId, storeId), eq(products.slug, slug))).limit(1);
  const productValues = { storeId, categoryId, name: seed.name, slug, productCode: `IMP-${storeId.slice(0, 4)}-${String(index + 1).padStart(4, "0")}`, codeMode: "manual", shortDescription: seed.description.slice(0, 240), description: `${seed.description}\n\n${sourceNote}`, status: "active" as const, type: "simple" as const, basePrice: seed.price.toString(), mainImageUrl: seed.image, images: [seed.image], specifications: seed.specs || {}, pricingMode: "independent", inventoryMode: "variant", discountPercent: discountPercent.toString(), isPromoted: index < 3 };
  if (!product) [product] = await db.insert(products).values(productValues).returning();
  else [product] = await db.update(products).set({ ...productValues, updatedAt: new Date() }).where(eq(products.id, product.id)).returning();

  await db.insert(productImages).values({ productId: product.id, url: seed.image, alt: seed.name, isPrimary: true, sortOrder: 0 }).onConflictDoNothing();
  let [variant] = await db.select().from(productVariants).where(and(eq(productVariants.productId, product.id), eq(productVariants.sku, `${product.productCode}-STD`))).limit(1);
  if (!variant) {
    [variant] = await db.insert(productVariants).values({ productId: product.id, sku: `${product.productCode}-STD`, title: "افتراضي", unitId, price: seed.price.toString(), compareAtPrice: seed.compareAt?.toString() || null, stockQuantity: seed.stock, lowStockThreshold: Math.max(3, Math.floor(seed.stock * 0.15)), imageUrl: seed.image, images: [seed.image], attributes: {} }).returning();
    if (seed.stock > 0) await db.insert(inventoryMovements).values({ storeId, productId: product.id, variantId: variant.id, type: "add", quantity: seed.stock, beforeQuantity: 0, afterQuantity: seed.stock, reason: "Initial imported inspiration stock" }).onConflictDoNothing();
  } else {
    await db.update(productVariants).set({ price: seed.price.toString(), compareAtPrice: seed.compareAt?.toString() || null, imageUrl: seed.image, images: [seed.image], unitId, isActive: true, updatedAt: new Date() }).where(eq(productVariants.id, variant.id));
  }
  return product.id;
}

async function main() {
  assertFixtureImportEnvironment();
  const summary = [];
  for (const seed of storesSeed) {
    const wing = await ensureWing(seed);
    const { user, merchant } = await ensureMerchant(seed);
    const store = await ensureStore(seed, wing.id, user.id, merchant.id);
    const unit = await ensureUnit(store.id);
    const categoryMap = new Map<string, string>();
    for (let i = 0; i < seed.categories.length; i++) {
      const category = await ensureCategory(store.id, seed.categories[i], i);
      categoryMap.set(seed.categories[i], category.id);
    }
    let productsCount = 0;
    for (let i = 0; i < seed.products.length; i++) {
      await upsertProduct(store.id, unit.id, categoryMap, seed.products[i], i);
      productsCount += 1;
    }
    summary.push({ store: store.name, wing: wing.name, categories: seed.categories.length, products: productsCount });
  }
  console.log(JSON.stringify({ imported: summary.length, stores: summary }, null, 2));
}

main().finally(async () => {
  await client.end({ timeout: 5 }).catch(() => undefined);
});
