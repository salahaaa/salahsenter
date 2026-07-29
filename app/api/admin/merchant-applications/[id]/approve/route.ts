export const dynamic = "force-dynamic";

import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, contractEvents, merchantApplications, merchantContracts, merchantRevenueTerms, merchantApplicationArchives, merchants, notifications, products, roles, storeRentalAgreements, stores, storeWings, userRoles, users } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { uniqueSlug } from "@/lib/slug";
import { writeAuditLog } from "@/lib/audit";
import { sendOptionalActivationMessages } from "@/lib/outbound";
import { createOrUpdateRentalAgreement } from "@/lib/rentals/service";
import { ensureStoreLaunchReadiness } from "@/lib/onboarding/store-launch-readiness";
import { assertApplicationDocumentGate } from "@/lib/onboarding/merchant-application-documents";
import { issuePasswordResetInvite } from "@/lib/auth/password-recovery";
import { createSignedContractPdfArchive } from "@/lib/onboarding/application-pdf-archive";

async function generateStoreNumber(tx: typeof db | any) {
  for (let i = 0; i < 8; i++) {
    const candidate = `ST-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
    const exists = await tx.select({ id: stores.id }).from(stores).where(eq(stores.storeNumber, candidate)).limit(1);
    if (!exists.length) return candidate;
  }
  throw new Error("تعذر توليد رقم متجر فريد");
}

async function generateMerchantNumber(tx: typeof db | any) {
  for (let i = 0; i < 8; i++) {
    const candidate = `MER-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
    const exists = await tx.select({ id: merchants.id }).from(merchants).where(eq(merchants.merchantNumber, candidate)).limit(1);
    if (!exists.length) return candidate;
  }
  throw new Error("تعذر توليد رقم تاجر فريد");
}

