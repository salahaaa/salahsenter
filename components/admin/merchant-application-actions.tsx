"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { apiClient, ApiClientError } from "@/lib/client/api-client";

export function MerchantApplicationActions({ id, status }: { id: string; status: string }) {
  const router=useRouter();const [target,setTarget]=useState<"approve"|"reject"|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState<string|null>(null);
  async function run(reason:string){if(!target)return;setLoading(true);setError(null);try{if(target==="approve")await apiClient.post(`/api/admin/merchant-applications/${id}/approve`,{}, {invalidateTags:[`application:${id}`,"stores"]});else await apiClient.post(`/api/admin/merchant-applications/${id}/review`,{action:"reject",adminNote:reason},{invalidateTags:[`application:${id}`]});setTarget(null);router.refresh()}catch(caught){setError(caught instanceof ApiClientError?caught.message:"تعذر تنفيذ الإجراء")}finally{setLoading(false)}}
  return <div className="flex flex-wrap gap-2"><Button size="sm" onClick={()=>setTarget("approve")} disabled={loading||!["contract_signed","waiting_final_approval"].includes(status)}>اعتماد الحساب وبدء التهيئة</Button><Button size="sm" variant="outline" onClick={()=>setTarget("reject")} disabled={loading||!["pending","new","under_review","documents_required","waiting_for_data","pre_approved","contract_created","contract_signed","waiting_final_approval"].includes(status)}>رفض</Button><ActionConfirmationDialog open={Boolean(target)} title={target==="approve"?"اعتماد حساب المتجر": "رفض طلب المتجر"} description={target==="approve"?"سيتم إنشاء حساب التاجر والمتجر والعقد وشروط الإيراد. المتجر سيبقى pending وغير ظاهر للعامة حتى يجتاز checklist الإطلاق.":"سيتم رفض الطلب مع حفظ سبب واضح للتاجر."} actionLabel={target==="approve"?"اعتماد وبدء التهيئة":"رفض الطلب"} destructive={target==="reject"} reasonRequired={target==="reject"} auditContext="merchant_application_final_approval" loading={loading} error={error} onClose={()=>{if(!loading){setTarget(null);setError(null)}}} onConfirm={({reason})=>run(reason)}/></div>
}
