export const dynamic="force-dynamic";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { createDocumentsManifestPdfArchive, createSignedContractPdfArchive } from "@/lib/onboarding/application-pdf-archive";
import { writeAuditLog } from "@/lib/audit";
export async function POST(_request:Request,context:{params:Promise<{id:string;kind:string}>}){try{const {id,kind}=await context.params;const session=await requireAuth();await assertAdmin(session,"merchant_applications.manage");if(!["signed_contract_pdf","documents_manifest_pdf"].includes(kind))return fail("نوع أرشيف PDF غير صالح",422);const result=kind==="signed_contract_pdf"?await createSignedContractPdfArchive({applicationId:id,generatedBy:session.userId}):await createDocumentsManifestPdfArchive({applicationId:id,generatedBy:session.userId});await writeAuditLog({actorId:session.userId,action:"create",entityType:"merchant_application_pdf_archive",entityId:result.archive.id,afterData:result.archive});return ok({archive:result.archive,message:"تم إنشاء أرشيف PDF محلياً"});}catch(error){return handleApiError(error,"تعذر إعادة إنشاء أرشيف PDF");}}
