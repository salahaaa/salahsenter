export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { cookies } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { BranchManagementPanel } from "@/components/merchant/branch-management-panel";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { cities, countries, db, districts, governorates, wings } from "@/lib/db";
import { branchRentSummary, listMerchantBranches } from "@/lib/enterprise/store-branches";

export default async function MerchantBranchesPage() {
  const session = await requireAuth();
  const [{ branches, invoices }, wingRows, countryRows, governorateRows, cityRows, districtRows, rent, cookieStore] = await Promise.all([
    listMerchantBranches(session.userId),
    db.select({ id: wings.id, name: wings.name }).from(wings).where(eq(wings.isActive, true)).orderBy(asc(wings.sortOrder), asc(wings.name)),
    db.select({ id: countries.id, name: countries.name }).from(countries).where(eq(countries.isActive, true)).orderBy(asc(countries.sortOrder), asc(countries.name)),
    db.select({ id: governorates.id, name: governorates.name, countryId: governorates.countryId }).from(governorates).where(eq(governorates.isActive, true)).orderBy(asc(governorates.sortOrder), asc(governorates.name)),
    db.select({ id: cities.id, name: cities.name, governorateId: cities.governorateId }).from(cities).where(eq(cities.isActive, true)).orderBy(asc(cities.sortOrder), asc(cities.name)),
    db.select({ id: districts.id, name: districts.name, cityId: districts.cityId }).from(districts).where(eq(districts.isActive, true)).orderBy(asc(districts.sortOrder), asc(districts.name)),
    branchRentSummary(session.userId),
    cookies()
  ]);

  return (
    <main className="min-h-screen merchant-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">المحلات والفروع</h1>
            <p className="mt-2 text-sm leading-7 text-slate-500">افتح أكثر من محل أو فرع لنفس الشركة ونفس حساب التاجر، مع إيجار مستقل لكل محل وبدون تقديم طلب تاجر جديد لكل فرع.</p>
          </div>
          <Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button>
        </div>
        <BranchManagementPanel
          branches={branches as any}
          invoices={invoices as any}
          wings={wingRows}
          countries={countryRows}
          governorates={governorateRows}
          cities={cityRows}
          districts={districtRows}
          rent={rent}
          activeStoreId={cookieStore.get("merchant_store_id")?.value || null}
        />
      </section>
    </main>
  );
}
