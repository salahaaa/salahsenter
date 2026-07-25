import Link from "next/link";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { StoreOfferForm } from "@/components/merchant/store-offer-form";
import { StoreOfferActions } from "@/components/merchant/store-offer-actions";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { db, offerCampaigns, products, productVariants, storeOfferCollections } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";

type SearchParams = Record<string, string | string[] | undefined>;
const offerStatuses = ["pending_review", "approved", "rejected", "draft", "disabled"] as const;
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
function toPage(value: string | string[] | undefined) { const page = Number(first(value) || 1); return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1; }
function href(filters: { q: string; status: string }, page: number) { const p = new URLSearchParams(); if (filters.q) p.set("q", filters.q); if (filters.status) p.set("status", filters.status); if (page > 1) p.set("page", String(page)); const q = p.toString(); return q ? `/merchant/offers?${q}` : "/merchant/offers"; }

export default async function MerchantOffersPage({ searchParams }: { searchParams?: Promise<SearchParams> }){
 const params = searchParams ? await searchParams : {};
 const q = first(params.q).trim();
 const rawStatus = first(params.status);
 const status = offerStatuses.includes(rawStatus as any) ? rawStatus : "";
 const page = toPage(params.page);
 const pageSize = 50;
 const session=await requireAuth();
 const store=await getMerchantPrimaryStore(session.userId);
 const conditions: SQL[] = [];
 if (store) conditions.push(eq(storeOfferCollections.storeId, store.id));
 if (q) conditions.push(ilike(storeOfferCollections.title, `%${q}%`));
 if (status) conditions.push(eq(storeOfferCollections.status, status));
 const [campaigns, productRows, variantRows, offerRows] = store ? await Promise.all([
  db.select({id:offerCampaigns.id,name:offerCampaigns.name}).from(offerCampaigns).where(eq(offerCampaigns.status,"active")).orderBy(desc(offerCampaigns.createdAt)),
  db.select({id:products.id,name:products.name,productCode:products.productCode,barcode:products.barcode,basePrice:products.basePrice,mainImageUrl:products.mainImageUrl,status:products.status,productCommerceType:products.productCommerceType}).from(products).where(and(eq(products.storeId,store.id),eq(products.status,"active"),eq(products.productCommerceType,"ONLINE_SALES"))).orderBy(desc(products.createdAt)).limit(1000),
  db.select({id:productVariants.id,productId:productVariants.productId,title:productVariants.title,sku:productVariants.sku,price:productVariants.price,stockQuantity:productVariants.stockQuantity,reservedQuantity:productVariants.reservedQuantity,isActive:productVariants.isActive}).from(productVariants).innerJoin(products,eq(productVariants.productId,products.id)).where(and(eq(products.storeId,store.id),eq(products.status,"active"),eq(productVariants.isActive,true))).limit(5000),
  db.select().from(storeOfferCollections).where(and(...conditions)).orderBy(desc(storeOfferCollections.createdAt)).limit(pageSize + 1).offset((page - 1) * pageSize)
 ]) : [[],[],[],[]];
 const offers = offerRows.slice(0, pageSize);
 const hasNext = offerRows.length > pageSize;
 const filters = { q, status };
 return <main className="min-h-screen merchant-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex items-center justify-between"><div><h1 className="text-3xl font-black text-slate-950">نافذة العروض</h1><p className="mt-2 text-sm text-slate-500">إنشاء عروض مجمعة، وقائمة عروض سريعة مع بحث وفلترة.</p></div><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div>{!store?<EmptyState title="لا يوجد متجر"/>:<><StoreOfferForm storeId={store.id} campaigns={campaigns} products={productRows} variants={variantRows}/><section className="mt-8 rounded-3xl border bg-white p-6 shadow-card"><div className="mb-5"><h2 className="text-xl font-black">عروضي المرسلة</h2><p className="mt-1 text-xs font-bold text-slate-500">جدول سريع بدلاً من بطاقات طويلة عند كثرة العروض.</p></div><form action="/merchant/offers" method="get" className="mb-5 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_220px_auto_auto]"><input name="q" defaultValue={q} placeholder="بحث بعنوان العرض" className="h-11 rounded-xl border bg-white px-4 text-sm"/><select name="status" defaultValue={status} className="h-11 rounded-xl border bg-white px-4 text-sm"><option value="">كل الحالات</option><option value="pending_review">قيد المراجعة</option><option value="approved">معتمد</option><option value="rejected">مرفوض</option><option value="disabled">معطل</option></select><Button>بحث / فلترة</Button><Button asChild variant="outline"><Link href="/merchant/offers">تصفير</Link></Button></form>{!offers.length?<EmptyState title="لا توجد عروض مطابقة"/>:<div className="overflow-x-auto rounded-2xl border"><table className="w-full min-w-[900px] text-right text-sm"><thead className="bg-slate-100"><tr><th className="p-3">العرض</th><th className="p-3">حالة النشر</th><th className="p-3">وجهة النشر</th><th className="p-3">مخزون العرض</th><th className="p-3">الفترة</th><th className="p-3">ملاحظة الإدارة</th><th className="p-3">تحكم</th></tr></thead><tbody>{offers.map(o=><tr key={o.id} className="border-t hover:bg-slate-50"><td className="p-3"><div className="font-black">{o.title}</div><div className="mt-1 text-xs text-slate-500 line-clamp-1">{o.description || "-"}</div></td><td className="p-3"><Badge variant={o.publicationState==='storefront_live'||o.publicationState==='homepage_approved'?'success':o.publicationState==='rejected'?'danger':'warning'}>{o.endsAt && new Date(o.endsAt).getTime() < Date.now()?'منتهي — فكك المخزون':o.publicationState==='storefront_live'?'منشور داخل المتجر':o.publicationState==='homepage_review'?'بانتظار مراجعة الرئيسية':o.publicationState==='homepage_approved'?'معتمد للرئيسية':o.publicationState==='rejected'?'مرفوض':o.publicationState==='paused'?'موقوف':o.status}</Badge></td><td className="p-3 text-xs font-black">{o.publicationTarget==='storefront'?'نافذة المتجر':o.publicationTarget==='homepage'?'الرئيسية ومنصة العروض':'عرض قديم'}</td><td className="p-3 text-xs font-bold text-slate-600">{Number(o.bundleInitialQuantity || 0) ? `${o.bundleRemainingQuantity}/${o.bundleInitialQuantity} باقة` : "مباشر"}</td><td className="p-3 text-xs text-slate-500">{o.startsAt ? new Intl.DateTimeFormat("ar").format(o.startsAt) : "-"} ← {o.endsAt ? new Intl.DateTimeFormat("ar").format(o.endsAt) : "-"}</td><td className="p-3 text-xs text-slate-500">{o.adminNote || "-"}</td><td className="p-3"><StoreOfferActions offerId={o.id} publicationTarget={o.publicationTarget} publicationState={o.publicationState} bundleRemainingQuantity={Number(o.bundleRemainingQuantity || 0)} endsAt={o.endsAt} /></td></tr>)}</tbody></table></div>}<div className="mt-5 flex items-center justify-between gap-3 text-sm font-bold text-slate-500"><span>الصفحة {page} — 50 نتيجة كحد أقصى.</span><div className="flex gap-2">{page > 1 ? <Button asChild size="sm" variant="outline"><Link href={href(filters, page - 1)}>السابق</Link></Button> : null}{hasNext ? <Button asChild size="sm" variant="outline"><Link href={href(filters, page + 1)}>التالي</Link></Button> : null}</div></div></section></>}</section></main>
}
