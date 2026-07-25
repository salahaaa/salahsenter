import "dotenv/config";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import {
  categories,
  client,
  db,
  merchants,
  orderStatusDefinitions,
  paymentMethods,
  permissions,
  platformEmployees,
  productVariants,
  products,
  rolePermissions,
  roles,
  shippingMethods,
  storeEmployees,
  stores,
  units,
  userRoles,
  users
} from "@/lib/db";
import {
  STAGING_TEST_TEAM_ACCOUNT_KEYS,
  STAGING_TEST_TEAM_PROFILES,
  type StagingTestTeamAccountKey,
  validateStagingTestTeamProfiles
} from "@/lib/qa/staging-test-team";

const confirmationValue = "PROVISION_STAGING_TEST_TEAM";
const accountSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(16).max(512)
});
const teamInputSchema = z.object(
  Object.fromEntries(STAGING_TEST_TEAM_ACCOUNT_KEYS.map((key) => [key, accountSchema])) as Record<StagingTestTeamAccountKey, typeof accountSchema>
).strict();

type TeamAccount = z.infer<typeof accountSchema>;
type TeamInput = Record<StagingTestTeamAccountKey, TeamAccount>;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} مطلوب لتنفيذ العملية المقصودة.`);
  return value;
}

function isUnsafePassword(value: string) {
  return /demo|example|change.?me|replace|password123/i.test(value);
}

function assertStagingOnly() {
  if (process.env.QA_STAGING_TEAM_CONFIRM !== confirmationValue) {
    throw new Error(`تم إيقاف إنشاء فريق الاختبار. عيّن QA_STAGING_TEAM_CONFIRM=${confirmationValue} صراحة.`);
  }
  if (process.env.APP_ENV !== "staging") {
    throw new Error("هذا السكربت يعمل فقط عند APP_ENV=staging؛ لا يقبل local أو preview أو production.");
  }
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production" && process.env.APP_ENV !== "staging") {
    throw new Error("إنشاء فريق الاختبار محظور تماماً على Production.");
  }
  required("DATABASE_URL");
}

function readTeamInput(): TeamInput {
  const raw = required("STAGING_QA_TEAM_JSON");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("STAGING_QA_TEAM_JSON يجب أن يكون JSON صحيحاً؛ لا تطبع قيمته في السجل.");
  }
  const team = teamInputSchema.parse(parsed) as TeamInput;
  const emails = new Set<string>();
  for (const key of STAGING_TEST_TEAM_ACCOUNT_KEYS) {
    const account = team[key];
    if (isUnsafePassword(account.password)) throw new Error(`كلمة مرور حساب ${key} تبدو افتراضية أو تجريبية وغير مسموح بها.`);
    if (emails.has(account.email)) throw new Error("يجب أن يكون لكل عضو في فريق الاختبار بريد مختلف.");
    emails.add(account.email);
  }
  return team;
}

function qaUsername(key: StagingTestTeamAccountKey) {
  return `stgqa_${key}`.toLowerCase();
}

async function ensureTestUser(input: { key: StagingTestTeamAccountKey; account: TeamAccount; resetPasswords: boolean }) {
  const [existing] = await db.select().from(users).where(eq(users.email, input.account.email)).limit(1);
  if (existing) {
    if (!existing.isTestAccount) {
      throw new Error(`البريد المرتبط بملف ${input.key} يخص حساباً غير تجريبي؛ لن يحوله السكربت إلى حساب QA.`);
    }
    if (existing.status !== "active" && !input.resetPasswords) {
      throw new Error(`حساب ${input.key} غير نشط. لا تعِد تفعيله تلقائياً؛ راجع السجل أو استخدم إعادة الضبط المقصودة.`);
    }
    const patch: Record<string, unknown> = {
      fullName: input.account.name,
      isTestAccount: true,
      emailVerifiedAt: existing.emailVerifiedAt || new Date(),
      updatedAt: new Date()
    };
    if (input.resetPasswords) {
      patch.passwordHash = await hashPassword(input.account.password);
      patch.mustChangePassword = true;
      patch.status = "active";
    }
    const [updated] = await db.update(users).set(patch).where(eq(users.id, existing.id)).returning();
    return { user: updated, created: false, passwordReset: input.resetPasswords };
  }

  const [created] = await db
    .insert(users)
    .values({
      fullName: input.account.name,
      email: input.account.email,
      username: qaUsername(input.key),
      passwordHash: await hashPassword(input.account.password),
      mustChangePassword: true,
      isTestAccount: true,
      status: "active",
      emailVerifiedAt: new Date()
    })
    .returning();
  return { user: created, created: true, passwordReset: false };
}

async function ensureRole(input: { code: string; name: string; description: string; scope: "system" | "store"; permissionCodes: readonly string[] }) {
  let [role] = await db.select().from(roles).where(eq(roles.code, input.code)).limit(1);
  if (role) {
    [role] = await db
      .update(roles)
      .set({ name: input.name, description: input.description, scope: input.scope, isSystem: false, updatedAt: new Date() })
      .where(eq(roles.id, role.id))
      .returning();
  } else {
    [role] = await db
      .insert(roles)
      .values({ code: input.code, name: input.name, description: input.description, scope: input.scope, isSystem: false })
      .returning();
  }

  const codes = [...new Set(input.permissionCodes)];
  const rows = codes.length ? await db.select({ id: permissions.id, code: permissions.code }).from(permissions).where(inArray(permissions.code, codes)) : [];
  if (rows.length !== codes.length) {
    const found = new Set(rows.map((row) => row.code));
    throw new Error(`مخطط Staging لا يحتوي الصلاحيات المطلوبة لدور ${input.code}: ${codes.filter((code) => !found.has(code)).join(", ")}. طبّق migrations المعتمدة أولاً.`);
  }

  // Only role codes beginning qa_staging_ are passed to this function. Replacing
  // their permissions makes the workflow idempotent without touching real roles.
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
  if (rows.length) await db.insert(rolePermissions).values(rows.map((permission) => ({ roleId: role.id, permissionId: permission.id })));
  return role;
}

async function ensureUserRole(userId: string, roleId: string, storeId: string | null) {
  const condition = storeId
    ? and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId), eq(userRoles.storeId, storeId))
    : and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId), isNull(userRoles.storeId));
  const [existing] = await db.select({ id: userRoles.id }).from(userRoles).where(condition).limit(1);
  if (!existing) await db.insert(userRoles).values({ userId, roleId, storeId });
}

async function ensurePlatformEmployee(userId: string, key: StagingTestTeamAccountKey, title: string, profileRoleId: string) {
  const identityRole = await ensureRole({
    code: `qa_staging_platform_identity_${key}`,
    name: `هوية QA منصة — ${key}`,
    description: "هوية خاصة بحساب اختبار Staging؛ لا تحمل صلاحيات.",
    scope: "system",
    permissionCodes: []
  });
  await ensureUserRole(userId, identityRole.id, null);
  await ensureUserRole(userId, profileRoleId, null);

  const [existing] = await db.select().from(platformEmployees).where(eq(platformEmployees.userId, userId)).limit(1);
  if (!existing) {
    await db.insert(platformEmployees).values({
      userId,
      directRoleId: identityRole.id,
      groupRoleId: profileRoleId,
      employeeNumber: `STG-QA-${key.replace(/([A-Z])/g, "-$1").toUpperCase()}`,
      jobTitle: title,
      departmentGroup: "Staging QA",
      status: "active",
      notes: "حساب اختبار مرحلي فقط؛ لا يستخدم في Production."
    });
  } else {
    await db
      .update(platformEmployees)
      .set({ directRoleId: identityRole.id, groupRoleId: profileRoleId, jobTitle: title, departmentGroup: "Staging QA", status: "active", updatedAt: new Date() })
      .where(eq(platformEmployees.id, existing.id));
  }
}

async function ensureMerchantProfile(userId: string, slot: 1 | 2) {
  let [profile] = await db.select().from(merchants).where(eq(merchants.userId, userId)).limit(1);
  if (!profile) {
    [profile] = await db
      .insert(merchants)
      .values({ userId, merchantNumber: `STG-QA-MER-${slot}`, status: "active", activatedAt: new Date() })
      .returning();
  }
  return profile;
}

async function ensureTestStore(input: { ownerId: string; slot: 1 | 2; slugPrefix: string }) {
  const slug = `${input.slugPrefix}-store-${input.slot}`;
  let [merchantProfile] = await db.select().from(merchants).where(eq(merchants.userId, input.ownerId)).limit(1);
  if (!merchantProfile) merchantProfile = await ensureMerchantProfile(input.ownerId, input.slot);

  let [store] = await db.select().from(stores).where(eq(stores.slug, slug)).limit(1);
  if (store) {
    if (!store.storeNumber.startsWith("STG-QA-") || store.merchantId !== input.ownerId) {
      throw new Error(`المتجر ذو slug ${slug} ليس متجراً QA مملوكاً لعضو الفريق المتوقع؛ لن يتم تعديله.`);
    }
  } else {
    [store] = await db
      .insert(stores)
      .values({
        merchantId: input.ownerId,
        merchantProfileId: merchantProfile.id,
        storeNumber: `STG-QA-STORE-${input.slot}`,
        name: `متجر فريق الاختبار المرحلي ${input.slot}`,
        slug,
        description: "STAGING TEST ONLY — متجر وتجارب قبول بشرية، لا يستخدم في Production.",
        status: "active",
        isActive: true,
        operationStatus: "OPEN",
        profileCompleteness: 100,
        contactEmail: `staging-qa-store-${input.slot}@invalid.local`
      })
      .returning();
  }

  const [unit] = await db.select({ id: units.id }).from(units).where(and(eq(units.storeId, store.id), eq(units.name, "قطعة"))).limit(1);
  if (!unit) await db.insert(units).values({ storeId: store.id, name: "قطعة", symbol: "1 قطعة", isActive: true, sortOrder: 1 });

  let [category] = await db.select().from(categories).where(and(eq(categories.storeId, store.id), eq(categories.slug, "staging-qa"))).limit(1);
  if (!category) {
    [category] = await db
      .insert(categories)
      .values({ storeId: store.id, name: "كتالوج اختبار مرحلي", slug: "staging-qa", code: `STG-QA-CATALOG-${input.slot}`, codeMode: "manual", isActive: true, sortOrder: 1 })
      .returning();
  }

  // The fixture intentionally starts as draft with zero price and stock. The
  // catalog worker must activate it through the same normal workflow used by a
  // merchant before any checkout scenario can begin.
  let [product] = await db.select().from(products).where(and(eq(products.storeId, store.id), eq(products.slug, "staging-qa-product"))).limit(1);
  if (!product) {
    [product] = await db
      .insert(products)
      .values({
        storeId: store.id,
        categoryId: category.id,
        name: `منتج اختبار مرحلي ${input.slot}`,
        slug: "staging-qa-product",
        productCode: `STG-QA-PRODUCT-${input.slot}`,
        codeMode: "manual",
        shortDescription: "منتج مسودة لاختبار إدخال التاجر؛ يجب تفعيله وتسعيره يدوياً في Staging.",
        type: "simple",
        status: "draft",
        basePrice: "0",
        pricingMode: "independent",
        inventoryMode: "variant",
        productCommerceType: "ONLINE_SALES"
      })
      .returning();
  }
  const [variant] = await db.select({ id: productVariants.id }).from(productVariants).where(and(eq(productVariants.productId, product.id), eq(productVariants.sku, `STG-QA-${input.slot}-STD`))).limit(1);
  if (!variant) {
    const [defaultUnit] = await db.select({ id: units.id }).from(units).where(and(eq(units.storeId, store.id), eq(units.isActive, true))).limit(1);
    await db.insert(productVariants).values({ productId: product.id, sku: `STG-QA-${input.slot}-STD`, title: "قياسي — اختبار مرحلي", unitId: defaultUnit?.id || null, price: "0", stockQuantity: 0, lowStockThreshold: 1, isActive: true });
  }

  const paymentCode = `stg-qa-cod-${input.slot}`;
  const [payment] = await db.select({ id: paymentMethods.id }).from(paymentMethods).where(and(eq(paymentMethods.storeId, store.id), eq(paymentMethods.code, paymentCode))).limit(1);
  if (!payment) await db.insert(paymentMethods).values({ storeId: store.id, name: "دفع عند الاستلام — اختبار Staging", code: paymentCode, provider: "cod", config: { qaOnly: true }, isActive: true, sortOrder: 1 });

  const shippingCode = `stg-qa-shipping-${input.slot}`;
  const [shipping] = await db.select({ id: shippingMethods.id }).from(shippingMethods).where(and(eq(shippingMethods.storeId, store.id), eq(shippingMethods.code, shippingCode))).limit(1);
  if (!shipping) await db.insert(shippingMethods).values({ storeId: store.id, name: "شحن اختبار Staging", code: shippingCode, fee: "0", estimatedDaysMin: 1, estimatedDaysMax: 2, isActive: true, sortOrder: 1 });

  return store;
}

async function ensureStoreEmployee(input: { userId: string; key: StagingTestTeamAccountKey; storeId: string; title: string; profileRoleId: string }) {
  const identityRole = await ensureRole({
    code: `qa_staging_store_identity_${input.key}`,
    name: `هوية QA متجر — ${input.key}`,
    description: "هوية خاصة بموظف متجر اختبار Staging؛ لا تحمل صلاحيات.",
    scope: "store",
    permissionCodes: []
  });
  await ensureUserRole(input.userId, identityRole.id, input.storeId);
  await ensureUserRole(input.userId, input.profileRoleId, input.storeId);

  const [existing] = await db.select().from(storeEmployees).where(and(eq(storeEmployees.storeId, input.storeId), eq(storeEmployees.userId, input.userId))).limit(1);
  if (!existing) {
    await db.insert(storeEmployees).values({
      storeId: input.storeId,
      userId: input.userId,
      roleId: identityRole.id,
      groupRoleId: input.profileRoleId,
      employeeCode: `STG-QA-${input.key.replace(/([A-Z])/g, "-$1").toUpperCase()}`,
      jobTitle: input.title,
      status: "active",
      notes: "حساب اختبار مرحلي فقط؛ لا يستخدم في Production."
    });
  } else {
    await db.update(storeEmployees).set({ roleId: identityRole.id, groupRoleId: input.profileRoleId, jobTitle: input.title, status: "active", updatedAt: new Date() }).where(eq(storeEmployees.id, existing.id));
  }
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

async function main() {
  assertStagingOnly();
  validateStagingTestTeamProfiles();
  const team = readTeamInput();
  const resetPasswords = process.env.STAGING_QA_RESET_PASSWORDS === "true";
  const slugPrefix = (process.env.STAGING_QA_STORE_SLUG_PREFIX || "qa-team").trim().toLowerCase();
  if (!/^[a-z0-9-]{3,80}$/.test(slugPrefix)) throw new Error("STAGING_QA_STORE_SLUG_PREFIX يجب أن يحتوي أحرفاً إنجليزية صغيرة وأرقاماً وشرطة فقط.");

  const usersByKey = new Map<StagingTestTeamAccountKey, Awaited<ReturnType<typeof ensureTestUser>>["user"]>();
  let createdAccounts = 0;
  let resetAccounts = 0;
  for (const key of STAGING_TEST_TEAM_ACCOUNT_KEYS) {
    const result = await ensureTestUser({ key, account: team[key], resetPasswords });
    usersByKey.set(key, result.user);
    if (result.created) createdAccounts += 1;
    if (result.passwordReset) resetAccounts += 1;
  }

  const profileRoles = new Map<StagingTestTeamAccountKey, typeof roles.$inferSelect>();
  for (const profile of STAGING_TEST_TEAM_PROFILES) {
    if (profile.kind === "customer") continue;
    const role = await ensureRole({
      code: `qa_staging_${profile.kind}_${profile.key}`,
      name: `QA Staging — ${profile.title}`,
      description: `دور تلقائي لفريق اختبار Staging فقط: ${profile.description}`,
      scope: profile.kind === "platform_employee" ? "system" : "store",
      permissionCodes: profile.permissionCodes
    });
    profileRoles.set(profile.key, role);
  }

  const [customerRole] = await db.select().from(roles).where(eq(roles.code, "customer")).limit(1);
  if (!customerRole) throw new Error("دور customer غير موجود. طبّق migrations المعتمدة أولاً.");
  for (const profile of STAGING_TEST_TEAM_PROFILES.filter((profile) => profile.kind === "customer")) {
    await ensureUserRole(usersByKey.get(profile.key)!.id, customerRole.id, null);
  }

  for (const profile of STAGING_TEST_TEAM_PROFILES.filter((profile) => profile.kind === "platform_employee")) {
    await ensurePlatformEmployee(usersByKey.get(profile.key)!.id, profile.key, profile.title, profileRoles.get(profile.key)!.id);
  }

  const storesBySlot = new Map<1 | 2, typeof stores.$inferSelect>();
  for (const profile of STAGING_TEST_TEAM_PROFILES.filter((profile) => profile.kind === "merchant_owner")) {
    const store = await ensureTestStore({ ownerId: usersByKey.get(profile.key)!.id, slot: profile.storeSlot!, slugPrefix });
    storesBySlot.set(profile.storeSlot!, store);
    await ensureUserRole(usersByKey.get(profile.key)!.id, profileRoles.get(profile.key)!.id, store.id);
  }

  for (const profile of STAGING_TEST_TEAM_PROFILES.filter((profile) => profile.kind === "store_employee")) {
    const store = storesBySlot.get(profile.storeSlot!);
    if (!store) throw new Error(`لم يتم إنشاء متجر Staging للملف ${profile.key}.`);
    await ensureStoreEmployee({ userId: usersByKey.get(profile.key)!.id, key: profile.key, storeId: store.id, title: profile.title, profileRoleId: profileRoles.get(profile.key)!.id });
  }

  await ensureOrderStatuses();
  console.log(JSON.stringify({
    ok: true,
    environment: "staging",
    createdAccounts,
    resetAccounts,
    accountProfiles: STAGING_TEST_TEAM_PROFILES.map((profile) => ({ key: profile.key, kind: profile.kind, title: profile.title, storeSlot: profile.storeSlot || null })),
    stores: [...storesBySlot.values()].map((store) => ({ slot: store.storeNumber.replace("STG-QA-STORE-", ""), slug: store.slug, productStartsDraft: true, priceStartsAt: 0, stockStartsAt: 0 })),
    passwordPolicy: "كلمات المرور لا تطبع. الحسابات الجديدة تطلب تغيير كلمة المرور عند أول دخول.",
    safety: "كل الحسابات is_test_account=true؛ لا توجد صلاحية super_admin أو وصول إلى مركز التحكم الحساس ضمن هذا الفريق."
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
