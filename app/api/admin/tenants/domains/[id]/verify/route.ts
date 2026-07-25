export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, tenantDomains } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { verifyTenantDomainDns } from "@/lib/tenancy/domain-verification";
import { writeAuditLog } from "@/lib/audit";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const session = await requireAuth();
    await assertAdmin(session, "tenants.manage");
    const [domain] = await db.select().from(tenantDomains).where(eq(tenantDomains.id, id)).limit(1);
    if (!domain) return fail("دومين المستأجر غير موجود", 404);
    const verification = await verifyTenantDomainDns(domain.domain, domain.verificationToken || "");
    if (!verification.verified) {
      await writeAuditLog({ actorId: session.userId, action: "update", entityType: "tenant_domain_verification", entityId: id, beforeData: { status: domain.status }, afterData: verification });
      return fail(`لم يتم العثور على رمز TXT. أضف ${verification.record} بالقيمة المعروضة في لوحة الإدارة ثم أعد المحاولة.`, 422, verification);
    }
    const [updated] = await db.update(tenantDomains).set({ status: "verified", verifiedAt: new Date() }).where(eq(tenantDomains.id, id)).returning();
    await writeAuditLog({ actorId: session.userId, action: "approve", entityType: "tenant_domain_verification", entityId: id, beforeData: domain, afterData: { domain: updated, verification } });
    return ok({ domain: updated, verification, message: "تم التحقق من DNS وتفعيل الدومين للمستأجر" });
  } catch (error) { return handleApiError(error, "تعذر التحقق من دومين المستأجر"); }
}
