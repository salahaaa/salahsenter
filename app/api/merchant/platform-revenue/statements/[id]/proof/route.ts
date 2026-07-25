export const dynamic = "force-dynamic";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, mediaAssets } from "@/lib/db";
import { submitPlatformStatementPaymentProof } from "@/lib/platform-revenue/service";
import { requiredUrlOrPathSchema } from "@/lib/validators";
const schema=z.object({proofUrl:requiredUrlOrPathSchema,paymentReference:z.string().trim().max(180).optional().nullable(),note:z.string().trim().max(1500).optional().nullable()});
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{const {id}=await context.params;const session=await requireAuth();const payload=schema.parse(await request.json());const [asset]=await db.select({id:mediaAssets.id,url:mediaAssets.url,storageKey:mediaAssets.storageKey,mimeType:mediaAssets.mimeType}).from(mediaAssets).where(and(eq(mediaAssets.ownerId,session.userId),eq(mediaAssets.url,payload.proofUrl))).limit(1);if(!asset||!asset.storageKey?.startsWith("platform-revenue-payment-proofs/"))return fail("ارفع إثبات السداد من الحقل المخصص لفواتير المنصة أولاً",422);if(!(asset.mimeType?.startsWith("image/")||asset.mimeType==="application/pdf"))return fail("إثبات السداد يجب أن يكون صورة أو PDF",422);const result=await submitPlatformStatementPaymentProof({statementId:id,merchantId:session.userId,assetId:asset.id,proofUrl:asset.url,storageKey:asset.storageKey,paymentReference:payload.paymentReference,note:payload.note});return created({statement:result.statement,message:"تم إرسال إثبات سداد كشف المنصة للمراجعة"});}catch(error){return handleApiError(error,"تعذر إرسال إثبات سداد كشف المنصة");}}
