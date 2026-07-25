export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAuth } from "@/lib/auth";
import { db, products, stores, wishlists } from "@/lib/db";
import { inlineMediaSql } from "@/lib/inline-media";
import { formatCurrency } from "@/lib/utils";

export default async function WishlistPage() {
  const session = await requireAuth();
  const items = await db.select({ id: wishlists.id, productId: products.id, name: products.name, slug: products.slug, imageUrl: inlineMediaSql("products", products.id, "mainImageUrl", products.mainImageUrl), basePrice: products.basePrice, storeName: stores.name, storeSlug: stores.slug, createdAt: wishlists.createdAt }).from(wishlists).innerJoin(products, eq(wishlists.productId, products.id)).innerJoin(stores, eq(wishlists.storeId, stores.id)).where(eq(wishlists.userId, session.userId)).orderBy(desc(wishlists.createdAt));
  return <main className="min-h-screen bg-slate-50"><SiteHeader/><section className="container py-8"><div className="mb-8 flex items-center justify-between"><div><h1 className="text-3xl font-black">المفضلة</h1><p className="mt-2 text-sm text-slate-500">منتجات حفظتها للعودة إليها لاحقاً.</p></div><Button asChild variant="outline"><Link href="/">الرئيسية</Link></Button></div>{!items.length?<EmptyState title="لا توجد منتجات في المفضلة"/>:<div className="grid gap-5 md:grid-cols-3 xl:grid-cols-4">{items.map((item)=><Link key={item.id} href={`/store/${item.storeSlug}/products/${item.slug}`} className="overflow-hidden rounded-3xl border bg-white shadow-card transition hover:-translate-y-1 hover:shadow-soft"><div className="h-48 bg-slate-100">{item.imageUrl?<img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover"/>:null}</div><div className="p-4 text-right"><h3 className="line-clamp-2 font-black">{item.name}</h3><p className="mt-1 text-xs text-slate-500">{item.storeName}</p><p className="mt-3 font-black text-primary">{formatCurrency(item.basePrice || 0)}</p></div></Link>)}</div>}</section><Footer/></main>;
}
