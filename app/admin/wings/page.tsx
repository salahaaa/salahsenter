import Link from "next/link";
import { asc } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { WingForm } from "@/components/admin/wing-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteResourceButton } from "@/components/ui/delete-resource-button";
import { WingEditForm } from "@/components/admin/wing-edit-form";
import { db, wings } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { inlineMediaSql } from "@/lib/inline-media";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { listActivityTemplateSelections } from "@/lib/merchant/activity-template-selection";

export default async function AdminWingsPage() {
  const session = await requireAuth();
  await assertAdmin(session, "wings.manage");
  // Strip base64 images at the SQL layer so the SSR payload stays small.
  // Inline images become short /api/media/inline proxy URLs (they still render).
  const activityTemplates = hasDatabase() ? await listActivityTemplateSelections() : [];
  const items = hasDatabase()
    ? await db
        .select({
          id: wings.id,
          name: wings.name,
          slug: wings.slug,
          iconUrl: inlineMediaSql("wings", wings.id, "iconUrl", wings.iconUrl),
          heroImageUrl: inlineMediaSql("wings", wings.id, "heroImageUrl", wings.heroImageUrl),
          mobileImageUrl: inlineMediaSql("wings", wings.id, "mobileImageUrl", wings.mobileImageUrl),
          desktopImageUrl: inlineMediaSql("wings", wings.id, "desktopImageUrl", wings.desktopImageUrl),
          description: wings.description,
          activityTemplateKey: wings.activityTemplateKey,
          isActive: wings.isActive,
          sortOrder: wings.sortOrder
        })
        .from(wings)
        .orderBy(asc(wings.sortOrder), asc(wings.name))
    : [];

  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">إدارة الأجنحة</h1>
            <p className="mt-2 text-sm text-slate-500">كل جناح هو قطاع واحد للتاجر: اربطه بقالب تجهيز واحد، إضافة إلى الاسم والصور والوصف.</p>
          </div>
          <Button asChild variant="outline"><Link href="/admin">العودة</Link></Button>
        </div>

        <WingForm activityTemplates={activityTemplates} />

        <div className="mt-8">
          {!items.length ? (
            <EmptyState title="لا توجد أجنحة" description="أضف أول جناح من النموذج أعلاه أو نفذ seed." />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {items.map((wing) => (
                <article key={wing.id} className="overflow-hidden rounded-3xl border bg-white shadow-card">
                  <div className="h-36 bg-slate-100">
                    {wing.heroImageUrl ? <img src={wing.heroImageUrl} alt={wing.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">لا توجد صورة</div>}
                  </div>
                  <div className="p-5">
                    <h3 className="font-black text-slate-950">{wing.name}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-7 text-slate-500">{wing.description || "بدون وصف"}</p>
                    <div className="mt-3 flex items-center justify-between gap-2"><p className="text-xs font-bold text-slate-400">slug: {wing.slug}</p><div className="flex gap-2"><WingEditForm wing={wing} activityTemplates={activityTemplates} /><DeleteResourceButton endpoint={`/api/admin/wings/${wing.id}`} /></div></div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
