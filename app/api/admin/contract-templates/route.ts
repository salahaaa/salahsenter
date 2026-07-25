export const dynamic = "force-dynamic";

import { asc } from "drizzle-orm";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { contractTemplates, db } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
const schema = z.object({ name: z.string().min(2), code: z.string().min(2), version: z.string().default("1.0"), body: z.string().min(10), variables: z.array(z.string()).default([]), isDefault: z.boolean().default(false), isActive: z.boolean().default(true) });
export async function GET() { try { const session = await requireAuth(); await assertAdmin(session, "contracts.manage"); const items = await db.select().from(contractTemplates).orderBy(asc(contractTemplates.code), asc(contractTemplates.version)); return ok({ templates: items }); } catch (error) { return handleApiError(error, "تعذر تحميل قوالب العقود"); } }
export async function POST(request: Request) { try { const session = await requireAuth(); await assertAdmin(session, "contracts.manage"); const payload = schema.parse(await request.json()); const [template] = await db.insert(contractTemplates).values({ ...payload, createdBy: session.userId }).returning(); await writeAuditLog({ actorId: session.userId, action: "create", entityType: "contract_template", entityId: template.id, afterData: template }); return created({ template, message: "تم حفظ قالب العقد" }); } catch (error) { return handleApiError(error, "تعذر حفظ قالب العقد"); } }
