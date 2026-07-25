export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, shippingMethods } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
const schema = z.object({ name: z.string().min(2).optional(), code: z.string().min(2).optional(), description: z.string().optional(), fee: z.coerce.number().min(0).optional(), estimatedDaysMin: z.coerce.number().int().min(0).optional(), estimatedDaysMax: z.coerce.number().int().min(0).optional(), coverageConfig: z.record(z.unknown()).optional(), isActive: z.boolean().optional(), sortOrder: z.coerce.number().int().optional() });
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params; try { const session = await requireAuth(); await assertAdmin(session, "shipping.manage"); const payload = schema.parse(await request.json()); const [before] = await db.select().from(shippingMethods).where(eq(shippingMethods.id, params.id)).limit(1); if (!before) return fail("وسيلة الشحن غير موجودة", 404); const [item] = await db.update(shippingMethods).set({ ...payload, fee: payload.fee?.toString(), updatedAt: new Date() }).where(eq(shippingMethods.id, params.id)).returning(); await writeAuditLog({ actorId: session.userId, action: "update", entityType: "shipping_method", entityId: item.id, beforeData: before, afterData: item }); return ok({ shippingMethod: item, message: "تم تعديل وسيلة الشحن بنجاح" }); } catch (error) { return handleApiError(error, "تعذر تعديل وسيلة الشحن"); } }
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params; try { const session = await requireAuth(); await assertAdmin(session, "shipping.manage"); const [before] = await db.select().from(shippingMethods).where(eq(shippingMethods.id, params.id)).limit(1); if (!before) return fail("وسيلة الشحن غير موجودة", 404); const [item] = await db.update(shippingMethods).set({ isActive: false, updatedAt: new Date() }).where(eq(shippingMethods.id, params.id)).returning(); await writeAuditLog({ actorId: session.userId, action: "delete", entityType: "shipping_method", entityId: params.id, beforeData: before, afterData: item }); return ok({ message: "تم تعطيل وسيلة الشحن بنجاح" }); } catch (error) { return handleApiError(error, "تعذر حذف وسيلة الشحن لوجود طلبات مرتبطة"); } }
