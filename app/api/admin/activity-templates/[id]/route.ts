export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { handleApiError, ok, fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, merchantActivityTemplateCatalog } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { activityTemplateCatalogInputSchema } from "@/lib/merchant/activity-template-catalog";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { try { const { id } = await context.params; const session = await requireAuth(); await assertAdmin(session, ["activity_templates.manage", "products.manage", "master.manage"]); const payload = activityTemplateCatalogInputSchema.parse(await request.json()); const [before] = await db.select().from(merchantActivityTemplateCatalog).where(eq(merchantActivityTemplateCatalog.id, id)).limit(1); if (!before) return fail("القطاع غير موجود", 404); const [template] = await db.update(merchantActivityTemplateCatalog).set({ ...payload, sector: payload.sector || null, description: payload.description || null, version: before.version + 1, updatedBy: session.userId, updatedAt: new Date() }).where(eq(merchantActivityTemplateCatalog.id, before.id)).returning(); await writeAuditLog({ actorId: session.userId, action: "update", entityType: "merchant_activity_template_catalog", entityId: template.id, beforeData: before, afterData: template }); return ok({ template, message: "تم تحديث القطاع" }); } catch (error) { return handleApiError(error, "تعذر تحديث القطاع"); } }
