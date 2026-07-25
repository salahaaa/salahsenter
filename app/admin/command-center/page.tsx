import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSignature, Gauge, PackageSearch, Store, Tag, Users } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminCommandCenterData } from "@/lib/command-center";
import { formatNumber } from "@/lib/utils";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";

export default async function AdminCommandCenterPage() {
  const session = await requireAuth();
  await assertAdmin(session, "reports.view");
  const data = await getAdminCommandCenterData();

  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-blue-700"><Gauge className="h-4 w-4" /> Command Center</div>
            <h1 className="text-3xl font-black text-slate-950 md:text-5xl">مركز قيادة المنصة</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">لوحة تنفيذية تجمع أهم المؤشرات والمهام التي تحتاج تدخلاً سريعاً من الإدارة.</p>
          </div>
          <Button asChild variant="outline"><Link href="/admin"><ArrowLeft className="h-4 w-4" /> العودة للوحة الأدمن</Link></Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          <Metric title="المستخدمون" value={data.metrics.users} icon={<Users className="h-5 w-5" />} />
          <Metric title="المتاجر النشطة" value={data.metrics.activeStores} icon={<Store className="h-5 w-5" />} />
          <Metric title="المنتجات" value={data.metrics.products} icon={<PackageSearch className="h-5 w-5" />} />
          <Metric title="عروض بانتظار الاعتماد" value={data.metrics.pendingOffers} icon={<Tag className="h-5 w-5" />} danger={data.metrics.pendingOffers > 0} />
          <Metric title="عقود قريبة الانتهاء" value={data.metrics.nearExpiryContracts} icon={<FileSignature className="h-5 w-5" />} danger={data.metrics.nearExpiryContracts > 0} />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
          <Card>
            <CardHeader><CardTitle>مهام عاجلة</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <ActionRow count={data.metrics.pendingApplications} title="طلبات فتح متجر تحتاج مراجعة" href="/admin/merchant-applications" />
              <ActionRow count={data.metrics.pendingOffers} title="عروض متاجر بانتظار الاعتماد" href="/admin/offers" />
              <ActionRow count={data.metrics.nearExpiryContracts} title="عقود قريبة الانتهاء" href="/admin/contracts?report=near-expiry" />
              <ActionRow count={data.metrics.frozenStores} title="متاجر مجمدة تحتاج قرار" href="/admin/stores/frozen" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>جاهزية النظام</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.readiness.map((item) => (
                <div key={item.title} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                  <div><p className="font-black">{item.title}</p><p className="text-xs text-slate-500">{item.description}</p></div>
                  {item.ok ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : <AlertTriangle className="h-6 w-6 text-amber-500" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-3">
          <Panel title="طلبات التجار" href="/admin/merchant-applications" items={data.pendingApplications.map((item) => ({ id: item.id, title: item.storeName, meta: `${item.applicantName} — ${item.status}` }))} />
          <Panel title="عروض بانتظار الاعتماد" href="/admin/offers" items={data.pendingOffers.map((row) => ({ id: row.offer.id, title: row.offer.title, meta: `${row.storeName} — ${row.offer.status}` }))} />
          <Panel title="مخزون منخفض" href="/admin/products" items={data.lowStock.map((row) => ({ id: row.variant.id, title: row.productName, meta: `${row.storeName} — ${row.variant.stockQuantity} متبقي` }))} />
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value, icon, danger = false }: { title: string; value: number; icon: React.ReactNode; danger?: boolean }) {
  return <Card className={danger ? "ring-2 ring-amber-200" : ""}><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-sm text-slate-500"><span>{title}</span><span className={danger ? "text-amber-500" : "text-blue-500"}>{icon}</span></CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-slate-950">{formatNumber(value)}</div></CardContent></Card>;
}
function ActionRow({ count, title, href }: { count: number; title: string; href: string }) { return <Link href={href} className="flex items-center justify-between rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-card"><span className="font-black">{title}</span><Badge variant={count ? "warning" : "success"}>{formatNumber(count)}</Badge></Link>; }
function Panel({ title, href, items }: { title: string; href: string; items: Array<{ id: string; title: string; meta: string }> }) { return <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>{title}</CardTitle><Button asChild size="sm" variant="outline"><Link href={href}>فتح</Link></Button></CardHeader><CardContent className="space-y-2">{items.length ? items.map((item) => <div key={item.id} className="rounded-xl bg-slate-50 p-3"><p className="font-black">{item.title}</p><p className="text-xs text-slate-500">{item.meta}</p></div>) : <p className="text-sm font-bold text-slate-400">لا توجد عناصر حالياً</p>}</CardContent></Card>; }
