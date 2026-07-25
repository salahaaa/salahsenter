export const dynamic = "force-dynamic";

import { asc, sql } from "drizzle-orm";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, merchantActivityTemplateCatalog } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { activityTemplateCatalogInputSchema } from "@/lib/merchant/activity-template-catalog";
import { writeAuditLog } from "@/lib/audit";

async function assertCatalogAdmin(session: Awaited<ReturnType<typeof requireAuth>>) { await assertAdmin(session, ["activity_templates.manage", "products.manage", "master.manage"]); }
export async function GET() { try { const session = await requireAuth(); await assertCatalogAdmin(session); return ok({ templates: await db.select().from(merchantActivityTemplateCatalog).orderBy(asc(merchantActivityTemplateCatalog.sector), asc(merchantActivityTemplateCatalog.name)) }); } catch (error) { return handleApiError(error, "تعذر تحميل كتالوج القطاعات"); } }
export async function POST(request: Request) { try { const session = await requireAuth(); await assertCatalogAdmin(session); const payload = activityTemplateCatalogInputSchema.parse(await request.json()); const [template] = await db.insert(merchantActivityTemplateCatalog).values({ ...payload, sector: payload.sector || null, description: payload.description || null, createdBy: session.userId, updatedBy: session.userId }).onConflictDoUpdate({ target: merchantActivityTemplateCatalog.code, set: { name: payload.name, description: payload.description || null, sector: payload.sector || null, config: payload.config, status: payload.status, version: sql`${merchantActivityTemplateCatalog.version} + 1`, updatedBy: session.userId, updatedAt: new Date() } }).returning(); await writeAuditLog({ actorId: session.userId, action: "create", entityType: "merchant_activity_template_catalog", entityId: template.id, afterData: template }); return created({ template, message: "تم حفظ القطاع في كتالوج قوالب التجار" }); } catch (error) { return handleApiError(error, "تعذر حفظ قطاع القوالب"); } }
