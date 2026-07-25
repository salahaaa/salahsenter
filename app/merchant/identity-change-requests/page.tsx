export const dynamic="force-dynamic";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { getMerchantIdentityChangeRequests } from "@/lib/contracts/addendums";
import { StoreIdentityChangeRequestsPanel } from "@/components/merchant/store-identity-change-requests-panel";
export default async function StoreIdentityChangeRequestsPage(){const session=await requireAuth();const data=await getMerchantIdentityChangeRequests(session.userId);return <main className="min-h-screen merchant-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-xs font-black text-amber-700"><ShieldCheck className="h-4 w-4"/> Contract Governed Fields</div><h1 className="text-3xl font-black text-slate-950">تعديل بيانات المتجر المحمية</h1></div><Button asChild variant="outline"><Link href="/merchant/settings">العودة للإعدادات</Link></Button></div><StoreIdentityChangeRequestsPanel initial={JSON.parse(JSON.stringify(data))}/></section></main>}
