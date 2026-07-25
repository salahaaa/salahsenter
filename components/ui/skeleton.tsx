import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-slate-200/80", className)} />;
}

export function PageSkeleton({ cards = 8 }: { cards?: number }) {
  return (
    <section className="container py-8">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-4 w-[32rem] max-w-full" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={index} className="rounded-3xl border bg-white p-4 shadow-card">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="mt-4 h-5 w-3/4" />
            <Skeleton className="mt-3 h-4 w-1/2" />
            <Skeleton className="mt-5 h-10 w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
