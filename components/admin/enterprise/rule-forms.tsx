"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CommissionRuleForm(){return <RuleForm endpoint="/api/admin/commission-rules" title="قاعدة عمولة" fields={["scope","rate","fixedFee","priority"]}/>}
export function TaxRuleForm(){return <RuleForm endpoint="/api/admin/tax-rules" title="قاعدة ضريبة" fields={["rate","priority"]} tax/>}
function RuleForm({endpoint,title,fields,tax=false}:{endpoint:string;title:string;fields:string[];tax?:boolean}){const router=useRouter();const[message,setMessage]=useState<string|null>(null);async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const formElement=e.currentTarget;const f=new FormData(formElement);const payload:Record<string,unknown>={name:f.get("name"),code:f.get("code"),isActive:true};for(const key of fields) payload[key]=["rate","fixedFee","priority"].includes(key)?Number(f.get(key)||0):f.get(key)||undefined;if(tax) payload.includedInPrice=f.get("includedInPrice")==="on";const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await res.json();setMessage(res.ok?`✓ تم حفظ ${title}`:data.message||"تعذر الحفظ");if(res.ok){formElement.reset();router.refresh();}}return <form onSubmit={submit} className="grid gap-3 rounded-3xl border bg-white p-5 shadow-card md:grid-cols-2"><Field label="الاسم" name="name" required/><Field label="الكود" name="code" required/>{fields.map(f=><Field key={f} label={f} name={f} type={["rate","fixedFee","priority"].includes(f)?"number":"text"}/>)}{tax?<label className="flex items-center gap-2 text-sm font-bold"><input name="includedInPrice" type="checkbox"/> السعر شامل الضريبة</label>:null}<div className="md:col-span-2 flex items-center gap-3"><Button>حفظ</Button>{message?<span className="text-sm font-bold text-slate-600">{message}</span>:null}</div></form>}
function Field({label,name,type="text",required=false}:{label:string;name:string;type?:string;required?:boolean}){return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} required={required}/></div>}
