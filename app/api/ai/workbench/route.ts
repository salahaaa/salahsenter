export const dynamic="force-dynamic";
import { z } from "zod";
import { created, fail, handleApiError } from "@/lib/api";
import { getCurrentSession, requireAuth } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { assertAdmin, userHasStoreOperation } from "@/lib/rbac";
import { runAiWorkbench } from "@/lib/ai/workbench";
const schema=z.object({audience:z.enum(["merchant","admin","customer"]),task:z.string().trim().min(2).max(120),prompt:z.string().trim().max(4000).optional().nullable()});
export async function POST(request:Request){try{const payload=schema.parse(await request.json());const session=payload.audience === "customer" ? await getCurrentSession() : await requireAuth();let storeId:string|null=null;if(payload.audience==="admin"){if(!session)return fail("يلزم تسجيل الدخول",401);await assertAdmin(session,"admin.access");}if(payload.audience==="merchant"){if(!session)return fail("يلزم تسجيل الدخول",401);const store=await getMerchantPrimaryStore(session.userId);if(!store)return fail("لا يوجد متجر",403);if(!(await userHasStoreOperation(session.userId,store.id,"ai.use")))return fail("لا تملك صلاحية ذكاء المتجر",403);storeId=store.id;}return created(await runAiWorkbench({userId:session?.userId || null,audience:payload.audience,task:payload.task,prompt:payload.prompt,storeId}));}catch(error){return handleApiError(error,"تعذر تشغيل مهمة الذكاء");}}
