import Link from "next/link";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { StoreManagementPanel } from "@/components/admin/store-management-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { cities, countries, db, governorates, stores, users, wings } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";

type SearchParams = Record<string, string | string[] | undefined>;

const storeStatuses = ["active", "pending", "suspended", "closed", "frozen"] as const;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function toPage(value: string | string[] | undefined) {
  const page = Number(firstParam(value) || 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export default async function AdminStoresPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await requireAuth();
  await assertAdminOperation(session, "stores.view");
  const params = searchParams ? await searchParams : {};
  const q = firstParam(params.q).trim();
  const status = firstParam(params.status);
  const wingId = firstParam(params.wingId);
  const page = toPage(params.page);
  const pageSize = 50;

  const conditions: SQL[] = [];
  if (q) {
    const term = `%${q}%`;
    conditions.push(or(ilike(stores.name, term), ilike(stores.slug, term), ilike(stores.storeNumber, term), ilike(users.fullName, term), ilike(users.email, term), ilike(stores.contactPhone, term), ilike(stores.contactEmail, term))!);
  }
  if (storeStatuses.includes(status as (typeof storeStatuses)[number])) conditions.push(eq(stores.status, status as (typeof storeStatuses)[number]));
  if (wingId) conditions.push(eq(stores.primaryWingId, wingId));

  const [storeRows, wingItems] = hasDatabase()
    ? await Promise.all([
        db
          .select({
            id: stores.id,
            name: stores.name,
            slug: stores.slug,
            storeNumber: stores.storeNumber,
            status: stores.status,
            isActive: stores.isActive,
            orderCount: stores.orderCount,
            profileCompleteness: stores.profileCompleteness,
            ratingAverage: stores.ratingAverage,
            contactPhone: stores.contactPhone,
            contactEmail: stores.contactEmail,
            primaryWingId: stores.primaryWingId,
            countryName: countries.name,
            governorateName: governorates.name,
            cityName: cities.name,
            merchantName: users.fullName,
            merchantEmail: users.email
          })
          .from(stores)
          .leftJoin(users, eq(stores.merchantId, users.id))
          .leftJoin(countries, eq(stores.countryId, countries.id))
          .leftJoin(governorates, eq(stores.governorateId, governorates.id))
          .leftJoin(cities, eq(stores.cityId, cities.id))
          .where(conditions.length ? and(...conditions) : sql`true`)
          .orderBy(desc(stores.createdAt))
          .limit(pageSize + 1)
          .offset((page - 1) * pageSize),
        db.select({ id: wings.id, name: wings.name }).from(wings).where(eq(wings.isActive, true)).orderBy(asc(wings.sortOrder), asc(wings.name))
      ])
    : [[], []];

  const items = storeRows.slice(0, pageSize);
  const hasNext = storeRows.length > pageSize;

  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">إدارة المتاجر</h1>
            <p className="mt-2 text-sm text-slate-500">قائمة سريعة مع بحث وفلترة وتفاصيل عند الطلب، بدون تحميل شعارات أو أغلفة داخل الجدول.</p>
          </div>
          <Button asChild variant="outline"><Link href="/admin">العودة</Link></Button>
        </div>
        <StoreManagementPanel stores={items} wings={wingItems} filters={{ q, status: storeStatuses.includes(status as any) ? status : "", wingId, page }} hasNext={hasNext} />
      </section>
    </main>
  );
}
