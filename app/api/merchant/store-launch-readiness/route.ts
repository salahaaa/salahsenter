export const dynamic = "force-dynamic";

import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { getStoreLaunchReadiness, submitStoreLaunchReadiness } from "@/lib/onboarding/store-launch-readiness";
import { userHasStoreOperation } from "@/lib/rbac";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";

const schema=z.object({note:z.string().trim().max(1500).optional().nullable()});
export async function GET(){try{const session=await requireAuth();const store=await getMerchantPrimaryStore(session.userId);if(!store||!hasStoreAccess(session,store.id))return fail("لا يوجد متجر متاح",403);if(!(await userHasStoreOperation(session.userId,store.id,"onboarding.view")))return fail("لا تملك صلاحية عرض جاهزية الإطلاق",403);return ok(await getStoreLaunchReadiness(store.id));}catch(error){return handleApiError(error,"تعذر تحميل جاهزية إطلاق المتجر");}}
export async function POST(request:Request){try{const session=await requireAuth();const store=await getMerchantPrimaryStore(session.userId);if(!store||!hasStoreAccess(session,store.id))return fail("لا يوجد متجر متاح",403);if(!(await userHasStoreOperation(session.userId,store.id,"onboarding.submit")))return fail("لا تملك صلاحية إرسال جاهزية الإطلاق",403);const payload=schema.parse(await request.json());const result=await submitStoreLaunchReadiness({storeId:store.id,actorId:session.userId,note:payload.note});await writeAuditLog({actorId:session.userId,action:"status_change",entityType:"store_launch_readiness",entityId:result.readiness.id,afterData:result});return ok({ ...result,message:"تم إرسال المتجر لمراجعة الإطلاق العام"});}catch(error){return handleApiError(error,"تعذر إرسال جاهزية المتجر");}}
