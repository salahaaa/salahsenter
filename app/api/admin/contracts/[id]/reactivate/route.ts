export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { contractEvents, db, merchantContracts, notifications, stores } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
const schema = z.object({ days: z.coerce.number().int().positive().default(30), reason: z.string().optional() });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { try { const { id } = await context.params; const session = await requireAuth(); await assertAdmin(session, "contracts.manage"); const payload = schema.parse(await request.json().catch(()=>({}))); const [before] = await db.select().from(merchantContracts).where(eq(merchantContracts.id,id)).limit(1); if(!before) return fail("العقد غير موجود",404); const newEnd = before.endAt > new Date() ? before.endAt : new Date(); if (newEnd <= new Date()) newEnd.setDate(newEnd.getDate()+payload.days); const [contract]=await db.update(merchantContracts).set({status:"active",endAt:newEnd,updatedAt:new Date()}).where(eq(merchantContracts.id,id)).returning(); const [store]=await db.update(stores).set({status:"active",isActive:true,updatedAt:new Date()}).where(eq(stores.id,contract.storeId)).returning(); await db.insert(contractEvents).values({contractId:id,storeId:contract.storeId,actorId:session.userId,action:"store_reactivated",reason:payload.reason,beforeData:before,afterData:{contract,store}}); await db.insert(notifications).values({userId:contract.merchantId,storeId:contract.storeId,title:"تمت إعادة فتح المتجر",body:`تمت إعادة تفعيل المتجر المرتبط بالعقد ${contract.contractNumber}.`,type:"store_reactivated",data:{contractId:id,storeId:contract.storeId}}); return ok({contract,store,message:"تمت إعادة فتح المتجر بنجاح"}); } catch(error){ return handleApiError(error,"تعذر إعادة تفعيل المتجر"); } }
