export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { Building2 } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { BranchReviewActions } from "@/components/admin/branch-review-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { listAdminBranches } from "@/lib/enterprise/store-branches";
import { formatCurrency } from "@/lib/utils";

export default async function AdminBranchesPage() {
  const session = await requireAuth();
  await assertAdmin(session, "branches.manage");
  const rows = await listAdminBranches();
  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">إدارة المحلات والفروع</h1><p className="mt-2 text-sm text-slate-500">اعتماد كل فرع عبر ملحق موقع للعقد الرئيسي، ثم إنشاء إيجار أو عمولة أو نموذج هجين مستقل في إيرادات المنصة.</p></div><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ branch, store, group, addendum }) => <Card key={branch.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{store.name}</CardTitle><p className="mt-1 text-xs font-bold text-slate-500">{group.companyName} • {store.storeNumber} • {branch.branchCode}</p></div><Building2 className="h-8 w-8 text-blue-500" /></div></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2"><Badge variant={branch.approvalStatus === "approved" ? "success" : branch.approvalStatus === "rejected" ? "danger" : "warning"}>{branch.approvalStatus}</Badge><Badge variant={store.status === "active" ? "success" : "outline"}>{store.status}</Badge><Badge variant="outline">{branch.revenueModel}</Badge>{addendum ? <Badge variant={addendum.status === "active" ? "success" : "warning"}>ملحق: {addendum.status}</Badge> : null}</div><p className="text-sm leading-7 text-slate-600">{branch.address || "لا يوجد عنوان تفصيلي"}</p><p className="text-sm font-black text-primary">الإيجار: {formatCurrency(branch.rentAmount, branch.rentCurrency)} — العمولة: {branch.commissionRate}%</p><BranchReviewActions branchId={branch.id} addendumId={addendum?.id} addendumStatus={addendum?.status} defaultRent={String(branch.rentAmount || 0)} defaultCommission={String(branch.commissionRate || 0)} defaultCurrency={branch.rentCurrency} defaultModel={branch.revenueModel} defaultDueDays={String(branch.dueDays || 7)} defaultGraceDays={String(branch.graceDays || 7)} /></CardContent></Card>)}
        </div>
      </section>
    </main>
  );
}
