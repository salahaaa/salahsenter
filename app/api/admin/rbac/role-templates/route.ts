export const dynamic = "force-dynamic";

import { asc } from "drizzle-orm";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, roleTemplates } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
const schema = z.object({ name: z.string().min(2), code: z.string().min(2), scope: z.enum(["system", "store"]).default("store"), description: z.string().optional(), permissionCodes: z.array(z.string()).default([]), inheritance: z.array(z.string()).default([]), isActive: z.boolean().default(true) });
export async function GET() { try { const session = await requireAuth(); await assertAdmin(session, "roles.manage"); const items = await db.select().from(roleTemplates).orderBy(asc(roleTemplates.scope), asc(roleTemplates.name)); return ok({ templates: items }); } catch (error) { return handleApiError(error, "تعذر تحميل قوالب الأدوار"); } }
export async function POST(request: Request) { try { const session = await requireAuth(); await assertAdmin(session, "roles.manage"); const payload = schema.parse(await request.json()); const [template] = await db.insert(roleTemplates).values(payload).returning(); await writeAuditLog({ actorId: session.userId, action: "create", entityType: "role_template", entityId: template.id, afterData: template }); return created({ template, message: "تم حفظ قالب الدور" }); } catch (error) { return handleApiError(error, "تعذر حفظ قالب الدور"); } }
