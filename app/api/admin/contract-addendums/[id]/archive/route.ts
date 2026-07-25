export const dynamic="force-dynamic";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";
import { createAddendumPdfArchive } from "@/lib/contracts/addendums";
import { writeAuditLog } from "@/lib/audit";
export async function POST(_request:Request,context:{params:Promise<{id:string}>}){try{const {id}=await context.params;const session=await requireAuth();await assertAdminOperation(session,"contracts.addendum.manage");const result=await createAddendumPdfArchive({addendumId:id,generatedBy:session.userId});await writeAuditLog({actorId:session.userId,action:"create",entityType:"merchant_contract_addendum_pdf_archive",entityId:result.archive.id,afterData:result.archive});return ok({archive:result.archive,message:"تم إنشاء PDF للملحق محلياً"});}catch(error){return handleApiError(error,"تعذر إنشاء PDF للملحق");}}
