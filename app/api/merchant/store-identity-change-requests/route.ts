export const dynamic="force-dynamic";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { identityChangeRequestSchema } from "@/lib/contracts/identity-policy";
import { createStoreIdentityChangeRequest, getMerchantIdentityChangeRequests } from "@/lib/contracts/addendums";
import { userHasStoreOperation } from "@/lib/rbac";
import { notifyAdmins } from "@/lib/notifications";
import { writeAuditLog } from "@/lib/audit";
export async function GET(){try{const session=await requireAuth();return ok(await getMerchantIdentityChangeRequests(session.userId));}catch(error){return handleApiError(error,"تعذر تحميل طلبات تعديل هوية المتجر");}}
export async function POST(request:Request){try{const session=await requireAuth();const store=await getMerchantPrimaryStore(session.userId);if(!store||!hasStoreAccess(session,store.id))return fail("لا يوجد متجر متاح",403);if(!(await userHasStoreOperation(session.userId,store.id,"identity_changes.create")))return fail("لا تملك صلاحية طلب تعديل بيانات المتجر المحمية",403);const payload=identityChangeRequestSchema.parse(await request.json());const result=await createStoreIdentityChangeRequest({storeId:store.id,merchantId:session.userId,...payload});await notifyAdmins({title:"طلب تعديل هوية متجر",body:`طلب متجر ${store.name} تعديل ${payload.fieldKey}.`,type:"store_identity_change_requested",data:{requestId:result.request.id,storeId:store.id,url:"/admin/identity-change-requests"}});await writeAuditLog({actorId:session.userId,action:"create",entityType:"store_identity_change_request",entityId:result.request.id,afterData:result.request});return created({request:result.request,message:"تم إرسال طلب تعديل البيانات المحمية للإدارة"});}catch(error){return handleApiError(error,"تعذر إرسال طلب تعديل هوية المتجر");}}
