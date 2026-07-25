import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { StoreSettingsForm } from "@/components/merchant/store-settings-form";
import { StoreContactForm } from "@/components/merchant/store-contact-form";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAuth } from "@/lib/auth";
import { categories, colors, db, sizes, units } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";

export default async function MerchantSettingsPage({ searchParams }: { searchParams?: Promise<{ mustChangePassword?: string }> }) {
  const session = await requireAuth();
  const params = searchParams ? await searchParams : {};
  const mustChangePassword = params.mustChangePassword === "1";
  const store = await getMerchantPrimaryStore(session.userId);
  const [categoryItems, unitItems, sizeItems, colorItems] = store
    ? await Promise.all([
        db.select().from(categories).where(eq(categories.storeId, store.id)).orderBy(asc(categories.sortOrder), asc(categories.name)),
        db.select().from(units).where(eq(units.storeId, store.id)).orderBy(asc(units.sortOrder), asc(units.name)),
        db.select().from(sizes).where(eq(sizes.storeId, store.id)).orderBy(asc(sizes.sortOrder), asc(sizes.name)),
        db.select().from(colors).where(eq(colors.storeId, store.id)).orderBy(asc(colors.sortOrder), asc(colors.name))
      ])
    : [[], [], [], []];

  return <main className="min-h-screen merchant-aurora"><SiteHeader /><section className="container py-8">{mustChangePassword ? <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-900">لأمان حساب المتجر، يجب تعيين كلمة مرور جديدة قبل متابعة العمل. استخدم نموذج تغيير كلمة المرور أدناه.</div> : null}<div className="mb-8 flex items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">إعدادات المتجر</h1><p className="mt-2 text-sm text-slate-500">الأقسام والوحدات والمقاسات والألوان تظهر تلقائياً في شاشة إضافة المنتج.</p></div><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div>{!store ? <EmptyState title="لا يوجد متجر" /> : <><StoreContactForm store={store} /><div className="mt-8"><StoreSettingsForm storeId={store.id} /></div><div className="mt-8" id="password"><h2 className="mb-4 text-xl font-black text-slate-950">تغيير كلمة المرور</h2><ChangePasswordForm /></div><div className="mt-8 grid gap-5 md:grid-cols-4"><SettingsList title="الأقسام" items={categoryItems} /><SettingsList title="الوحدات" items={unitItems} /><SettingsList title="المقاسات" items={sizeItems} /><SettingsList title="الألوان" items={colorItems} color /></div></>}</section></main>;
}

function SettingsList({ title, items, color = false }: { title: string; items: Array<{ id: string; name: string; isActive: boolean; hexCode?: string | null }>; color?: boolean }) {
  return <div className="rounded-3xl border bg-white p-5 shadow-card"><h2 className="mb-4 font-black">{title}</h2>{!items.length ? <EmptyState title="فارغ" className="min-h-28" /> : <div className="flex flex-wrap gap-2">{items.map((item) => <Badge key={item.id} variant={item.isActive ? "outline" : "warning"} className="gap-2">{color && item.hexCode ? <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.hexCode }} /> : null}{item.name}</Badge>)}</div>}</div>;
}