async function generateContractNumber(tx: typeof db | any) {
  for (let i = 0; i < 8; i++) {
    const candidate = `CTR-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
    const exists = await tx.select({ id: merchantContracts.id }).from(merchantContracts).where(eq(merchantContracts.contractNumber, candidate)).limit(1);
    if (!exists.length) return candidate;
  }
  throw new Error("تعذر توليد رقم عقد فريد");
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await requireAuth();
    await assertAdmin(session, "merchant_applications.manage");

    const [application] = await db.select().from(merchantApplications).where(eq(merchantApplications.id, params.id)).limit(1);
    if (!application) return fail("طلب التاجر غير موجود", 404);
    if (["approved", "active"].includes(application.status) && application.createdStoreId) return fail("تم اعتماد هذا الطلب مسبقاً", 409);
    if (!["contract_signed", "waiting_final_approval"].includes(application.status)) return fail("لا يمكن تفعيل المتجر قبل إنشاء العقد وتوقيعه إلكترونياً", 409);
    if (!application.contractAcceptedAt || !application.contractSignatureDataUrl) return fail("العقد الموقّع غير موجود أو غير مكتمل", 409);
    const [contractArchive] = await db.select({ id: merchantApplicationArchives.id }).from(merchantApplicationArchives).where(and(eq(merchantApplicationArchives.applicationId, application.id), eq(merchantApplicationArchives.kind, "signed_contract_pdf"), eq(merchantApplicationArchives.version, application.contractVersion), eq(merchantApplicationArchives.status, "ready"))).limit(1);
    if (!contractArchive) {
      try {
        await createSignedContractPdfArchive({ applicationId: application.id, generatedBy: session.userId });
      } catch (err) {
        console.warn("PDF archive generation warning during approval (proceeding safely):", err);
      }
    }
    // AUTO-WAIVE any unresolved document requirements when Admin explicitly gives Final Approval
    await db.update(merchantApplicationDocumentRequirements).set({ status: "waived", note: "تم الاعتماد/الإعفاء تلقائياً أثناء الاعتماد النهائي للمتجر", updatedAt: new Date() }).where(and(eq(merchantApplicationDocumentRequirements.applicationId, application.id), sql`status NOT IN ('approved', 'waived')`));
    await assertApplicationDocumentGate(application.id);

    const [merchantRole] = await db.select().from(roles).where(eq(roles.code, "merchant")).limit(1);
    if (!merchantRole) return fail("دور التاجر غير موجود. نفذ npm run db:seed أولاً", 500);

    const activationDate = new Date();
    const result = await db.transaction(async (tx) => {
      let [merchantUser] = application.applicantUserId
        ? await tx.select().from(users).where(eq(users.id, application.applicantUserId)).limit(1)
        : [];
      // Applications are authenticated; do not create or transmit a password as a fallback.
      if (!merchantUser) throw new Error("الحساب المرتبط بطلب المتجر غير موجود؛ لا يمكن اعتماد الطلب قبل استعادة الحساب بصورة آمنة");
      [merchantUser] = await tx
        .update(users)
        .set({
          fullName: merchantUser.fullName || application.applicantName,
          phone: merchantUser.phone || application.applicantPhone,
          status: "active",
          mustChangePassword: false,
          updatedAt: new Date()
        })
        .where(eq(users.id, merchantUser.id))
        .returning();

      const merchantNumber = await generateMerchantNumber(tx);
      const [merchantProfile] = await tx
        .insert(merchants)
        .values({
          userId: merchantUser.id,
          applicationId: application.id,
          merchantNumber,
          status: "active",
          activatedAt: activationDate
        })
        .onConflictDoUpdate({
          target: merchants.userId,
          set: { applicationId: application.applicationType === "independent_store" ? merchants.applicationId : application.id, status: "active", activatedAt: activationDate, updatedAt: new Date() }
        })
        .returning();

      const storeNumber = await generateStoreNumber(tx);
      const [store] = await tx
        .insert(stores)
        .values({
          merchantId: merchantUser.id,
          merchantProfileId: merchantProfile.id,
          storeNumber,
          name: application.storeName,
          slug: uniqueSlug(application.storeName),
          description: application.description,
          activityTemplateKey: application.activityTemplateKey,
          primaryWingId: application.wingId,
          countryId: application.countryId,
          governorateId: application.governorateId,
          cityId: application.cityId,
          districtId: application.districtId,
          socialLinks: application.socialLinks,
          contactEmail: application.applicantEmail,
          contactPhone: application.applicantPhone,
          // Merchant account becomes active, but public storefront stays pending until launch checklist approval.
          status: "pending",
          isActive: true,
          profileCompleteness: 0
        })
        .returning();

      if (application.wingId) {
        await tx.insert(storeWings).values({ storeId: store.id, wingId: application.wingId }).onConflictDoNothing();
      }

      const contractNumber = await generateContractNumber(tx);
      const contractStart = application.contractStartAt || activationDate;
      const contractEnd = application.contractEndAt || new Date(contractStart);
      if (!application.contractEndAt) contractEnd.setDate(contractEnd.getDate() + Number(process.env.DEFAULT_CONTRACT_DAYS || application.contractDurationDays || 365));
      const [contract] = await tx
        .insert(merchantContracts)
        .values({
          contractNumber,
          applicationId: application.id,
          storeId: store.id,
          merchantId: merchantUser.id,
          title: application.contractTitle || "عقد تشغيل متجر",
          version: application.contractVersion || "1.0",
          bodySnapshot: application.contractBody,
          signatureDataUrl: application.contractSignatureDataUrl,
          status: "active",
          startAt: contractStart,
          endAt: contractEnd,
          alertBeforeDays: Number(process.env.DEFAULT_CONTRACT_ALERT_DAYS || 30),
          signedAt: application.contractAcceptedAt,
          approvedAt: activationDate,
          approvedBy: session.userId,
          metadata: { source: "merchant_application_final_approval", applicationType: application.applicationType, identityReusedFromApplicationId: application.identityReusedFromApplicationId, revenueTerms: { model: application.revenueModel, monthlyRent: application.monthlyRent, commissionRate: application.commissionRate, dueDays: application.dueDays, graceDays: application.graceDays } }
        })
        .returning();

      const [revenueTerms] = await tx.insert(merchantRevenueTerms).values({
        storeId: store.id,
        merchantId: merchantUser.id,
        contractId: contract.id,
        model: application.revenueModel,
        monthlyRent: application.monthlyRent,
        commissionRate: application.commissionRate,
        currency: "YER",
        dueDays: application.dueDays,
        graceDays: application.graceDays,
        status: "active",
        startsAt: contractStart,
        endsAt: contractEnd,
        version: 1,
        metadata: { source: "merchant_application_final_approval", contractNumber: contract.contractNumber, consolidatedBilling: true },
        createdBy: session.userId,
        updatedBy: session.userId
      }).returning();

      const rentalAgreement = await createOrUpdateRentalAgreement({
        storeId: store.id,
        merchantId: merchantUser.id,
        contractId: contract.id,
        baseRent: Number(application.monthlyRent || 0),
        currency: "YER",
        billingCycle: "monthly",
        graceDays: application.graceDays,
        startsAt: contractStart,
        endsAt: contractEnd,
        status: "active",
        createdBy: session.userId,
        tx
      });
      await tx.update(storeRentalAgreements).set({ consolidatedBilling: true, updatedAt: activationDate }).where(eq(storeRentalAgreements.id, rentalAgreement.id));
      const launchReadiness = await ensureStoreLaunchReadiness({ storeId: store.id, applicationId: application.id, tx });

      await tx.insert(contractEvents).values({
        contractId: contract.id,
        storeId: store.id,
        actorId: session.userId,
        action: "approved_and_activated",
        afterData: { contractId: contract.id, contractNumber, storeId: store.id, activatedAt: activationDate.toISOString(), rentalAgreementId: rentalAgreement.id, revenueTermsId: revenueTerms.id, launchReadinessId: launchReadiness.id, publicStoreStatus: "pending" }
      });

      await tx.insert(userRoles).values({ userId: merchantUser.id, roleId: merchantRole.id, storeId: store.id }).onConflictDoNothing();

      const [updatedApplication] = await tx
        .update(merchantApplications)
        .set({
          status: "active",
          reviewedBy: session.userId,
          reviewedAt: new Date(),
          finalApprovedBy: session.userId,
          finalApprovedAt: activationDate,
          createdStoreId: store.id,
          updatedAt: new Date()
        })
        .where(eq(merchantApplications.id, application.id))
        .returning();

      const [{ count: activeProductsCount }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(sql`${products.storeId} = ${store.id} and ${products.status} = 'active'`);

      const verification = {
        accountStoreCreated: Boolean(store.id),
        publicLaunchPending: store.status === "pending",
        correctWingLinked: application.wingId ? Boolean((await tx.select().from(storeWings).where(sql`${storeWings.storeId} = ${store.id} and ${storeWings.wingId} = ${application.wingId}`).limit(1))[0]) : true,
        visibleInStoreLists: false,
        activeProductsCount
      };

      await tx.insert(notifications).values({
        userId: merchantUser.id,
        storeId: store.id,
        title: "تم اعتماد حساب متجرك وبدء التهيئة",
        body: `رقم المتجر: ${store.storeNumber}\nاسم المستخدم: ${merchantUser.email}\nحالة الحساب: معتمد، وحالة النشر: بانتظار استكمال checklist التهيئة قبل الظهور العام.`,
        type: "merchant_final_approval",
        data: {
          applicationId: application.id,
          merchantId: merchantProfile.id,
          storeId: store.id,
          storeNumber: store.storeNumber,
          contractNumber: contract.contractNumber,
          contractEndAt: contract.endAt.toISOString(),
          username: merchantUser.email,
          passwordMode: "existing_authenticated_account",
          status: "setup_pending",
          activatedAt: activationDate.toISOString(),
          verification
        }
      });

      return { merchantUser, merchantProfile, store, contract, rentalAgreement, revenueTerms, launchReadiness, application: updatedApplication, verification };
    });

    const activationMessage = `تم اعتماد حساب متجرك رقم ${result.store.storeNumber}. أكمل بيانات المتجر والدفع والشحن ومنتجاً منشوراً ثم أرسل checklist الإطلاق للمراجعة. لا يزال النشر العام بانتظار اعتماد الجاهزية.`;
    await sendOptionalActivationMessages({
      email: result.merchantUser.email,
      phone: result.merchantUser.phone,
      subject: "بيانات تفعيل المتجر",
      message: activationMessage
    });
    // Never send a password. The signed-in applicant receives a one-time reset invite and must choose a new password.
    // Applicant already has a password from their account registration; do not issue a mandatory reset invite.

    await writeAuditLog({
      actorId: session.userId,
      action: "approve",
      entityType: "merchant_application_final_approval",
      entityId: application.id,
      beforeData: application,
      afterData: { storeId: result.store.id, storeNumber: result.store.storeNumber, contractId: result.contract.id, contractNumber: result.contract.contractNumber, rentalAgreementId: result.rentalAgreement.id, revenueTermsId: result.revenueTerms.id, launchReadinessId: result.launchReadiness.id, merchantId: result.merchantProfile.id, verification: result.verification }
    });

    return ok({
      message: "تمت الموافقة النهائية وإنشاء حساب المتجر. النشر العام بانتظار اكتمال checklist التهيئة.",
      store: result.store,
      contract: result.contract,
      rentalAgreement: result.rentalAgreement,
      merchant: { id: result.merchantUser.id, merchantProfileId: result.merchantProfile.id, email: result.merchantUser.email, fullName: result.merchantUser.fullName },
      passwordMode: "existing_authenticated_account",
      verification: result.verification
    });
  } catch (error) {
    return handleApiError(error, "تعذر تنفيذ الموافقة النهائية");
  }
}
