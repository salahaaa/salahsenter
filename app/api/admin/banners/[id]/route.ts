export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { optionalUrlOrPathSchema, requiredUrlOrPathSchema } from "@/lib/validators";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { banners, db } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

async function revalidatePublicPages() {
  await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home], paths: ["/"] });
}

const schema = z.object({ title: z.string().min(2).optional(), description: z.string().optional(), imageUrl: optionalUrlOrPathSchema, linkUrl: optionalUrlOrPathSchema, placement: z.string().optional(), sortOrder: z.coerce.number().int().optional(), status: z.enum(["draft", "scheduled", "active", "expired", "disabled"]).optional(), startAt: z.string().datetime().optional().nullable(), endAt: z.string().datetime().optional().nullable(), visibilitySchedule: z.record(z.unknown()).optional() });
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params; try { const session = await requireAuth(); await assertAdminOperation(session, "ads.edit"); const payload = schema.parse(await request.json()); const [before] = await db.select().from(banners).where(eq(banners.id, params.id)).limit(1); if (!before) return fail("البانر غير موجود", 404); const [banner] = await db.update(banners).set({ ...payload, linkUrl: payload.linkUrl || undefined, startAt: payload.startAt ? new Date(payload.startAt) : undefined, endAt: payload.endAt ? new Date(payload.endAt) : undefined, updatedAt: new Date() }).where(eq(banners.id, params.id)).returning(); await writeAuditLog({ actorId: session.userId, action: "update", entityType: "banner", entityId: banner.id, beforeData: before, afterData: banner }); await revalidatePublicPages();
    return ok({ banner, message: "تم تعديل البانر بنجاح" }); } catch (error) { return handleApiError(error, "تعذر تعديل البانر"); } }
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params; try { const session = await requireAuth(); await assertAdminOperation(session, "ads.delete"); const [before] = await db.select().from(banners).where(eq(banners.id, params.id)).limit(1); if (!before) return fail("البانر غير موجود", 404); const [item] = await db.update(banners).set({ status: "disabled", updatedAt: new Date() }).where(eq(banners.id, params.id)).returning(); await writeAuditLog({ actorId: session.userId, action: "delete", entityType: "banner", entityId: params.id, beforeData: before, afterData: item }); await revalidatePublicPages();
    return ok({ message: "تم حذف البانر بنجاح" }); } catch (error) { return handleApiError(error, "تعذر حذف البانر"); } }
