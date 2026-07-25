export const dynamic = "force-dynamic";
export const revalidate = 300;

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Footer } from "@/components/layout/footer";
import { SiteHeader } from "@/components/layout/site-header";
import { StructuredData, breadcrumbJsonLd } from "@/components/seo/structured-data";
import { cmsPages, db } from "@/lib/db";
import { absolutePublicUrl } from "@/lib/seo";

async function getPublicCmsPage(slug: string) {
  return (await db.select().from(cmsPages).where(and(eq(cmsPages.slug, slug), eq(cmsPages.status, "active"))).limit(1))[0] || null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublicCmsPage(slug);
  if (!page) return {};
  const seo = (page.seo || {}) as Record<string, unknown>;
  return {
    title: String(seo.title || page.title),
    description: String(seo.description || page.excerpt || page.content.slice(0, 160)),
    alternates: { canonical: `/${page.slug}` }
  };
}

export default async function PublicCmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublicCmsPage(slug);
  if (!page) notFound();
  return <main className="min-h-screen bg-slate-50"><SiteHeader/><StructuredData data={[{ "@context": "https://schema.org", "@type": page.type === "article" ? "Article" : "WebPage", headline: page.title, name: page.title, description: page.excerpt || page.content.slice(0, 160), url: absolutePublicUrl(`/${page.slug}`) }, breadcrumbJsonLd([{ name: "الرئيسية", url: absolutePublicUrl("/") }, { name: page.title, url: absolutePublicUrl(`/${page.slug}`) }])]} /><article className="container max-w-4xl py-10"><header className="rounded-[2rem] bg-slate-950 p-8 text-right text-white shadow-card"><p className="text-xs font-black text-blue-300">{page.type}</p><h1 className="mt-3 text-3xl font-black md:text-5xl">{page.title}</h1>{page.excerpt?<p className="mt-4 text-sm leading-8 text-white/75">{page.excerpt}</p>:null}</header><section className="mt-6 whitespace-pre-wrap rounded-[2rem] border bg-white p-8 text-right text-sm leading-9 text-slate-700 shadow-card">{page.content}</section></article><Footer/></main>;
}
