import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function SectionShell({
  title,
  description,
  href,
  children
}: {
  title: string;
  description?: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="container py-8 md:py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="section-title">{title}</h2>
          {description ? <p className="section-subtitle">{description}</p> : null}
        </div>
        {href ? (
          <Link href={href} className="hidden items-center gap-2 text-sm font-black text-primary md:flex">
            عرض الكل <ArrowLeft className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
