export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, shippingMethods } from "@/lib/db";
import { userHasStoreOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { shippingCoverageSchema } from "@/lib/shipping/coverage";

const schema = z.object({ name: z.string().min(2).optional(), description: z.string().optional(), fee: z.coerce.number().min(0).optional(), estimatedDaysMin: z.coerce.number().int().min(0).optional(), estimatedDaysMax: z.coerce.number().int().min(0).optional(), coverageConfig: shippingCoverageSchema.optional(), isActive: z.boolean().optional(), sortOrder: z.coerce.number().int().optional() });
async function assertOwned(session: Awaited<ReturnType<typeof requireAuth>>, id: string) { const [method] = await db.select().from(shippingMethods).where(eq(shippingMethods.id,id)).limit(1); if(!method) return { error: fail("وسيلة الشحن غير موجودة",404) }; if(!method.storeId) return { error: fail("لا يمكن تعديل وسيلة شحن عامة من لوحة المتجر",403) }; if(!hasStoreAccess(session, method.storeId)) return { error: fail("لا تملك الصلاحية",403) }; if(!(await userHasStoreOperation(session.userId, method.storeId, "shipping.manage"))) return { error: fail("لا تملك صلاحية إعدادات المتجر",403) }; return { method }; }
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { try { const { id } = await context.params; const session = await requireAuth(); const payload = schema.parse(await request.json()); const access = await assertOwned(session,id); if(access.error) return access.error; const [method]=await db.update(shippingMethods).set({ ...payload, fee: payload.fee?.toString(), updatedAt:new Date() }).where(eq(shippingMethods.id,id)).returning(); await writeAuditLog({actorId:session.userId,action:"update",entityType:"store_shipping_method",entityId:id,beforeData:access.method,afterData:method}); return ok({shippingMethod:method,message:"تم تحديث وسيلة الشحن"}); } catch(error){ return handleApiError(error,"تعذر تحديث وسيلة الشحن"); } }
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) { try { const { id } = await context.params; const session = await requireAuth(); const access = await assertOwned(session,id); if(access.error) return access.error; const [method]=await db.update(shippingMethods).set({ isActive:false, updatedAt:new Date() }).where(eq(shippingMethods.id,id)).returning(); await writeAuditLog({actorId:session.userId,action:"delete",entityType:"store_shipping_method",entityId:id,beforeData:access.method,afterData:method}); return ok({message:"تم تعطيل وسيلة الشحن"}); } catch(error){ return handleApiError(error,"تعذر حذف وسيلة الشحن"); } }
