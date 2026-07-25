import Link from "next/link";
import { asc } from "drizzle-orm";
import { GeographyForm } from "@/components/admin/geography-form";
import { GeographyManager } from "@/components/admin/geography-manager";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { cities, countries, db, districts, governorates } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";

export default async function AdminGeographyPage() {
  const session = await requireAuth();
  await assertAdmin(session, "geography.manage");
  const [countryItems, governorateItems, cityItems, districtItems] = hasDatabase()
    ? await Promise.all([
        db.select().from(countries).orderBy(asc(countries.sortOrder), asc(countries.name)),
        db.select().from(governorates).orderBy(asc(governorates.sortOrder), asc(governorates.name)),
        db.select().from(cities).orderBy(asc(cities.sortOrder), asc(cities.name)),
        db.select().from(districts).orderBy(asc(districts.sortOrder), asc(districts.name))
      ])
    : [[], [], [], []];

  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container space-y-8 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">إدارة المناطق الجغرافية</h1>
            <p className="mt-2 text-sm text-slate-500">الدولة ← المحافظة ← المدينة ← المنطقة، كلها قابلة للإضافة والتعديل والتعطيل.</p>
          </div>
          <Button asChild variant="outline"><Link href="/admin">العودة</Link></Button>
        </div>
        <GeographyForm countries={countryItems} governorates={governorateItems} cities={cityItems} />
        <GeographyManager countries={countryItems} governorates={governorateItems} cities={cityItems} districts={districtItems} />
      </section>
    </main>
  );
}
