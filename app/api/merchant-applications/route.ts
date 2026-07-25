export const dynamic = "force-dynamic";

import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { getCurrentSession, requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { db, merchantApplicationDocumentRequirements, merchantApplications, merchants, notifications, stores } from "@/lib/db";
import { parseListQuery } from "@/lib/api-list-utils";
import { merchantApplicationSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";

import { checkIpRateLimit } from "@/lib/rate-limit";
import { getPlatformSecuritySettings, isPlatformLocked } from "@/lib/security-settings";
import { notifyAdmins } from "@/lib/notifications";
import { ensureMerchantApplicationDocumentRequirements } from "@/lib/onboarding/merchant-application-documents";
import { independentStoreEligibility, isIndependentStoreApplication } from "@/lib/merchant/independent-store-policy";
import { getMasterSettings } from "@/lib/master-settings";
import { resolveActivityTemplateForWing } from "@/lib/onboarding/wing-template-assignment";

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "merchant_applications.manage");

    const { page, pageSize, offset, q } = parseListQuery(request, { defaultPageSize: 20 });
    const status = new URL(request.url).searchParams.get("status") || "";
    const conditions: SQL[] = [];
    if (q) {
      const term = `%${q}%`;
      conditions.push(or(ilike(merchantApplications.storeName, term), ilike(merchantApplications.applicantName, term), ilike(merchantApplications.applicantEmail, term), ilike(merchantApplications.applicantPhone, term), ilike(merchantApplications.businessActivity, term))!);
    }
    if (status) conditions.push(eq(merchantApplications.status, status as any));
    const where = conditions.length ? and(...conditions) : undefined;

    // List view: exclude heavy contract_body (text), signed_contract_snapshot (jsonb) and
    // contract_signature_data_url (base64 image) — those are loaded from the detail endpoint.
    const [rows, [{ count: totalCount }]] = await Promise.all([
      db
        .select({
          id: merchantApplications.id,
          applicantName: merchantApplications.applicantName,
          applicantEmail: merchantApplications.applicantEmail,
          applicantPhone: merchantApplications.applicantPhone,
          storeName: merchantApplications.storeName,
          businessActivity: merchantApplications.businessActivity,
          activityTemplateKey: merchantApplications.activityTemplateKey,
          status: merchantApplications.status,
          onboardingContractNumber: merchantApplications.onboardingContractNumber,
          contractVersion: merchantApplications.contractVersion,
          wingId: merchantApplications.wingId,
          adminNote: merchantApplications.adminNote,
          contractAcceptedAt: merchantApplications.contractAcceptedAt,
          hasSignature: sql<boolean>`(${merchantApplications.contractSignatureDataUrl} IS NOT NULL)`,
          hasContractBody: sql<boolean>`(${merchantApplications.contractBody} IS NOT NULL)`,
          createdAt: merchantApplications.createdAt,
          updatedAt: merchantApplications.updatedAt
        })
        .from(merchantApplications)
        .where(where ? (where as any) : sql`true`)
        .orderBy(desc(merchantApplications.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(merchantApplications).where(where ? (where as any) : sql`true`)
    ]);

    return ok({ applications: rows, page, pageSize, totalCount, hasNext: offset + rows.length < totalCount, totalPages: Math.ceil(totalCount / pageSize) || 0 });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل طلبات التجار");
  }
}

export async function POST(request: Request) {
  try {
    const security = await getPlatformSecuritySettings();
    if (isPlatformLocked(security) || security.disabledModules.merchantApplications) return fail("طلبات فتح المتاجر متوقفة مؤقتاً", 503);
    const rate = await checkIpRateLimit("merchant-application:create", 5, 60 * 60 * 1000);
    if (!rate.allowed) return fail("تم تجاوز حد إرسال طلبات فتح المتاجر مؤقتاً", 429);
    const payload = merchantApplicationSchema.parse(await request.json());
    const wingTemplate = await resolveActivityTemplateForWing(payload.wingId);
    if (!wingTemplate.ok) return fail(wingTemplate.message, 422);
    const session = await getCurrentSession();
    if (!session) {
      return fail("يجب إنشاء حساب أو تسجيل الدخول قبل إرسال طلب فتح متجر", 401);
    }

    const [activeStore] = await db.select({ id: stores.id, merchantProfileId: stores.merchantProfileId }).from(stores).where(and(eq(stores.merchantId, session.userId), inArray(stores.status, ["active", "pending", "suspended", "frozen"]))).limit(1);
    const independentStore = isIndependentStoreApplication(payload.applicationType);
    const masterSettings = independentStore ? await getMasterSettings() : null;
    if (independentStore && !masterSettings?.featureFlags.allowIndependentStores) return fail("إضافة متجر أو نشاط مستقل متوقفة مؤقتاً بسياسة المنصة.", 503);
    if (independentStore && !masterSettings?.onboarding.independentStoreIdentityReuse) return fail("إعادة استخدام هوية التاجر للمتجر المستقل متوقفة مؤقتاً بسياسة المنصة.", 503);
    if (activeStore && !independentStore) return fail("يوجد متجر مرتبط بحسابك بالفعل. استخدم إدارة الفروع للنشاط نفسه أو إضافة متجر/نشاط مستقل.", 409);
    if (independentStore && !activeStore) return fail("يلزم وجود متجر أول معتمد أو قيد التشغيل قبل إضافة نشاط مستقل تحت الحساب نفسه.", 409);

    const [openApplication] = await db
      .select({ id: merchantApplications.id, status: merchantApplications.status })
      .from(merchantApplications)
      .where(and(eq(merchantApplications.applicantUserId, session.userId), eq(merchantApplications.applicationType, payload.applicationType), inArray(merchantApplications.status, ["new", "pending", "under_review", "waiting_for_data", "documents_required", "pre_approved", "contract_created", "contract_signed", "waiting_final_approval"])))
      .limit(1);
    if (openApplication) return fail("لديك طلب من النوع نفسه قيد المعالجة بالفعل", 409, { applicationId: openApplication.id, status: openApplication.status });

    let identityReusedFromApplicationId: string | null = null;
    if (independentStore) {
      const [merchantProfile] = await db.select({ applicationId: merchants.applicationId }).from(merchants).where(eq(merchants.userId, session.userId)).limit(1);
      identityReusedFromApplicationId = merchantProfile?.applicationId || null;
      if (!identityReusedFromApplicationId) return fail("لا يوجد ملف هوية معتمد قابل لإعادة الاستخدام؛ راجع الإدارة أولاً.", 409);
      const [identityRequirement] = await db.select({ id: merchantApplicationDocumentRequirements.id }).from(merchantApplicationDocumentRequirements).where(and(eq(merchantApplicationDocumentRequirements.applicationId, identityReusedFromApplicationId), eq(merchantApplicationDocumentRequirements.documentType, "identity"), inArray(merchantApplicationDocumentRequirements.status, ["approved", "waived"]))).limit(1);
      if (!identityRequirement || !independentStoreEligibility({ hasExistingStore: Boolean(activeStore), hasApprovedIdentity: Boolean(identityRequirement) }).allowed) return fail("لا يمكن إعادة استخدام الهوية قبل اعتماد ملف الهوية في المتجر الأول.", 409);
    }

    const [application] = await db
      .insert(merchantApplications)
      .values({ ...payload, activityTemplateKey: wingTemplate.template.key, applicantUserId: session.userId, identityReusedFromApplicationId, status: "pending" })
      .returning();

    await ensureMerchantApplicationDocumentRequirements(application.id, session.userId, db, { reuseIdentityFromApplicationId: identityReusedFromApplicationId });

    if (session?.userId) {
      await db.insert(notifications).values({
        userId: session.userId,
        title: "تم إرسال طلب فتح المتجر",
        body: independentStore ? "وصل طلب إضافة متجر/نشاط مستقل إلى الإدارة. ستراجع وثائق النشاط الجديد ويصدر له عقد مستقل." : "وصل طلبك إلى إدارة المنصة وسيتم إشعارك بعد المراجعة.",
        type: "merchant_application_created",
        data: { applicationId: application.id }
      });
    }
    await notifyAdmins({
      title: independentStore ? "طلب متجر/نشاط مستقل جديد" : "طلب فتح متجر جديد",
      body: `تم تقديم طلب ${independentStore ? "نشاط مستقل" : "فتح متجر"}: ${application.storeName} من ${application.applicantName}`,
      type: "admin_new_merchant_application",
      data: { applicationId: application.id, storeName: application.storeName, applicationType: application.applicationType }
    });

    await writeAuditLog({
      actorId: session?.userId || null,
      action: "create",
      entityType: "merchant_application",
      entityId: application.id,
      afterData: application
    });

    return created({ application, message: independentStore ? "تم إرسال طلب إضافة متجر/نشاط مستقل بنجاح" : "تم إرسال طلب فتح المتجر بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر إرسال طلب فتح متجر");
  }
}
