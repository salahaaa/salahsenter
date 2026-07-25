export const dynamic="force-dynamic";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";
import { getAdminIdentityChangeRequests } from "@/lib/contracts/addendums";
import { AdminStoreIdentityChangeRequestsPanel } from "@/components/admin/store-identity-change-requests-panel";
export default async function AdminIdentityChangeRequestsPage(){const session=await requireAuth();await assertAdminOperation(session,"stores.identity_changes.review");const rows=await getAdminIdentityChangeRequests();return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-xs font-black text-amber-700"><ShieldCheck className="h-4 w-4"/> Contract Protection</div><h1 className="text-3xl font-black text-slate-950">طلبات تعديل هوية المتاجر</h1><p className="mt-2 text-sm leading-7 text-slate-500">اسم المتجر والبريد المعتمد لا يتغيران إلا عبر ملحق عقد موقع ثم اعتماد إداري.</p></div><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div><AdminStoreIdentityChangeRequestsPanel rows={JSON.parse(JSON.stringify(rows))}/></section></main>}
