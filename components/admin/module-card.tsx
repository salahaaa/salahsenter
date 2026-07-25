import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";

const gradients = [
  "from-blue-500 to-cyan-400",
  "from-violet-500 to-fuchsia-500",
  "from-amber-400 to-orange-500",
  "from-emerald-500 to-teal-400",
  "from-rose-500 to-pink-500",
  "from-indigo-500 to-blue-500"
];

function gradientFor(title: string) {
  const index = [...title].reduce((sum, char) => sum + char.charCodeAt(0), 0) % gradients.length;
  return gradients[index];
}

export function ModuleCard({ title, description, href, icon: Icon, badgeCount = 0 }: { title: string; description: string; href: string; icon: LucideIcon; badgeCount?: number }) {
  const gradient = gradientFor(title);
  return (
    <Link href={href} className="module-card group relative overflow-hidden rounded-3xl border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-soft">
      <div className={`absolute -left-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-2xl transition group-hover:scale-125 group-hover:opacity-20`} />
      {badgeCount > 0 ? <span className="absolute left-5 top-5 z-10 grid h-8 min-w-8 place-items-center rounded-full bg-red-600 px-2 text-sm font-black text-white shadow-lg shadow-red-600/25">{badgeCount > 99 ? "99+" : badgeCount}</span> : null}
      <div className={`relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg`}>
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="relative text-lg font-black text-slate-950">{title}</h3>
      <p className="relative mt-2 min-h-12 text-sm leading-7 text-slate-500">{description}</p>
      <span className="relative mt-5 inline-flex items-center gap-2 text-sm font-black text-primary">
        فتح القسم <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" />
      </span>
    </Link>
  );
}
