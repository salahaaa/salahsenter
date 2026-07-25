export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { optionalUrlOrPathSchema, requiredUrlOrPathSchema } from "@/lib/validators";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, news } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
function revalidatePublicPages() {
  revalidatePath("/");
  revalidatePath("/wings");
}

const schema = z.object({ title: z.string().min(2).optional(), body: z.string().optional(), linkUrl: optionalUrlOrPathSchema, isTicker: z.boolean().optional(), isPinned: z.boolean().optional(), status: z.enum(["draft", "scheduled", "active", "expired", "disabled"]).optional(), startAt: z.string().datetime().optional().nullable(), endAt: z.string().datetime().optional().nullable() });
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params; try { const session = await requireAuth(); await assertAdmin(session, "news.manage"); const payload = schema.parse(await request.json()); const [before] = await db.select().from(news).where(eq(news.id, params.id)).limit(1); if (!before) return fail("الخبر غير موجود", 404); const [item] = await db.update(news).set({ ...payload, linkUrl: payload.linkUrl || undefined, startAt: payload.startAt ? new Date(payload.startAt) : undefined, endAt: payload.endAt ? new Date(payload.endAt) : undefined, updatedAt: new Date() }).where(eq(news.id, params.id)).returning(); await writeAuditLog({ actorId: session.userId, action: "update", entityType: "news", entityId: item.id, beforeData: before, afterData: item }); revalidatePublicPages();
    return ok({ news: item, message: "تم تعديل الخبر بنجاح" }); } catch (error) { return handleApiError(error, "تعذر تعديل الخبر"); } }
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params; try { const session = await requireAuth(); await assertAdmin(session, "news.manage"); const [before] = await db.select().from(news).where(eq(news.id, params.id)).limit(1); if (!before) return fail("الخبر غير موجود", 404); const [item] = await db.update(news).set({ status: "disabled", updatedAt: new Date() }).where(eq(news.id, params.id)).returning(); await writeAuditLog({ actorId: session.userId, action: "delete", entityType: "news", entityId: params.id, beforeData: before, afterData: item }); revalidatePublicPages();
    return ok({ message: "تم حذف الخبر بنجاح" }); } catch (error) { return handleApiError(error, "تعذر حذف الخبر"); } }
