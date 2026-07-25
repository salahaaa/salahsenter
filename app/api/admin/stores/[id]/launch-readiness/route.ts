export const dynamic = "force-dynamic";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { getStoreLaunchReadiness, reviewStoreLaunchReadiness } from "@/lib/onboarding/store-launch-readiness";
import { writeAuditLog } from "@/lib/audit";

const schema=z.object({action:z.enum(["approve","reject"]),note:z.string().trim().min(3).max(1500).optional()});
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){try{const {id}=await context.params;const session=await requireAuth();await assertAdmin(session,["merchant_applications.launch.review","merchant_applications.manage"]);return ok(await getStoreLaunchReadiness(id));}catch(error){return handleApiError(error,"تعذر تحميل جاهزية إطلاق المتجر");}}
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){try{const {id}=await context.params;const session=await requireAuth();await assertAdmin(session,["merchant_applications.launch.review","merchant_applications.manage"]);const payload=schema.parse(await request.json());const result=await reviewStoreLaunchReadiness({storeId:id,actorId:session.userId,action:payload.action,note:payload.note});await writeAuditLog({actorId:session.userId,action:payload.action==="approve"?"approve":"reject",entityType:"store_launch_readiness",entityId:result.readiness.id,beforeData:result.before,afterData:result.readiness});return ok({...result,message:payload.action==="approve"?"تم نشر المتجر العام بعد اعتماد الجاهزية":"تمت إعادة المتجر إلى مرحلة التهيئة"});}catch(error){return handleApiError(error,"تعذر مراجعة إطلاق المتجر");}}
