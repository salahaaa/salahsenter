import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

type Wing = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  heroImageUrl: string | null;
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
  iconUrl: string | null;
};

export function WingsGrid({ wings }: { wings: Wing[] }) {
  if (!wings.length) {
    return <EmptyState title="لا توجد أجنحة منشورة" description="قم بإضافة الأجنحة وصورها الواقعية من لوحة الأدمن." />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {wings.map((wing) => (
        <Link key={wing.id} href={`/wings/${wing.slug}`} className="group overflow-hidden rounded-3xl border bg-white shadow-card transition hover:-translate-y-1 hover:shadow-soft">
          <div className="relative h-40 overflow-hidden bg-slate-100">
            {wing.heroImageUrl || wing.desktopImageUrl || wing.mobileImageUrl ? (
              <img
                src={wing.heroImageUrl || wing.desktopImageUrl || wing.mobileImageUrl || ""}
                alt={wing.name}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-center text-sm font-bold text-slate-400">
                صورة الجناح تُدار من لوحة الأدمن
              </div>
            )}
          </div>
          <div className="p-5">
            <div className="flex items-center gap-3">
              {wing.iconUrl ? <img src={wing.iconUrl} alt="" className="h-10 w-10 rounded-xl object-cover" loading="lazy" /> : null}
              <h3 className="text-lg font-black text-slate-950">{wing.name}</h3>
            </div>
            {wing.description ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{wing.description}</p> : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
