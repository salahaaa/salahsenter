export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { contractEvents, db, merchantContracts, notifications, stores } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
const schema = z.object({ reason: z.string().min(2) });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { try { const { id } = await context.params; const session = await requireAuth(); await assertAdmin(session, "contracts.manage"); const payload = schema.parse(await request.json()); const [before] = await db.select().from(merchantContracts).where(eq(merchantContracts.id,id)).limit(1); if(!before) return fail("العقد غير موجود",404); const [contract]=await db.update(merchantContracts).set({status:"frozen",updatedAt:new Date()}).where(eq(merchantContracts.id,id)).returning(); const [store]=await db.update(stores).set({status:"frozen",isActive:false,updatedAt:new Date()}).where(eq(stores.id,contract.storeId)).returning(); await db.insert(contractEvents).values({contractId:id,storeId:contract.storeId,actorId:session.userId,action:"terminated_and_store_frozen",reason:payload.reason,beforeData:before,afterData:{contract,store}}); await db.insert(notifications).values({userId:contract.merchantId,storeId:contract.storeId,title:"تم تجميد المتجر بسبب إنهاء العقد",body:`تم إنهاء/تجميد العقد ${contract.contractNumber}. السبب: ${payload.reason}`,type:"contract_terminated_store_frozen",data:{contractId:id,storeId:contract.storeId,reason:payload.reason}}); return ok({contract,store,message:"تم إنهاء العقد وتجميد المتجر دون حذف بياناته"}); } catch(error){ return handleApiError(error,"تعذر إنهاء العقد"); } }
