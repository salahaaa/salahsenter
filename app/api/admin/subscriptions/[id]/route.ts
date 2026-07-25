export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, subscriptions } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
const schema = z.object({ name: z.string().min(2).optional(), code: z.string().min(2).optional(), price: z.coerce.number().min(0).optional(), durationDays: z.coerce.number().int().positive().optional(), maxProducts: z.coerce.number().int().min(0).optional(), maxEmployees: z.coerce.number().int().min(0).optional(), maxAnnouncements: z.coerce.number().int().min(0).optional(), maxNews: z.coerce.number().int().min(0).optional(), maxBranches: z.coerce.number().int().min(0).optional(), features: z.array(z.string()).optional(), isActive: z.boolean().optional() });
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params; try { const session = await requireAuth(); await assertAdmin(session, "subscriptions.manage"); const payload = schema.parse(await request.json()); const [before] = await db.select().from(subscriptions).where(eq(subscriptions.id, params.id)).limit(1); if (!before) return fail("الباقة غير موجودة", 404); const [subscription] = await db.update(subscriptions).set({ ...payload, price: payload.price?.toString(), updatedAt: new Date() }).where(eq(subscriptions.id, params.id)).returning(); await writeAuditLog({ actorId: session.userId, action: "update", entityType: "subscription", entityId: subscription.id, beforeData: before, afterData: subscription }); return ok({ subscription, message: "تم تعديل الباقة بنجاح" }); } catch (error) { return handleApiError(error, "تعذر تعديل الباقة"); } }
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params; try { const session = await requireAuth(); await assertAdmin(session, "subscriptions.manage"); const [before] = await db.select().from(subscriptions).where(eq(subscriptions.id, params.id)).limit(1); if (!before) return fail("الباقة غير موجودة", 404); const [subscription] = await db.update(subscriptions).set({ isActive: false, updatedAt: new Date() }).where(eq(subscriptions.id, params.id)).returning(); await writeAuditLog({ actorId: session.userId, action: "delete", entityType: "subscription", entityId: params.id, beforeData: before, afterData: subscription }); return ok({ message: "تم تعطيل الباقة بنجاح" }); } catch (error) { return handleApiError(error, "تعذر حذف الباقة لوجود متاجر مرتبطة بها"); } }
