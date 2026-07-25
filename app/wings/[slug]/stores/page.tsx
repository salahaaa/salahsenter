export const revalidate = 300;

import Link from "next/link";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { ArrowRight, Search, Store } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { StoresGrid } from "@/components/home/store-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { cities, countries, db, governorates, stores, wings } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { inlineMediaSql, inlineRowMediaUrl } from "@/lib/inline-media";
import { formatNumber } from "@/lib/utils";

const PAGE_SIZE = 48;

export default async function WingStoresPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string; q?: string }> }) {
  const { slug } = await params;
  const { page: pageRaw, q: qRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw || 1) || 1);
  const q = String(qRaw || "").trim();

  if (!hasDatabase()) return <Unavailable />;

  const [wingRow] = await db.select().from(wings).where(and(eq(wings.slug, slug), eq(wings.isActive, true))).limit(1);
  if (!wingRow) return <Unavailable title="الجناح غير موجود" description="قد يكون الرابط غير صحيح أو تم تعطيل الجناح." />;
  const wing = { ...wingRow, heroImageUrl: inlineRowMediaUrl("wings", wingRow.id, "heroImageUrl", wingRow.heroImageUrl) };

  const conditions: SQL[] = [
    eq(stores.status, "active"),
    eq(stores.isActive, true),
    or(eq(stores.primaryWingId, wing.id), sql`exists (select 1 from store_wings sw where sw.store_id = ${stores.id} and sw.wing_id = ${wing.id})`)!
  ];
  if (q) conditions.push(or(ilike(stores.name, `%${q}%`), ilike(stores.storeNumber, `%${q}%`), ilike(stores.slug, `%${q}%`))!);

  const where = and(...conditions);
  const storeRows = await db
    .select({
      id: stores.id,
      name: stores.name,
      slug: stores.slug,
      coverImageUrl: inlineMediaSql("stores", stores.id, "coverImageUrl", stores.coverImageUrl),
      logoUrl: inlineMediaSql("stores", stores.id, "logoUrl", stores.logoUrl),
      ratingAverage: stores.ratingAverage,
      orderCount: stores.orderCount,
      countryName: countries.name,
      governorateName: governorates.name,
      cityName: cities.name
    })
    .from(stores)
    .leftJoin(countries, eq(stores.countryId, countries.id))
    .leftJoin(governorates, eq(stores.governorateId, governorates.id))
    .leftJoin(cities, eq(stores.cityId, cities.id))
    .where(where)
    .orderBy(desc(stores.salesTotal), desc(stores.orderCount), desc(stores.ratingAverage), asc(stores.name))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);

  const hasNext = storeRows.length > PAGE_SIZE;
  const items = storeRows.slice(0, PAGE_SIZE);

  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      <section className="relative overflow-hidden bg-slate-950 text-white">
        {wing.heroImageUrl ? <img src={wing.heroImageUrl} alt={wing.name} className="absolute inset-0 h-full w-full object-cover opacity-35" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-900/50" />
        <div className="container relative py-12 md:py-16">
          <Button asChild variant="outline" className="mb-7 border-white/20 bg-white/10 text-white hover:bg-white/20"><Link href={`/wings/${wing.slug}`}><ArrowRight className="h-4 w-4" /> العودة للجناح</Link></Button>
          <div className="max-w-3xl text-right">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white/80"><Store className="h-4 w-4" /> كل المتاجر</div>
            <h1 className="text-4xl font-black md:text-6xl">متاجر {wing.name}</h1>
            <p className="mt-4 text-sm leading-7 text-white/70 md:text-base">تصفح كل المتاجر النشطة داخل هذا الجناح مباشرة بدون انتظار أو تدوير.</p>
          </div>
        </div>
      </section>

      <section className="container py-8">
        <div className="mb-6 rounded-3xl border bg-white p-4 shadow-card">
          <form className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input name="q" defaultValue={q} placeholder="ابحث باسم المتجر أو رقم المتجر أو التاجر..." className="h-12 pr-12 text-right" />
            </div>
            <Button className="h-12 px-8">بحث</Button>
            {q ? <Button asChild variant="outline" className="h-12 px-8"><Link href={`/wings/${wing.slug}/stores`}>مسح</Link></Button> : null}
          </form>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-slate-500">الصفحة {formatNumber(page)} — المعروض {formatNumber(items.length)} متجر</p>
          <Button asChild variant="outline"><Link href="/wings">كل الأجنحة</Link></Button>
        </div>

        {items.length ? <StoresGrid stores={items} emptyTitle="لا توجد متاجر" /> : <EmptyState title="لا توجد متاجر مطابقة" description="جرّب البحث بكلمة أخرى أو العودة للجناح." />}

        <div className="mt-8 flex items-center justify-center gap-3">
          {page > 1 ? <Button asChild variant="outline"><Link href={`/wings/${wing.slug}/stores?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>السابق</Link></Button> : null}
          {hasNext ? <Button asChild><Link href={`/wings/${wing.slug}/stores?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>التالي</Link></Button> : null}
        </div>
      </section>
      <Footer />
    </main>
  );
}

function Unavailable({ title = "تعذر تحميل المتاجر", description = "تحقق من اتصال قاعدة البيانات أو من رابط الجناح." }: { title?: string; description?: string }) {
  return <main className="min-h-screen bg-slate-50"><SiteHeader /><section className="container py-12"><EmptyState title={title} description={description} /><div className="mt-6 text-center"><Button asChild variant="outline"><Link href="/wings">كل الأجنحة</Link></Button></div></section><Footer /></main>;
}
