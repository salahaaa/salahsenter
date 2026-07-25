export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { contractEvents, db, merchantContracts, notifications, stores } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
const schema = z.object({ days: z.coerce.number().int().positive().default(15), reason: z.string().min(2) });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { try { const { id } = await context.params; const session = await requireAuth(); await assertAdmin(session, "contracts.manage"); const payload = schema.parse(await request.json()); const [before] = await db.select().from(merchantContracts).where(eq(merchantContracts.id,id)).limit(1); if(!before) return fail("العقد غير موجود",404); const graceEndsAt=new Date(); graceEndsAt.setDate(graceEndsAt.getDate()+payload.days); const [contract]=await db.update(merchantContracts).set({status:"grace",graceEndsAt,updatedAt:new Date()}).where(eq(merchantContracts.id,id)).returning(); await db.update(stores).set({status:"active",isActive:true,updatedAt:new Date()}).where(eq(stores.id,contract.storeId)); await db.insert(contractEvents).values({contractId:id,storeId:contract.storeId,actorId:session.userId,action:"grace_extended",reason:payload.reason,beforeData:before,afterData:contract}); await db.insert(notifications).values({userId:contract.merchantId,storeId:contract.storeId,title:"تم تمديد فترة سماح العقد",body:`تم تمديد فترة السماح حتى ${graceEndsAt.toISOString()}. السبب: ${payload.reason}`,type:"contract_grace_extended",data:{contractId:id,graceEndsAt:graceEndsAt.toISOString(),reason:payload.reason}}); return ok({contract,message:"تم تمديد فترة السماح"}); } catch(error){ return handleApiError(error,"تعذر تمديد فترة السماح"); } }
