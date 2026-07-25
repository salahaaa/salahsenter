export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, merchantApplicationDocuments, merchantApplications, wings, countries, governorates, cities, districts } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { summarizeMerchantApplication } from "@/lib/ai/admin-review-assistant";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "merchant_applications.manage");
    const [row] = await db.select({ app: merchantApplications, wingName: wings.name, countryName: countries.name, governorateName: governorates.name, cityName: cities.name, districtName: districts.name })
      .from(merchantApplications)
      .leftJoin(wings, eq(merchantApplications.wingId, wings.id))
      .leftJoin(countries, eq(merchantApplications.countryId, countries.id))
      .leftJoin(governorates, eq(merchantApplications.governorateId, governorates.id))
      .leftJoin(cities, eq(merchantApplications.cityId, cities.id))
      .leftJoin(districts, eq(merchantApplications.districtId, districts.id))
      .where(eq(merchantApplications.id, id)).limit(1);
    if (!row) return fail("الطلب غير موجود", 404);
    const docs = await db.select({ id: merchantApplicationDocuments.id }).from(merchantApplicationDocuments).where(eq(merchantApplicationDocuments.applicationId, id));
    const app = row.app;
    const location = [row.countryName, row.governorateName, row.cityName, row.districtName].filter(Boolean).join("، ");
    return ok({ summary: summarizeMerchantApplication({ storeName: app.storeName, applicantName: app.applicantName, applicantEmail: app.applicantEmail, applicantPhone: app.applicantPhone, businessActivity: app.businessActivity, description: app.description, status: app.status, wingName: row.wingName, location, documentsCount: docs.length, hasSignature: Boolean(app.contractSignatureDataUrl), contractAcceptedAt: app.contractAcceptedAt }) });
  } catch (error) {
    return handleApiError(error, "تعذر توليد ملخص الطلب");
  }
}
