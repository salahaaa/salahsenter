import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ContractActions } from "@/components/admin/contract-actions";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { db, merchantContracts, stores, users } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";

export default async function FrozenStoresPage() {
  const session = await requireAuth();
  await assertAdmin(session, "stores.manage");
  const rows = hasDatabase()
    ? await db.select({ store: stores, contract: merchantContracts, merchant: users }).from(stores).leftJoin(merchantContracts, eq(stores.id, merchantContracts.storeId)).leftJoin(users, eq(stores.merchantId, users.id)).where(eq(stores.status, "frozen")).orderBy(desc(stores.updatedAt)).limit(100)
    : [];
  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex items-center justify-between"><div><h1 className="text-3xl font-black text-slate-950">المتاجر المجمدة</h1><p className="mt-2 text-sm text-slate-500">متاجر مجمدة بسبب انتهاء/إنهاء العقد، مع حفظ جميع البيانات والمنتجات والطلبات.</p></div><Button asChild variant="outline"><Link href="/admin/contracts">إدارة العقود</Link></Button></div>{!rows.length?<EmptyState title="لا توجد متاجر مجمدة"/>:<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{rows.map(({store,contract,merchant})=><article key={`${store.id}-${contract?.id||"no"}`} className="rounded-3xl border bg-white p-5 shadow-card"><h3 className="text-xl font-black text-slate-950">{store.name}</h3><p className="mt-2 text-sm text-slate-500">رقم المتجر: <b>{store.storeNumber}</b></p><p className="mt-1 text-sm text-slate-500">التاجر: {merchant?.fullName || "-"}</p><p className="mt-1 text-sm text-slate-500">العقد: {contract?.contractNumber || "-"}</p><div className="mt-5">{contract ? <ContractActions contractId={contract.id} status={contract.status}/> : <Button asChild size="sm"><Link href={`/admin/stores`}>إدارة المتجر</Link></Button>}</div></article>)}</div>}</section></main>
}
