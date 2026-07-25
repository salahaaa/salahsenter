export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, financialProviders } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { financialProviderStatuses, financialProviderTypes } from "@/lib/financial/providers";

const schema = z.object({
  name: z.string().min(2).max(180).optional(),
  slug: z.string().optional(),
  type: z.enum(financialProviderTypes).optional(),
  status: z.enum(financialProviderStatuses).optional(),
  logoUrl: z.string().optional().nullable(),
  countryCode: z.string().max(10).optional().nullable(),
  currencyCode: z.string().max(10).optional(),
  isEnabled: z.boolean().optional(),
  isVisibleToMerchants: z.boolean().optional(),
  supportsDeposits: z.boolean().optional(),
  supportsWithdrawals: z.boolean().optional(),
  supportsRefunds: z.boolean().optional(),
  supportsCOD: z.boolean().optional(),
  featureFlags: z.record(z.unknown()).optional(),
  sortOrder: z.coerce.number().int().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    await assertAdminOperation(session, payload.status && ["disabled", "blocked", "maintenance"].includes(payload.status) || payload.isEnabled === false ? "providers.suspend" : "providers.edit");
    const [before] = await db.select().from(financialProviders).where(eq(financialProviders.id, id)).limit(1);
    if (!before) return fail("المزود غير موجود", 404);
    const [provider] = await db.update(financialProviders).set({ ...payload, updatedAt: new Date() }).where(eq(financialProviders.id, id)).returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "financial_provider", entityId: id, beforeData: before, afterData: provider });
    return ok({ provider, message: "تم تحديث المزود المالي" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث المزود المالي");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdminOperation(session, "providers.delete");
    const [before] = await db.select().from(financialProviders).where(eq(financialProviders.id, id)).limit(1);
    if (!before) return fail("المزود غير موجود", 404);
    const [provider] = await db.update(financialProviders).set({ status: "disabled", isEnabled: false, isVisibleToMerchants: false, updatedAt: new Date() }).where(eq(financialProviders.id, id)).returning();
    await writeAuditLog({ actorId: session.userId, action: "delete", entityType: "financial_provider", entityId: id, beforeData: before, afterData: provider });
    return ok({ provider, message: "تم تعطيل وإخفاء المزود المالي" });
  } catch (error) {
    return handleApiError(error, "تعذر حذف/تعطيل المزود المالي");
  }
}
