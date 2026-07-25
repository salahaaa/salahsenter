export const dynamic = "force-dynamic";

import Link from "next/link";
import nextDynamic from "next/dynamic";
import { GitCompareArrows } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";

const ProductComparisonWorkspace = nextDynamic(() => import("@/components/product/product-comparison-workspace").then((module) => module.ProductComparisonWorkspace), { loading: () => <div className="rounded-3xl border bg-white p-8 text-center text-sm font-bold text-slate-500">جارٍ تحميل مساحة المقارنة...</div> });

export default function ProductComparisonPage() {
  return <main className="min-h-screen bg-slate-50"><SiteHeader /><section className="container py-8"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-700"><GitCompareArrows className="h-4 w-4" /> Product Compare</div><h1 className="text-3xl font-black text-slate-950 md:text-5xl">قارن المنتجات والمتاجر</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">قارن السعر الأساسي والتوفر والتقييم والضمان والمواصفات التي أدخلها التجار قبل اتخاذ قرار الشراء.</p></div><Button asChild variant="outline"><Link href="/">العودة للتسوق</Link></Button></div><ProductComparisonWorkspace /></section><Footer /></main>;
}
