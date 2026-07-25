export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { optionalUrlOrPathSchema, requiredUrlOrPathSchema } from "@/lib/validators";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, defaultActivityMedia } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
const schema = z.object({ mediaType: z.enum(["cover", "logo", "intro", "gallery", "video", "banner", "icon"]).optional(), url: optionalUrlOrPathSchema, alt: z.string().optional(), sortOrder: z.coerce.number().int().optional(), isActive: z.boolean().optional() });
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params; try { const session = await requireAuth(); await assertAdmin(session, "default_media.manage"); const payload = schema.parse(await request.json()); const [before] = await db.select().from(defaultActivityMedia).where(eq(defaultActivityMedia.id, params.id)).limit(1); if (!before) return fail("الصورة غير موجودة", 404); const [media] = await db.update(defaultActivityMedia).set(payload).where(eq(defaultActivityMedia.id, params.id)).returning(); await writeAuditLog({ actorId: session.userId, action: "update", entityType: "default_activity_media", entityId: media.id, beforeData: before, afterData: media }); return ok({ media, message: "تم تعديل الصورة بنجاح" }); } catch (error) { return handleApiError(error, "تعذر تعديل الصورة"); } }
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params; try { const session = await requireAuth(); await assertAdmin(session, "default_media.manage"); const [before] = await db.select().from(defaultActivityMedia).where(eq(defaultActivityMedia.id, params.id)).limit(1); if (!before) return fail("الصورة غير موجودة", 404); const [media] = await db.update(defaultActivityMedia).set({ isActive: false }).where(eq(defaultActivityMedia.id, params.id)).returning(); await writeAuditLog({ actorId: session.userId, action: "delete", entityType: "default_activity_media", entityId: params.id, beforeData: before, afterData: media }); return ok({ message: "تم تعطيل الصورة بنجاح" }); } catch (error) { return handleApiError(error, "تعذر حذف الصورة"); } }
