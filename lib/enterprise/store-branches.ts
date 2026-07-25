import { and, desc, eq, ne, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { pickPaymentInstructionConfig } from "@/lib/payments/config";
import {
  categories,
  colors,
  db,
  paymentMethods,
  productAttributes,
  productAttributeValues,
  roles,
  merchantContractAddendums,
  notifications,
  shippingMethods,
  sizes,
  storeBranchProfiles,
  storeGroups,
  storeRentInvoices,
  stores,
  storeMedia,
  storeWings,
  units,
  userRoles,
  type Store
} from "@/lib/db";
import { uniqueSlug } from "@/lib/slug";
import { writeAuditLog } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { assertRentalLimit, lockRentalEntitlement } from "@/lib/rentals/service";
import { activateSignedBranchFinancialAddendum, createBranchFinancialAddendum } from "@/lib/contracts/addendums";

export type BranchCreateInput = {
  branchName: string;
  countryId?: string | null;
  governorateId?: string | null;
  cityId?: string | null;
  districtId?: string | null;
  address?: string;
  contactPhone?: string;
  contactEmail?: string;
  primaryWingId?: string | null;
  rentAmount?: number;
  rentCurrency?: string;
  rentCycle?: "monthly" | "quarterly" | "semi_annual" | "annual";
  notes?: string;
};

export type BranchApprovalInput = {
  branchId: string;
  status: "approved" | "rejected";
  revenueModel?: "monthly_rent" | "sales_commission" | "hybrid";
  rentAmount?: number;
  commissionRate?: number;
  rentCurrency?: string;
  dueDays?: number;
  graceDays?: number;
  adminNote?: string;
};

async function generateStoreNumber(tx: any = db) {
  for (let i = 0; i < 10; i++) {
    const candidate = `SLH-${nanoid(6).toUpperCase()}`;
    const exists = await tx.select({ id: stores.id }).from(stores).where(eq(stores.storeNumber, candidate)).limit(1);
    if (!exists.length) return candidate;
  }
  throw new Error("تعذر توليد رقم متجر فريد");
}

async function generateBranchCode(groupId: string, tx: any = db) {
  for (let i = 0; i < 10; i++) {
    const candidate = `BR-${nanoid(5).toUpperCase()}`;
    const exists = await tx.select({ id: storeBranchProfiles.id }).from(storeBranchProfiles).where(and(eq(storeBranchProfiles.groupId, groupId), eq(storeBranchProfiles.branchCode, candidate))).limit(1);
    if (!exists.length) return candidate;
  }
  throw new Error("تعذر توليد رقم فرع فريد");
}

async function ensureGroup(merchantId: string, mainStore: Store, tx: any = db) {
  const [existing] = await tx.select().from(storeGroups).where(and(eq(storeGroups.merchantId, merchantId), eq(storeGroups.status, "active"))).limit(1);
  if (existing) return existing;
  const [group] = await tx.insert(storeGroups).values({
    merchantId,
    merchantProfileId: mainStore.merchantProfileId,
    mainStoreId: mainStore.id,
    companyName: mainStore.name,
    commercialName: mainStore.name
  }).returning();
  const [branchCode] = [`MAIN-${nanoid(4).toUpperCase()}`];
  await tx.insert(storeBranchProfiles).values({
    groupId: group.id,
    storeId: mainStore.id,
    parentStoreId: null,
    branchCode,
    branchName: mainStore.name,
    branchType: "main",
    countryId: mainStore.countryId,
    governorateId: mainStore.governorateId,
    cityId: mainStore.cityId,
    districtId: mainStore.districtId,
    address: null,
    rentAmount: "0",
    rentCurrency: "YER",
    rentCycle: "monthly",
    rentStatus: "active",
    approvalStatus: "approved",
    approvedAt: new Date(),
    createdBy: merchantId
  }).onConflictDoNothing();
  return group;
}

export async function listMerchantBranches(merchantId: string) {
  const rows = await db
    .select({ store: stores, branch: storeBranchProfiles, group: storeGroups, addendum: merchantContractAddendums })
    .from(stores)
    .leftJoin(storeBranchProfiles, eq(storeBranchProfiles.storeId, stores.id))
    .leftJoin(storeGroups, eq(storeBranchProfiles.groupId, storeGroups.id))
    .leftJoin(merchantContractAddendums, eq(storeBranchProfiles.contractAddendumId, merchantContractAddendums.id))
    .where(eq(stores.merchantId, merchantId))
    .orderBy(desc(stores.createdAt));

  const invoices = await db.select().from(storeRentInvoices).where(eq(storeRentInvoices.merchantId, merchantId)).orderBy(desc(storeRentInvoices.createdAt)).limit(100);
  return { branches: rows, invoices };
}

export async function createMerchantBranch(merchantId: string, payload: BranchCreateInput) {
  const [mainStore] = await db.select().from(stores).where(eq(stores.merchantId, merchantId)).orderBy(stores.createdAt).limit(1);
  if (!mainStore) throw new Error("يجب أن يكون لديك متجر رئيسي معتمد قبل فتح فروع إضافية");

  const result = await db.transaction(async (tx) => {
    await lockRentalEntitlement(mainStore.id, tx);
    const group = await ensureGroup(merchantId, mainStore, tx);
    const [{ count: currentCount }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(storeBranchProfiles)
      .where(and(eq(storeBranchProfiles.groupId, group.id), ne(storeBranchProfiles.approvalStatus, "rejected")));
    await assertRentalLimit({ storeId: mainStore.id, resource: "branches", currentCount, tx });

    const [merchantRole] = await tx.select().from(roles).where(eq(roles.code, "merchant")).limit(1);
    const branchStoreName = `${group.companyName} - ${payload.branchName}`;
    const [store] = await tx.insert(stores).values({
      merchantId,
      merchantProfileId: mainStore.merchantProfileId,
      storeNumber: await generateStoreNumber(tx),
      name: branchStoreName,
      slug: uniqueSlug(branchStoreName),
      description: payload.notes || mainStore.description,
      primaryWingId: payload.primaryWingId || mainStore.primaryWingId,
      countryId: payload.countryId || mainStore.countryId,
      governorateId: payload.governorateId || mainStore.governorateId,
      cityId: payload.cityId || mainStore.cityId,
      districtId: payload.districtId || mainStore.districtId,
      contactPhone: payload.contactPhone || mainStore.contactPhone,
      contactEmail: payload.contactEmail || mainStore.contactEmail,
      logoUrl: mainStore.logoUrl,
      coverImageUrl: mainStore.coverImageUrl,
      status: "pending",
      isActive: false
    }).returning();

    if (store.primaryWingId) await tx.insert(storeWings).values({ storeId: store.id, wingId: store.primaryWingId }).onConflictDoNothing();
    if (merchantRole) await tx.insert(userRoles).values({ userId: merchantId, roleId: merchantRole.id, storeId: store.id }).onConflictDoNothing();

    const [branch] = await tx.insert(storeBranchProfiles).values({
      groupId: group.id,
      storeId: store.id,
      parentStoreId: mainStore.id,
      branchCode: await generateBranchCode(group.id, tx),
      branchName: payload.branchName,
      branchType: "branch",
      countryId: store.countryId,
      governorateId: store.governorateId,
      cityId: store.cityId,
      districtId: store.districtId,
      address: payload.address || null,
      rentAmount: String(payload.rentAmount || 0),
      rentCurrency: payload.rentCurrency || "YER",
      rentCycle: payload.rentCycle || "monthly",
      rentStatus: "pending",
      approvalStatus: "pending_approval",
      createdBy: merchantId,
      adminNote: payload.notes
    }).returning();

    return { store, branch, group };
  });

  await writeAuditLog({ actorId: merchantId, action: "create", entityType: "store_branch_request", entityId: result.branch.id, afterData: result });
  await notifyAdmins({
    title: "طلب فتح فرع جديد",
    body: `طلب التاجر فتح فرع: ${result.branch.branchName} ضمن ${result.group.companyName}`,
    type: "admin_new_store_branch_request",
    data: { branchId: result.branch.id, storeId: result.store.id, groupId: result.group.id }
  });
  return result;
}

export async function listAdminBranches() {
  return db
    .select({ branch: storeBranchProfiles, store: stores, group: storeGroups, addendum: merchantContractAddendums })
    .from(storeBranchProfiles)
    .innerJoin(stores, eq(storeBranchProfiles.storeId, stores.id))
    .innerJoin(storeGroups, eq(storeBranchProfiles.groupId, storeGroups.id))
    .leftJoin(merchantContractAddendums, eq(storeBranchProfiles.contractAddendumId, merchantContractAddendums.id))
    .orderBy(desc(storeBranchProfiles.createdAt))
    .limit(300);
}

export async function reviewBranch(adminId: string, payload: BranchApprovalInput) {
  const [existing] = await db.select({ branch: storeBranchProfiles, store: stores, group: storeGroups })
    .from(storeBranchProfiles)
    .innerJoin(stores, eq(storeBranchProfiles.storeId, stores.id))
    .innerJoin(storeGroups, eq(storeBranchProfiles.groupId, storeGroups.id))
    .where(eq(storeBranchProfiles.id, payload.branchId))
    .limit(1);
  if (!existing) throw new Error("طلب الفرع غير موجود");

  if (payload.status === "rejected") {
    const result = await db.transaction(async (tx) => {
      const [branch] = await tx.update(storeBranchProfiles).set({ approvalStatus: "rejected", adminNote: payload.adminNote, approvedBy: adminId, approvedAt: new Date(), updatedAt: new Date() }).where(eq(storeBranchProfiles.id, payload.branchId)).returning();
      const [store] = await tx.update(stores).set({ status: "closed", isActive: false, updatedAt: new Date() }).where(eq(stores.id, existing.store.id)).returning();
      return { branch, store, addendum: null };
    });
    await writeAuditLog({ actorId: adminId, action: "reject", entityType: "store_branch", entityId: payload.branchId, beforeData: existing, afterData: result });
    return result;
  }

  const result = await createBranchFinancialAddendum({
    branchId: payload.branchId,
    actorId: adminId,
    revenueModel: payload.revenueModel || "monthly_rent",
    monthlyRent: Math.max(0, Number(payload.rentAmount ?? existing.branch.rentAmount ?? 0)),
    commissionRate: Math.max(0, Number(payload.commissionRate ?? existing.branch.commissionRate ?? 0)),
    currency: payload.rentCurrency || existing.branch.rentCurrency || "YER",
    dueDays: payload.dueDays ?? existing.branch.dueDays ?? 7,
    graceDays: payload.graceDays ?? existing.branch.graceDays ?? 7,
    note: payload.adminNote
  });
  await writeAuditLog({ actorId: adminId, action: "approve", entityType: "store_branch_contract_addendum", entityId: payload.branchId, beforeData: existing, afterData: result });
  return { branch: result.branch, store: existing.store, addendum: result.addendum, accessToken: result.accessToken };
}

export async function activateBranchFinancialTerms(adminId: string, addendumId: string, note?: string | null) {
  const result = await activateSignedBranchFinancialAddendum({ addendumId, actorId: adminId, note });
  await writeAuditLog({ actorId: adminId, action: "approve", category: "financial", entityType: "store_branch_financial_terms", entityId: result.branch.id, beforeData: result.before, afterData: result });
  await db.insert(notifications).values({ userId: result.store.merchantId, storeId: result.store.id, title: "تم اعتماد ملحق الفرع وتفعيل الدورة المالية", body: "أصبح للفرع عقد ملحق وشروط إيرادات مستقلة ضمن كشوف إيرادات المنصة.", type: "branch_financial_cycle_activated", data: { branchId: result.branch.id, storeId: result.store.id, revenueTermsId: result.terms.id, addendumId, url: "/merchant/platform-revenue" } });
  return result;
}

export async function copyMainStoreSettingsToBranch(merchantId: string, branchStoreId: string) {
  const [branchRow] = await db
    .select({ branch: storeBranchProfiles, store: stores, group: storeGroups })
    .from(storeBranchProfiles)
    .innerJoin(stores, eq(storeBranchProfiles.storeId, stores.id))
    .innerJoin(storeGroups, eq(storeBranchProfiles.groupId, storeGroups.id))
    .where(and(eq(storeBranchProfiles.storeId, branchStoreId), eq(stores.merchantId, merchantId)))
    .limit(1);

  if (!branchRow) throw new Error("الفرع غير موجود أو لا يتبع حسابك");
  if (branchRow.branch.approvalStatus !== "approved" || branchRow.store.status !== "active") {
    throw new Error("لا يمكن سحب الإعدادات إلا بعد اعتماد وتفعيل الفرع من الإدارة");
  }

  const sourceStoreId = branchRow.branch.parentStoreId || branchRow.group.mainStoreId;
  if (!sourceStoreId) throw new Error("لا يوجد متجر رئيسي لسحب الإعدادات منه");
  if (sourceStoreId === branchStoreId) throw new Error("لا يمكن نسخ الإعدادات إلى نفس المتجر");

  const result = await db.transaction(async (tx) => {
    const copied = { categories: 0, units: 0, sizes: 0, colors: 0, attributes: 0, values: 0, paymentMethods: 0, shippingMethods: 0, media: 0 };

    const sourceUnits = await tx.select().from(units).where(eq(units.storeId, sourceStoreId));
    for (const item of sourceUnits) {
      await tx.insert(units).values({ storeId: branchStoreId, name: item.name, symbol: item.symbol, isActive: item.isActive, sortOrder: item.sortOrder }).onConflictDoNothing();
      copied.units++;
    }

    const sourceSizes = await tx.select().from(sizes).where(eq(sizes.storeId, sourceStoreId));
    for (const item of sourceSizes) {
      await tx.insert(sizes).values({ storeId: branchStoreId, name: item.name, isActive: item.isActive, sortOrder: item.sortOrder }).onConflictDoNothing();
      copied.sizes++;
    }

    const sourceColors = await tx.select().from(colors).where(eq(colors.storeId, sourceStoreId));
    for (const item of sourceColors) {
      await tx.insert(colors).values({ storeId: branchStoreId, name: item.name, hexCode: item.hexCode, isActive: item.isActive, sortOrder: item.sortOrder }).onConflictDoNothing();
      copied.colors++;
    }

    const categoryRows = await tx.select().from(categories).where(eq(categories.storeId, sourceStoreId)).orderBy(categories.level, categories.sortOrder, categories.name);
    const categoryMap = new Map<string, string>();
    for (const item of categoryRows) {
      const parentId = item.parentId ? categoryMap.get(item.parentId) || null : null;
      const [existing] = await tx.select({ id: categories.id }).from(categories).where(and(eq(categories.storeId, branchStoreId), eq(categories.slug, item.slug))).limit(1);
      if (existing) {
        categoryMap.set(item.id, existing.id);
        continue;
      }
      const [created] = await tx.insert(categories).values({
        storeId: branchStoreId,
        parentId,
        code: item.code,
        codeMode: item.codeMode,
        level: item.level,
        name: item.name,
        slug: item.slug,
        imageUrl: item.imageUrl,
        isActive: item.isActive,
        sortOrder: item.sortOrder
      }).returning({ id: categories.id });
      categoryMap.set(item.id, created.id);
      copied.categories++;
    }

    const attrRows = await tx.select().from(productAttributes).where(eq(productAttributes.storeId, sourceStoreId)).orderBy(productAttributes.sortOrder, productAttributes.name);
    const attrMap = new Map<string, string>();
    for (const attr of attrRows) {
      const [existing] = await tx.select({ id: productAttributes.id }).from(productAttributes).where(and(eq(productAttributes.storeId, branchStoreId), eq(productAttributes.code, attr.code))).limit(1);
      if (existing) {
        attrMap.set(attr.id, existing.id);
        continue;
      }
      const [created] = await tx.insert(productAttributes).values({
        storeId: branchStoreId,
        name: attr.name,
        code: attr.code,
        displayType: attr.displayType,
        isVariantOption: attr.isVariantOption,
        isRequired: attr.isRequired,
        sortOrder: attr.sortOrder,
        isActive: attr.isActive
      }).returning({ id: productAttributes.id });
      attrMap.set(attr.id, created.id);
      copied.attributes++;
    }

    for (const attr of attrRows) {
      const nextAttrId = attrMap.get(attr.id);
      if (!nextAttrId) continue;
      const valueRows = await tx.select().from(productAttributeValues).where(eq(productAttributeValues.attributeId, attr.id));
      for (const value of valueRows) {
        await tx.insert(productAttributeValues).values({
          attributeId: nextAttrId,
          value: value.value,
          code: value.code,
          colorHex: value.colorHex,
          imageUrl: value.imageUrl,
          sortOrder: value.sortOrder,
          isActive: value.isActive
        }).onConflictDoNothing();
        copied.values++;
      }
    }

    const sourcePayments = await tx.select().from(paymentMethods).where(eq(paymentMethods.storeId, sourceStoreId));
    for (const method of sourcePayments) {
      await tx.insert(paymentMethods).values({
        storeId: branchStoreId,
        name: method.name,
        code: `${method.code}-${branchStoreId.slice(0, 8)}`,
        description: method.description,
        provider: method.provider,
        config: pickPaymentInstructionConfig(method.config),
        isActive: method.isActive,
        sortOrder: method.sortOrder
      }).onConflictDoNothing();
      copied.paymentMethods++;
    }

    const sourceShipping = await tx.select().from(shippingMethods).where(eq(shippingMethods.storeId, sourceStoreId));
    for (const method of sourceShipping) {
      await tx.insert(shippingMethods).values({
        storeId: branchStoreId,
        name: method.name,
        code: `${method.code}-${branchStoreId.slice(0, 8)}`,
        description: method.description,
        fee: method.fee,
        estimatedDaysMin: method.estimatedDaysMin,
        estimatedDaysMax: method.estimatedDaysMax,
        coverageConfig: method.coverageConfig,
        isActive: method.isActive,
        sortOrder: method.sortOrder
      }).onConflictDoNothing();
      copied.shippingMethods++;
    }

    const mediaRows = await tx.select().from(storeMedia).where(eq(storeMedia.storeId, sourceStoreId)).orderBy(storeMedia.sortOrder);
    for (const media of mediaRows) {
      await tx.insert(storeMedia).values({ storeId: branchStoreId, mediaType: media.mediaType, url: media.url, alt: media.alt, sortOrder: media.sortOrder, isActive: media.isActive }).onConflictDoNothing();
      copied.media++;
    }

    return copied;
  });

  await writeAuditLog({ actorId: merchantId, action: "create", entityType: "copy_branch_settings", entityId: branchStoreId, afterData: result });
  return result;
}

export async function branchRentSummary(merchantId: string) {
  const [row] = await db.select({
    totalMonthly: sql<string>`coalesce(sum(case when ${storeBranchProfiles.rentCycle} = 'monthly' then ${storeBranchProfiles.rentAmount}::numeric else 0 end), 0)::text`,
    pendingInvoices: sql<number>`(select count(*)::int from ${storeRentInvoices} where ${storeRentInvoices.merchantId} = ${merchantId} and ${storeRentInvoices.status} = 'pending')`,
    overdueInvoices: sql<number>`(select count(*)::int from ${storeRentInvoices} where ${storeRentInvoices.merchantId} = ${merchantId} and ${storeRentInvoices.status} = 'overdue')`
  }).from(storeBranchProfiles).innerJoin(stores, eq(storeBranchProfiles.storeId, stores.id)).where(eq(stores.merchantId, merchantId));
  return { totalMonthly: Number(row?.totalMonthly || 0), pendingInvoices: Number(row?.pendingInvoices || 0), overdueInvoices: Number(row?.overdueInvoices || 0) };
}
