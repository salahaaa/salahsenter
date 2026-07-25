export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { fail, handleApiError, ok } from "@/lib/api";
import { getCronAuthorizationStatus } from "@/lib/cron/auth";
import { processPlatformRevenueCycle } from "@/lib/platform-revenue/service";
import { writeAuditLog } from "@/lib/audit";
export async function GET(request:Request){try{const auth=getCronAuthorizationStatus(request);if(!auth.ok)return fail(auth.message,auth.status);const limit=Number(new URL(request.url).searchParams.get("limit")||250);const result=await processPlatformRevenueCycle({limit});await writeAuditLog({action:"create",category:"financial",entityType:"system.platform_revenue_cycle",afterData:{periodStart:result.periodStart,periodEnd:result.periodEnd,issuedCount:result.issuedCount,awaitingSalesReportCount:result.awaitingSalesReportCount,collections:result.collections}});return ok({result,message:"تمت معالجة دورة إيرادات المنصة"});}catch(error){return handleApiError(error,"تعذر معالجة دورة إيرادات المنصة");}}
