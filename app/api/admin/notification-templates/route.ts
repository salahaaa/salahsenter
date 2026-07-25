export const dynamic = "force-dynamic";

import { asc } from "drizzle-orm";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, notificationTemplates } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
const schema = z.object({ code: z.string().min(2), channel: z.enum(["in_app", "email", "sms", "push"]).default("in_app"), titleTemplate: z.string().min(2), bodyTemplate: z.string().min(2), variables: z.array(z.string()).default([]), isActive: z.boolean().default(true), config: z.record(z.unknown()).default({}) });
export async function GET() { try { const session = await requireAuth(); await assertAdmin(session, "notifications.manage"); const items = await db.select().from(notificationTemplates).orderBy(asc(notificationTemplates.code)); return ok({ templates: items }); } catch (error) { return handleApiError(error, "تعذر تحميل قوالب الإشعارات"); } }
export async function POST(request: Request) { try { const session = await requireAuth(); await assertAdmin(session, "notifications.manage"); const payload = schema.parse(await request.json()); const [template] = await db.insert(notificationTemplates).values(payload).onConflictDoUpdate({ target: [notificationTemplates.code, notificationTemplates.channel], set: { ...payload, updatedAt: new Date() } }).returning(); await writeAuditLog({ actorId: session.userId, action: "create", entityType: "notification_template", entityId: template.id, afterData: template }); return created({ template, message: "تم حفظ قالب الإشعار" }); } catch (error) { return handleApiError(error, "تعذر حفظ قالب الإشعار"); } }
