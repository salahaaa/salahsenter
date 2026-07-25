"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ContractTemplateForm() { const router = useRouter(); const [message,setMessage]=useState<string|null>(null); async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault(); const formElement=e.currentTarget;const f=new FormData(formElement); const variables=String(f.get("variables")||"").split("\n").map(x=>x.trim()).filter(Boolean); const res=await fetch("/api/admin/contract-templates",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:f.get("name"),code:f.get("code"),version:f.get("version")||"1.0",body:f.get("body"),variables,isDefault:f.get("isDefault")==="on",isActive:true})}); const data=await res.json(); setMessage(res.ok?"✓ تم حفظ قالب العقد":data.message||"تعذر الحفظ"); if(res.ok){formElement.reset(); router.refresh();}} return <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2"><Field label="اسم القالب" name="name" required/><Field label="الكود" name="code" required/><Field label="الإصدار" name="version"/><label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-bold"><input name="isDefault" type="checkbox"/> افتراضي</label><div className="space-y-2 md:col-span-2"><Label>المتغيرات - سطر لكل متغير</Label><Textarea name="variables" placeholder="storeName&#10;merchantName"/></div><div className="space-y-2 md:col-span-2"><Label>نص العقد</Label><Textarea name="body" required className="min-h-72"/></div><div className="flex items-center gap-3 md:col-span-2"><Button>حفظ القالب</Button>{message?<span className="text-sm font-bold text-slate-600">{message}</span>:null}</div></form>}
function Field({label,name,required=false}:{label:string;name:string;required?:boolean}){return <div className="space-y-2"><Label>{label}</Label><Input name={name} required={required}/></div>}
