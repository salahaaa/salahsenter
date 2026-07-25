import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A catalogue-safe product image frame.
 *
 * The blurred backdrop fills the card without cutting the actual product. The
 * foreground image always uses `object-contain`, so portrait, square and wide
 * merchant photos remain complete instead of looking cropped or tiny on gray.
 */
export function ProductMediaFrame({
  src,
  alt,
  className,
  imageClassName,
  loading = "lazy",
  priority = false,
  children
}: {
  src?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  loading?: "lazy" | "eager";
  priority?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={cn("relative isolate grid overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100", className)}>
      {src ? (
        <>
          {/* Decorative only: it fills the frame but never replaces/crops the product image. */}
          <img src={src} alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full scale-110 object-cover opacity-[0.16] blur-2xl" />
          <div className="absolute inset-0 -z-10 bg-white/45" />
          <img
            src={src}
            alt={alt}
            loading={priority ? "eager" : loading}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            className={cn("relative z-0 h-full w-full object-contain p-2.5 drop-shadow-[0_12px_18px_rgba(15,23,42,0.12)] transition duration-500", imageClassName)}
          />
        </>
      ) : (
        <div className="relative z-0 grid place-items-center p-5 text-center text-xs font-black text-slate-400">صورة المنتج غير مرفوعة</div>
      )}
      {children ? <div className="pointer-events-none absolute inset-0 z-10">{children}</div> : null}
    </div>
  );
}
