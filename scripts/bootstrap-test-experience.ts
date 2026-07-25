import "dotenv/config";

import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { hashPassword } from "@/lib/auth";
import {
  categories,
  client,
  db,
  merchants,
  paymentMethods,
  productVariants,
  products,
  roles,
  shippingMethods,
  storeWings,
  stores,
  units,
  userRoles,
  users,
  wings
} from "@/lib/db";
import {
  assertTestExperienceEnvironment,
  assertTestExperiencePassword,
  normalizeTestExperienceSlug
} from "@/lib/test-experience/policy";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} مطلوب لإنشاء تجربة الاختبار.`);
  return value;
}

function requiredEmail(name: string) {
  const email = required(name).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error(`${name} يجب أن يكون بريداً صحيحاً.`);
  return email;
}

async function ensureUser(input: { email: string; name: string; password: string }) {
  const [existing] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (existing) {
    if (!existing.isTestAccount) throw new Error("البريد المحدد يخص حساباً غير تجريبي؛ لن يحوله السكربت إلى حساب اختبار.");
    if (existing.status !== "active") throw new Error("حساب التاجر التجريبي غير نشط. فعّله يدوياً أو استخدم بريداً اختبارياً جديداً.");
    return { user: existing, created: false };
  }
  const [user] = await db
    .insert(users)
    .values({
      fullName: input.name,
      email: input.email,
      username: `test_merchant_${nanoid(8).toLowerCase()}`,
      passwordHash: await hashPassword(input.password),
      mustChangePassword: true,
      isTestAccount: true,
      status: "active",
      emailVerifiedAt: new Date()
    })
    .returning();
  return { user, created: true };
}

async function ensureRoleAssignment(userId: string, roleId: string, storeId: string | null) {
  const where = storeId
    ? and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId), eq(userRoles.storeId, storeId))
    : and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId), isNull(userRoles.storeId));
  const [existing] = await db.select({ id: userRoles.id }).from(userRoles).where(where).limit(1);
  if (!existing) await db.insert(userRoles).values({ userId, roleId, storeId });
}

async function main() {
  assertTestExperienceEnvironment();
  const merchantEmail = requiredEmail("TEST_EXPERIENCE_MERCHANT_EMAIL");
  const merchantName = required("TEST_EXPERIENCE_MERCHANT_NAME");
  const merchantPassword = assertTestExperiencePassword(required("TEST_EXPERIENCE_MERCHANT_PASSWORD"), "TEST_EXPERIENCE_MERCHANT_PASSWORD");
  const storeSlug = normalizeTestExperienceSlug(required("TEST_EXPERIENCE_STORE_SLUG"), "TEST_EXPERIENCE_STORE_SLUG");
  const wingSlug = normalizeTestExperienceSlug(process.env.TEST_EXPERIENCE_WING_SLUG || "test-experience-wing", "TEST_EXPERIENCE_WING_SLUG");

  const [merchantRole] = await db.select().from(roles).where(eq(roles.code, "merchant")).limit(1);
  if (!merchantRole) throw new Error("دور merchant غير موجود. طبّق npm run db:migrate ثم npm run db:seed أولاً.");

  const { user: merchantUser, created: merchantCreated } = await ensureUser({ email: merchantEmail, name: merchantName, password: merchantPassword });
  let [merchantProfile] = await db.select().from(merchants).where(eq(merchants.userId, merchantUser.id)).limit(1);
  if (!merchantProfile) {
    [merchantProfile] = await db
      .insert(merchants)
      .values({ userId: merchantUser.id, merchantNumber: `TST-MER-${nanoid(10).toUpperCase()}`, status: "active", activatedAt: new Date() })
      .returning();
  }

  let [wing] = await db.select().from(wings).where(eq(wings.slug, wingSlug)).limit(1);
  if (!wing) {
    [wing] = await db
      .insert(wings)
      .values({
        name: "جناح تجربة الاختبار",
        slug: wingSlug,
        description: "جناح اختبار محلي/مرحلي فقط. لا يمثل بيانات أو متاجر حقيقية.",
        isActive: true,
        sortOrder: 9_000
      })
      .returning();
  }

  let [store] = await db.select().from(stores).where(eq(stores.slug, storeSlug)).limit(1);
  if (store) {
    if (store.merchantId !== merchantUser.id || !String(store.description || "").includes("TEST EXPERIENCE ONLY")) {
      throw new Error("store slug مستخدم من متجر غير مخصص لتجربة الاختبار؛ اختر TEST_EXPERIENCE_STORE_SLUG مختلفاً.");
    }
  } else {
    [store] = await db
      .insert(stores)
      .values({
        merchantId: merchantUser.id,
        merchantProfileId: merchantProfile.id,
        primaryWingId: wing.id,
        storeNumber: `TST-STR-${nanoid(10).toUpperCase()}`,
        name: "متجر تجربة الاختبار",
        slug: storeSlug,
        description: "TEST EXPERIENCE ONLY — متجر اختبار محلي/مرحلي، لا يستخدم في Production.",
        status: "active",
        isActive: true,
        operationStatus: "OPEN",
        profileCompleteness: 80,
        contactEmail: merchantUser.email
      })
      .returning();
  }

  await db.insert(storeWings).values({ storeId: store.id, wingId: wing.id }).onConflictDoNothing();
  await ensureRoleAssignment(merchantUser.id, merchantRole.id, store.id);

  const [unit] = await db.select({ id: units.id }).from(units).where(and(eq(units.storeId, store.id), eq(units.name, "قطعة"))).limit(1);
  if (!unit) await db.insert(units).values({ storeId: store.id, name: "قطعة", symbol: "1 قطعة", isActive: true, sortOrder: 1 });

  let [category] = await db.select().from(categories).where(and(eq(categories.storeId, store.id), eq(categories.slug, "test-experience"))).limit(1);
  if (!category) {
    [category] = await db
      .insert(categories)
      .values({ storeId: store.id, name: "كتالوج تجربة الاختبار", slug: "test-experience", code: "TST-EXPERIENCE", codeMode: "manual", isActive: true, sortOrder: 1 })
      .returning();
  }

  let [product] = await db.select().from(products).where(and(eq(products.storeId, store.id), eq(products.slug, "test-draft-product"))).limit(1);
  if (!product) {
    [product] = await db
      .insert(products)
      .values({
        storeId: store.id,
        categoryId: category.id,
        name: "منتج تجربة — مسودة",
        slug: "test-draft-product",
        productCode: "TST-DRAFT-001",
        codeMode: "manual",
        shortDescription: "منتج اختبار يبدأ مسودة وبسعر ومخزون صفر ليجرب التاجر دورة الإعداد والنشر الحقيقية.",
        type: "simple",
        status: "draft",
        basePrice: "0",
        pricingMode: "independent",
        inventoryMode: "variant",
        productCommerceType: "ONLINE_SALES"
      })
      .returning();
  }

  const [variant] = await db.select({ id: productVariants.id }).from(productVariants).where(and(eq(productVariants.productId, product.id), eq(productVariants.sku, "TST-DRAFT-001-STD"))).limit(1);
  if (!variant) {
    const [defaultUnit] = await db.select({ id: units.id }).from(units).where(and(eq(units.storeId, store.id), eq(units.isActive, true))).limit(1);
    await db.insert(productVariants).values({ productId: product.id, sku: "TST-DRAFT-001-STD", title: "قياسي — مسودة", unitId: defaultUnit?.id || null, price: "0", stockQuantity: 0, lowStockThreshold: 1, isActive: true });
  }

  const paymentCode = `test-cod-${store.id.slice(0, 8)}`;
  const [payment] = await db.select({ id: paymentMethods.id }).from(paymentMethods).where(and(eq(paymentMethods.storeId, store.id), eq(paymentMethods.code, paymentCode))).limit(1);
  if (!payment) await db.insert(paymentMethods).values({ storeId: store.id, name: "دفع عند الاستلام — اختبار", code: paymentCode, provider: "cod", config: { testOnly: true }, isActive: true, sortOrder: 1 });

  const shippingCode = `test-shipping-${store.id.slice(0, 8)}`;
  const [shipping] = await db.select({ id: shippingMethods.id }).from(shippingMethods).where(and(eq(shippingMethods.storeId, store.id), eq(shippingMethods.code, shippingCode))).limit(1);
  if (!shipping) await db.insert(shippingMethods).values({ storeId: store.id, name: "شحن اختبار", code: shippingCode, fee: "0", estimatedDaysMin: 1, estimatedDaysMax: 2, isActive: true, sortOrder: 1 });

  console.log(JSON.stringify({
    ok: true,
    merchantCreated,
    wing: { slug: wing.slug, isActive: wing.isActive },
    store: { slug: store.slug, status: store.status, isActive: store.isActive },
    product: { slug: product.slug, status: product.status, price: 0, stock: 0 },
    message: "تجربة اختبار جاهزة. كلمة المرور لا تطبع؛ التاجر يغيرها عند أول دخول. المنتج مسودة ولا يظهر للعميل قبل أن يعده التاجر وينشره."
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end({ timeout: 5 }).catch(() => undefined);
  });
