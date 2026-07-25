import { PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({ title, description, className }: { title: string; description?: string; className?: string }) {
  return (
    <div className={cn("flex min-h-44 flex-col items-center justify-center rounded-3xl border border-dashed bg-white/70 p-8 text-center", className)}>
      <div className="mb-4 rounded-full bg-slate-100 p-4 text-slate-500">
        <PackageOpen className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-black text-slate-900">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm leading-7 text-slate-500">{description}</p> : null}
    </div>
  );
}
