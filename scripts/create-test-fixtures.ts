import "dotenv/config";
import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { hashPassword } from "@/lib/auth";
import {
  categories,
  client,
  db,
  merchants,
  orderStatusDefinitions,
  paymentMethods,
  productVariants,
  products,
  roles,
  shippingMethods,
  stores,
  units,
  userRoles,
  users
} from "@/lib/db";

function isProductionTarget() {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === "production";
  return process.env.NODE_ENV === "production" || process.env.APP_ENV === "production" || process.env.NEXT_PUBLIC_APP_ENV === "production";
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} مطلوب لإنشاء test fixtures.`);
  return value;
}

function requiredEmail(name: string) {
  const email = required(name).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error(`${name} يجب أن يكون بريداً صحيحاً.`);
  return email;
}

function requiredPassword(name: string) {
  const password = required(name);
  if (password.length < 16) throw new Error(`${name} يجب أن يكون 16 حرفاً على الأقل.`);
  if (/demo|example|change.?me|replace/i.test(password)) throw new Error(`${name} يبدو كلمة مرور تجريبية/افتراضية وغير مسموح.`);
  return password;
}

function assertSafeEnvironment() {
  if (isProductionTarget()) throw new Error("test fixtures محظورة في production.");
  if (process.env.TEST_FIXTURES_CONFIRM !== "true") throw new Error("عيّن TEST_FIXTURES_CONFIRM=true لتأكيد الكتابة في قاعدة local/staging.");

  const admins = [
    { email: requiredEmail("TEST_ADMIN_EMAIL"), password: requiredPassword("TEST_ADMIN_PASSWORD"), name: required("TEST_ADMIN_NAME") },
    { email: requiredEmail("TEST_ADMIN_2_EMAIL"), password: requiredPassword("TEST_ADMIN_2_PASSWORD"), name: required("TEST_ADMIN_2_NAME") }
  ];
  const merchants = [
    { email: requiredEmail("TEST_MERCHANT_EMAIL"), password: requiredPassword("TEST_MERCHANT_PASSWORD"), name: required("TEST_MERCHANT_NAME") },
    { email: requiredEmail("TEST_MERCHANT_2_EMAIL"), password: requiredPassword("TEST_MERCHANT_2_PASSWORD"), name: required("TEST_MERCHANT_2_NAME") }
  ];
  const customers = [
    { email: requiredEmail("TEST_CUSTOMER_EMAIL"), password: requiredPassword("TEST_CUSTOMER_PASSWORD"), name: required("TEST_CUSTOMER_NAME") },
    { email: requiredEmail("TEST_CUSTOMER_2_EMAIL"), password: requiredPassword("TEST_CUSTOMER_2_PASSWORD"), name: required("TEST_CUSTOMER_2_NAME") }
  ];
  const emails = [...admins, ...merchants, ...customers].map((item) => item.email);
  if (new Set(emails).size !== emails.length) throw new Error("يجب أن تكون رسائل حسابات الاختبار الستة مختلفة.");
  const storeSlug = required("TEST_FIXTURES_STORE_SLUG").toLowerCase();
  if (!/^[a-z0-9-]{3,120}$/.test(storeSlug)) throw new Error("TEST_FIXTURES_STORE_SLUG يجب أن يتكون من أحرف إنجليزية صغيرة وأرقام وشرطة فقط.");
  return { admins, merchants, customers, storeSlug, resetPasswords: process.env.TEST_FIXTURES_RESET_PASSWORDS === "true" };
}

async function requireRole(code: "super_admin" | "merchant" | "customer") {
  const [role] = await db.select().from(roles).where(eq(roles.code, code)).limit(1);
  if (!role) throw new Error(`الدور ${code} غير موجود. طبّق npm run db:migrate أولاً.`);
  return role;
}

async function ensureUser(input: { email: string; password: string; name: string; resetPasswords: boolean }) {
  const [existing] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (existing) {
    if (input.resetPasswords) {
      const [updated] = await db
        .update(users)
        .set({ fullName: input.name, passwordHash: await hashPassword(input.password), status: "active", emailVerifiedAt: new Date(), isTestAccount: true, updatedAt: new Date() })
        .where(eq(users.id, existing.id))
        .returning();
      return updated;
    }
    if (!existing.isTestAccount || existing.status !== "active") {
      const [updated] = await db.update(users).set({ isTestAccount: true, status: "active", emailVerifiedAt: existing.emailVerifiedAt || new Date(), updatedAt: new Date() }).where(eq(users.id, existing.id)).returning();
      return updated;
    }
    return existing;
  }
  const [created] = await db
    .insert(users)
    .values({ fullName: input.name, email: input.email, passwordHash: await hashPassword(input.password), status: "active", emailVerifiedAt: new Date(), isTestAccount: true })
    .returning();
  return created;
}

async function ensureRoleAssignment(userId: string, roleId: string, storeId: string | null = null) {
  const where = storeId
    ? and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId), eq(userRoles.storeId, storeId))
    : and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId), isNull(userRoles.storeId));
  const [existing] = await db.select({ id: userRoles.id }).from(userRoles).where(where).limit(1);
  if (!existing) await db.insert(userRoles).values({ userId, roleId, storeId });
}

async function ensureOrderStatuses() {
  const statuses = [
    { code: "new", name: "جديد", color: "blue", sortOrder: 10, allowedNextCodes: ["confirmed", "cancelled"] },
    { code: "confirmed", name: "مؤكد", color: "indigo", sortOrder: 20, allowedNextCodes: ["preparing", "cancelled"] },
    { code: "preparing", name: "قيد التجهيز", color: "amber", sortOrder: 30, allowedNextCodes: ["ready_to_ship", "cancelled"] },
    { code: "ready_to_ship", name: "جاهز للشحن", color: "purple", sortOrder: 40, allowedNextCodes: ["shipped"] },
    { code: "shipped", name: "تم الشحن", color: "cyan", sortOrder: 50, allowedNextCodes: ["delivered"] },
    { code: "delivered", name: "تم التسليم", color: "emerald", sortOrder: 60, allowedNextCodes: ["closed"] },
    { code: "closed", name: "مغلق", color: "slate", sortOrder: 70, allowedNextCodes: [], isTerminal: true },
    { code: "cancelled", name: "ملغي", color: "red", sortOrder: 80, allowedNextCodes: [], isTerminal: true }
  ];
  await db.insert(orderStatusDefinitions).values(statuses).onConflictDoNothing();
}

async function ensureQaStore(input: { merchantUser: typeof users.$inferSelect; merchantProfile: typeof merchants.$inferSelect; storeSlug: string; index: number; merchantRoleId: string }) {
  let [store] = await db.select().from(stores).where(eq(stores.slug, input.storeSlug)).limit(1);
  if (!store) {
    [store] = await db.insert(stores).values({
      merchantId: input.merchantUser.id,
      merchantProfileId: input.merchantProfile.id,
      storeNumber: `QA-STR-${nanoid(10).toUpperCase()}`,
      name: `QA Store ${input.index}`,
      slug: input.storeSlug,
      description: "متجر اختبار محلي/مرحلي فقط. لا يُنشأ في production.",
      status: "active", isActive: true, operationStatus: "OPEN", profileCompleteness: 100, contactEmail: input.merchantUser.email
    }).returning();
  } else if (store.merchantId !== input.merchantUser.id || !store.isActive || store.status !== "active") {
    [store] = await db.update(stores).set({ merchantId: input.merchantUser.id, merchantProfileId: input.merchantProfile.id, status: "active", isActive: true, operationStatus: "OPEN", updatedAt: new Date() }).where(eq(stores.id, store.id)).returning();
  }
  await ensureRoleAssignment(input.merchantUser.id, input.merchantRoleId, store.id);
  const [unit] = await db.select({ id: units.id }).from(units).where(and(eq(units.storeId, store.id), eq(units.name, "قطعة"))).limit(1);
  if (!unit) await db.insert(units).values({ storeId: store.id, name: "قطعة", symbol: "1 قطعة", isActive: true, sortOrder: 1 });
  let [category] = await db.select().from(categories).where(and(eq(categories.storeId, store.id), eq(categories.slug, "qa-catalog"))).limit(1);
  if (!category) [category] = await db.insert(categories).values({ storeId: store.id, name: "QA Catalog", slug: "qa-catalog", code: "QA-CATALOG", codeMode: "manual", isActive: true, sortOrder: 1 }).returning();
  let [product] = await db.select().from(products).where(and(eq(products.storeId, store.id), eq(products.slug, "qa-product"))).limit(1);
  if (!product) [product] = await db.insert(products).values({ storeId: store.id, categoryId: category.id, name: "QA Product", slug: "qa-product", productCode: "QA-PRODUCT", codeMode: "manual", shortDescription: "منتج اختبار آمن لبيئة local/staging.", type: "simple", status: "active", basePrice: "1000", pricingMode: "independent", inventoryMode: "variant", productCommerceType: "ONLINE_SALES" }).returning();
  const [variant] = await db.select().from(productVariants).where(and(eq(productVariants.productId, product.id), eq(productVariants.sku, "QA-PRODUCT-STD"))).limit(1);
  if (!variant) {
    const [defaultUnit] = await db.select({ id: units.id }).from(units).where(and(eq(units.storeId, store.id), eq(units.isActive, true))).limit(1);
    await db.insert(productVariants).values({ productId: product.id, sku: "QA-PRODUCT-STD", title: "QA Standard", unitId: defaultUnit?.id || null, price: "1000", stockQuantity: 100, lowStockThreshold: 5, isActive: true });
  }
  const paymentCode = `qa-cod-${store.id.slice(0, 8)}`;
  const [paymentMethod] = await db.select({ id: paymentMethods.id }).from(paymentMethods).where(eq(paymentMethods.code, paymentCode)).limit(1);
  if (!paymentMethod) await db.insert(paymentMethods).values({ storeId: store.id, name: "QA Cash on Delivery", code: paymentCode, provider: "cod", config: {}, isActive: true, sortOrder: 1 });
  const shippingCode = `qa-shipping-${store.id.slice(0, 8)}`;
  const [shippingMethod] = await db.select({ id: shippingMethods.id }).from(shippingMethods).where(eq(shippingMethods.code, shippingCode)).limit(1);
  if (!shippingMethod) await db.insert(shippingMethods).values({ storeId: store.id, name: "QA Shipping", code: shippingCode, fee: "0", estimatedDaysMin: 1, estimatedDaysMax: 2, isActive: true, sortOrder: 1 });
  return { id: store.id, slug: store.slug, productId: product.id, productSlug: product.slug };
}

async function main() {
  const config = assertSafeEnvironment();
  const [adminRole, merchantRole, customerRole] = await Promise.all([requireRole("super_admin"), requireRole("merchant"), requireRole("customer")]);
  const [admins, merchantUsers, customers] = await Promise.all([
    Promise.all(config.admins.map((account) => ensureUser({ ...account, resetPasswords: config.resetPasswords }))),
    Promise.all(config.merchants.map((account) => ensureUser({ ...account, resetPasswords: config.resetPasswords }))),
    Promise.all(config.customers.map((account) => ensureUser({ ...account, resetPasswords: config.resetPasswords })))
  ]);
  for (const admin of admins) await ensureRoleAssignment(admin.id, adminRole.id);
  for (const customer of customers) await ensureRoleAssignment(customer.id, customerRole.id);
  const storesCreated = [];
  for (const [index, merchantUser] of merchantUsers.entries()) {
    let [merchantProfile] = await db.select().from(merchants).where(eq(merchants.userId, merchantUser.id)).limit(1);
    if (!merchantProfile) [merchantProfile] = await db.insert(merchants).values({ userId: merchantUser.id, merchantNumber: `QA-MER-${nanoid(10).toUpperCase()}`, status: "active", activatedAt: new Date() }).returning();
    const slug = index === 0 ? config.storeSlug : `${config.storeSlug}-2`;
    storesCreated.push(await ensureQaStore({ merchantUser, merchantProfile, storeSlug: slug, index: index + 1, merchantRoleId: merchantRole.id }));
  }
  await ensureOrderStatuses();
  console.log(JSON.stringify({
    ok: true,
    environment: process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    accounts: { admins: admins.map((user) => user.email), merchants: merchantUsers.map((user) => user.email), customers: customers.map((user) => user.email) },
    stores: storesCreated,
    passwordsReset: config.resetPasswords,
    message: "ستة حسابات QA جاهزة. كلمات المرور لا تُطبع؛ استخدم القيم التي أدخلتها عبر متغيرات البيئة. حسابات QA ممنوعة من مركز التحكم الحساس."
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
