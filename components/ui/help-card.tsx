import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function HelpCard({ title = "طريقة الاستخدام", children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm leading-7 text-blue-950 shadow-sm", className)}>
      <div className="mb-2 flex items-center gap-2 font-black">
        <Info className="h-5 w-5 text-blue-600" /> {title}
      </div>
      <div className="space-y-1 text-blue-900">{children}</div>
    </div>
  );
}
