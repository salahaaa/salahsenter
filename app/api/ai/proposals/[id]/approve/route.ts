export const dynamic="force-dynamic";
import { eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { aiActionProposals, db } from "@/lib/db";
import { approveAiProposal } from "@/lib/ai/workbench";
import { writeAuditLog } from "@/lib/audit";
import { userHasStoreOperation } from "@/lib/rbac";
export async function POST(_request:Request,context:{params:Promise<{id:string}>}){try{const {id}=await context.params;const session=await requireAuth();const [proposal]=await db.select().from(aiActionProposals).where(eq(aiActionProposals.id,id)).limit(1);if(!proposal)return fail("اقتراح الذكاء غير موجود",404);if(proposal.userId!==session.userId)return fail("لا تملك اقتراح الذكاء هذا",403);if(proposal.storeId&&!(await userHasStoreOperation(session.userId,proposal.storeId,"ai.proposals.approve")))return fail("لا تملك صلاحية اعتماد اقتراحات ذكاء المتجر",403);const result=await approveAiProposal({proposalId:id,userId:session.userId});await writeAuditLog({actorId:session.userId,action:"approve",entityType:"ai_action_proposal",entityId:id,beforeData:result.before,afterData:result.proposal});return ok({proposal:result.proposal,message:result.proposal.status==="executed"?"تم اعتماد الاقتراح وتطبيق مسودة المحتوى على المنتج دون تغيير السعر أو المخزون أو حالة النشر.":"تم اعتماد اقتراح الذكاء. افتح المسار المقترح لتنفيذ العملية ضمن ضوابطه."});}catch(error){return handleApiError(error,"تعذر اعتماد اقتراح الذكاء");}}
