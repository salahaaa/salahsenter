export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, systemSettings } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { Permission, userHasStorePermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const defaultOrderSettings = { autoAcceptOrders: false, allowCancellation: true, cancellationHours: 2, minOrderAmount: 0, preparationMinutes: 60, enableReservationExpiry: false, reservationExpiryMinutes: 120, returnPolicy: "", shippingPolicy: "", notes: "" };
const schema = z.object({ storeId: z.string().uuid().optional(), autoAcceptOrders: z.boolean().default(false), allowCancellation: z.boolean().default(true), cancellationHours: z.coerce.number().int().min(0).default(2), minOrderAmount: z.coerce.number().min(0).default(0), preparationMinutes: z.coerce.number().int().min(0).default(60), enableReservationExpiry: z.boolean().default(false), reservationExpiryMinutes: z.coerce.number().int().min(5).max(60 * 24 * 14).default(120), returnPolicy: z.string().optional().default(""), shippingPolicy: z.string().optional().default(""), notes: z.string().optional().default("") });

export async function GET() { try { const session = await requireAuth(); const store = await getMerchantPrimaryStore(session.userId); if(!store) return ok({ settings: defaultOrderSettings }); if(!hasStoreAccess(session, store.id)) return fail("لا تملك الصلاحية",403); const [setting]=await db.select().from(systemSettings).where(and(eq(systemSettings.group, `store:${store.id}`), eq(systemSettings.key, "order_settings"))).limit(1); return ok({ settings: { ...defaultOrderSettings, ...((setting?.value || {}) as Record<string, unknown>) } }); } catch(error){ return handleApiError(error,"تعذر تحميل إعدادات الطلبات"); } }
export async function PATCH(request: Request) { try { const session = await requireAuth(); const payload=schema.parse(await request.json()); const primary=await getMerchantPrimaryStore(session.userId); const storeId=payload.storeId || primary?.id; if(!storeId) return fail("لا يوجد متجر مرتبط بحسابك",403); if(!hasStoreAccess(session, storeId)) return fail("لا تملك صلاحية إدارة هذا المتجر",403); if(!(await userHasStorePermission(session.userId, storeId, Permission.ManageStoreSettings))) return fail("لا تملك صلاحية إعدادات المتجر",403); const value={...defaultOrderSettings,...payload,storeId:undefined}; const [setting]=await db.insert(systemSettings).values({group:`store:${storeId}`,key:"order_settings",value,isPublic:false,updatedBy:session.userId}).onConflictDoUpdate({target:[systemSettings.group, systemSettings.key],set:{value,updatedBy:session.userId,updatedAt:new Date()}}).returning(); await writeAuditLog({actorId:session.userId,action:"update",entityType:"store_order_settings",entityId:storeId,afterData:setting}); return ok({settings:value,message:"تم حفظ إعدادات الطلبات"}); } catch(error){ return handleApiError(error,"تعذر حفظ إعدادات الطلبات"); } }
