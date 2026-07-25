export const dynamic="force-dynamic";
import { eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { getCurrentSession, hasRole } from "@/lib/auth";
import { db, merchantContractAddendums } from "@/lib/db";
import { contractSignatureSchema } from "@/lib/validators";
import { signContractAddendum } from "@/lib/contracts/addendums";
import { safeCompareHash } from "@/lib/security";
import { checkIpRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";
function canAccess(addendum:any,session:any,token?:string|null){return Boolean((session&&hasRole(session,"super_admin"))||(session?.userId&&session.userId===addendum.merchantId)||safeCompareHash(token,addendum.accessTokenHash));}
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{const {id}=await context.params;const session=await getCurrentSession();const token=new URL(request.url).searchParams.get("token");const [addendum]=await db.select().from(merchantContractAddendums).where(eq(merchantContractAddendums.id,id)).limit(1);if(!addendum)return fail("ملحق العقد غير موجود",404);if(!canAccess(addendum,session,token))return fail("لا تملك صلاحية الوصول إلى الملحق",403);return ok({addendum:{id:addendum.id,amendmentNumber:addendum.amendmentNumber,title:addendum.title,version:addendum.version,bodySnapshot:addendum.bodySnapshot,status:addendum.status,reason:addendum.reason,signedAt:addendum.signedAt,signatureUrl:addendum.signatureUrl}});}catch(error){return handleApiError(error,"تعذر تحميل ملحق العقد");}}
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{const rate=await checkIpRateLimit("contract-addendum:sign",10,60*60*1000);if(!rate.allowed)return fail("تم تجاوز حد محاولات التوقيع مؤقتاً",429);const {id}=await context.params;const session=await getCurrentSession();const raw=await request.json();const payload=contractSignatureSchema.parse(raw);const result=await signContractAddendum({addendumId:id,merchantId:session?.userId||null,token:raw.token||null,signerName:payload.signerName,signatureDataUrl:payload.signatureDataUrl,version:payload.contractVersion});await writeAuditLog({actorId:session?.userId||null,action:"update",entityType:"merchant_contract_addendum_signed",entityId:id,beforeData:result.before,afterData:result.addendum});return ok({addendum:result.addendum,message:"تم توقيع ملحق العقد وحفظ PDF محلياً بانتظار اعتماد الإدارة"});}catch(error){return handleApiError(error,"تعذر توقيع ملحق العقد");}}
