export const dynamic = "force-dynamic";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { ErpCertificationPanel } from "@/components/admin/erp-certification-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { db, erpConnectorCertifications, integrationClients, stores } from "@/lib/db";

export default async function ErpCertificationPage() {
  const session = await requireAuth();
  await assertAdmin(session, "security.manage");
  const [certifications, clients, storeRows] = await Promise.all([
    db.select({ certification: erpConnectorCertifications, clientName: integrationClients.name, clientKey: integrationClients.clientKey, storeName: stores.name }).from(erpConnectorCertifications).innerJoin(integrationClients, eq(erpConnectorCertifications.integrationClientId, integrationClients.id)).leftJoin(stores, eq(erpConnectorCertifications.storeId, stores.id)).orderBy(desc(erpConnectorCertifications.updatedAt)).limit(200),
    db.select({ id: integrationClients.id, name: integrationClients.name, clientKey: integrationClients.clientKey }).from(integrationClients).orderBy(desc(integrationClients.createdAt)).limit(200),
    db.select({ id: stores.id, name: stores.name }).from(stores).limit(500)
  ]);
  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap justify-between gap-4"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700"><ShieldCheck className="h-4 w-4"/> ERP Connector Certification</div><h1 className="text-3xl font-black text-slate-950 md:text-5xl">شهادات موصلات ERP</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">بوابة readiness قبل تجربة تاجر: agent حديث، mappings، conflict policies ومزامنة ناجحة موثقة.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/admin/integrations">التكاملات</Link></Button><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div></div><ErpCertificationPanel certifications={JSON.parse(JSON.stringify(certifications))} clients={clients} stores={storeRows}/></section></main>;
}
