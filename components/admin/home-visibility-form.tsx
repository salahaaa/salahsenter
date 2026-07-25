"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { HomeVisibilityRules, VisibilityMode } from "@/lib/home-visibility";

function idsToText(ids: string[]) { return ids.join("\n"); }
function textToIds(value: string) { return value.split(/\n|,/).map((id) => id.trim()).filter(Boolean); }

export function HomeVisibilityForm({ initial }: { initial: HomeVisibilityRules }) {
  const [rules, setRules] = useState<HomeVisibilityRules>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [simulation, setSimulation] = useState<Record<string, unknown> | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    const response = await fetch("/api/admin/home-visibility", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rules) });
    const json = await response.json();
    setLoading(false);
    setMessage(response.ok ? "✓ تم حفظ قواعد الظهور" : json.message || "تعذر الحفظ");
  }

  function updateSection<K extends keyof HomeVisibilityRules["sections"]>(key: K, value: boolean) {
    setRules({ ...rules, sections: { ...rules.sections, [key]: value } });
  }

  async function recalculate() {
    setLoading(true);
    const response = await fetch("/api/admin/home-visibility/recalculate", { method: "POST" });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? `✓ ${json.data?.message || "تمت إعادة الحساب"}` : json.message || "تعذر إعادة الحساب");
  }

  async function simulate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const type = String(form.get("type") || "product");
    const id = String(form.get("id") || "").trim();
    if (!id) return setMessage("أدخل ID للمحاكاة");
    const response = await fetch(`/api/admin/home-visibility/simulate?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`);
    const json = await response.json().catch(() => ({}));
    if (response.ok) setSimulation(json.data);
    setMessage(response.ok ? "✓ تم تشغيل المحاكاة" : json.message || "تعذر تشغيل المحاكاة");
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <RuleCard title="إظهار وإخفاء أقسام الواجهة الرئيسية" description="هذه المفاتيح تتحكم مباشرة في ظهور الأقسام. استخدمها لإخفاء المنتجات الرائجة أو المتاجر الرائجة فوراً.">
        <Toggle label="إظهار المتاجر المميزة" checked={rules.sections.featuredStores} onChange={(value) => updateSection("featuredStores", value)} />
        <Toggle label="إظهار المتاجر الرائجة" checked={rules.sections.trendingStores} onChange={(value) => updateSection("trendingStores", value)} />
        <Toggle label="إظهار المنتجات الرائجة" checked={rules.sections.trendingProducts} onChange={(value) => updateSection("trendingProducts", value)} />
        <Toggle label="إظهار أحدث الإضافات" checked={rules.sections.latestAdditions} onChange={(value) => updateSection("latestAdditions", value)} />
        <Toggle label="إظهار العروض المميزة" checked={rules.sections.promotedOffers} onChange={(value) => updateSection("promotedOffers", value)} />
        <Toggle label="إظهار نافذة العروض" checked={rules.sections.seasonalOffers} onChange={(value) => updateSection("seasonalOffers", value)} />
        <Toggle label="إظهار الأجنحة" checked={rules.sections.featuredWings} onChange={(value) => updateSection("featuredWings", value)} />
        <Toggle label="إظهار إعلانات المول" checked={rules.sections.marketplaceAds} onChange={(value) => updateSection("marketplaceAds", value)} />
        <Toggle label="إظهار أدوات الخريطة والبحث الذكي" checked={rules.sections.smartMallShortcuts} onChange={(value) => updateSection("smartMallShortcuts", value)} />
      </RuleCard>

      <RuleCard title="المتاجر المميزة" description="حدد هل تظهر تلقائياً حسب الأداء، يدوياً، ممولة، أو مختلطة.">
        <ModeSelect value={rules.stores.mode} onChange={(mode) => setRules({ ...rules, stores: { ...rules.stores, mode } })} />
        <NumberField label="عدد المتاجر في الرئيسية" value={rules.stores.limit} onChange={(limit) => setRules({ ...rules, stores: { ...rules.stores, limit } })} />
        <IdsField label="معرفات متاجر يدوية" value={rules.stores.manualIds} onChange={(manualIds) => setRules({ ...rules, stores: { ...rules.stores, manualIds } })} />
        <IdsField label="روابط/أرقام متاجر يدوية" value={rules.stores.manualRefs || []} onChange={(manualRefs) => setRules({ ...rules, stores: { ...rules.stores, manualRefs } })} />
        <IdsField label="إخفاء متاجر من الرئيسية (ID أو رابط أو رقم متجر)" value={[...(rules.stores.excludedIds || []), ...(rules.stores.excludedRefs || [])]} onChange={(excludedRefs) => setRules({ ...rules, stores: { ...rules.stores, excludedRefs, excludedIds: [] } })} />
      </RuleCard>

      <RuleCard title="المنتجات المميزة والرائجة" description="لمنع الفوضى يمكن حصر الظهور في المنتجات الممولة فقط.">
        <ModeSelect value={rules.products.mode} onChange={(mode) => setRules({ ...rules, products: { ...rules.products, mode } })} />
        <NumberField label="عدد المنتجات" value={rules.products.limit} onChange={(limit) => setRules({ ...rules, products: { ...rules.products, limit } })} />
        <Toggle label="إظهار المنتجات الممولة فقط في الرئيسية" checked={rules.products.onlyPromotedInHomepage} onChange={(value) => setRules({ ...rules, products: { ...rules.products, onlyPromotedInHomepage: value } })} />
        <Toggle label="تفعيل قسم المنتجات الرائجة" checked={rules.products.showTrending} onChange={(value) => setRules({ ...rules, products: { ...rules.products, showTrending: value } })} />
        <IdsField label="معرفات منتجات يدوية" value={rules.products.manualIds} onChange={(manualIds) => setRules({ ...rules, products: { ...rules.products, manualIds } })} />
        <IdsField label="روابط/أكواد منتجات يدوية" value={rules.products.manualRefs || []} onChange={(manualRefs) => setRules({ ...rules, products: { ...rules.products, manualRefs } })} />
        <IdsField label="إخفاء منتجات من الرئيسية (ID أو رابط أو كود)" value={[...(rules.products.excludedIds || []), ...(rules.products.excludedRefs || [])]} onChange={(excludedRefs) => setRules({ ...rules, products: { ...rules.products, excludedRefs, excludedIds: [] } })} />
      </RuleCard>

      <RuleCard title="وصل حديثاً / أحدث الإضافات" description="لا تعرض الجديد عشوائياً؛ اجعله ممولاً أو من متاجر موثوقة أو عطّله.">
        <div className="space-y-2"><Label>طريقة العرض</Label><select value={rules.latestAdditions.mode} onChange={(e) => setRules({ ...rules, latestAdditions: { ...rules.latestAdditions, mode: e.target.value as HomeVisibilityRules["latestAdditions"]["mode"] } })} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="promoted_only">الممول فقط</option><option value="trusted_stores">متاجر موثوقة</option><option value="manual">يدوي</option><option value="disabled">تعطيل</option></select></div>
        <NumberField label="عدد العناصر" value={rules.latestAdditions.limit} onChange={(limit) => setRules({ ...rules, latestAdditions: { ...rules.latestAdditions, limit } })} />
        <Toggle label="تفعيل القسم" checked={rules.latestAdditions.enabled} onChange={(enabled) => setRules({ ...rules, latestAdditions: { ...rules.latestAdditions, enabled } })} />
        <IdsField label="معرفات منتجات يدوية" value={rules.latestAdditions.manualIds} onChange={(manualIds) => setRules({ ...rules, latestAdditions: { ...rules.latestAdditions, manualIds } })} />
      </RuleCard>

      <RuleCard title="دورات عرض الأجنحة" description="حدد عدد الأجنحة في كل دورة، ومدة ظهور المجموعة قبل الانتقال تلقائياً لمجموعة أخرى. جميع الأجنحة المؤهلة ستظهر بالتناوب دون ازدحام الواجهة.">
        <ModeSelect value={rules.wings.mode} onChange={(mode) => setRules({ ...rules, wings: { ...rules.wings, mode } })} />
        <NumberField label="عدد الأجنحة في كل دورة عرض" value={rules.wings.limit} min={1} onChange={(limit) => setRules({ ...rules, wings: { ...rules.wings, limit } })} />
        <NumberField label="مدة الدورة بالثواني" value={rules.wings.rotationIntervalSeconds} min={5} onChange={(rotationIntervalSeconds) => setRules({ ...rules, wings: { ...rules.wings, rotationIntervalSeconds } })} />
        <NumberField label="تمييز الجناح كجديد لمدة / يوم" value={rules.wings.newBadgeDays} min={1} onChange={(newBadgeDays) => setRules({ ...rules, wings: { ...rules.wings, newBadgeDays } })} />
        <Toggle label="تفعيل شريط الأجنحة المتحرك" checked={rules.wings.marqueeEnabled} onChange={(marqueeEnabled) => setRules({ ...rules, wings: { ...rules.wings, marqueeEnabled } })} />
        <IdsField label="معرفات أجنحة يدوية / اختيارية" value={rules.wings.manualIds} onChange={(manualIds) => setRules({ ...rules, wings: { ...rules.wings, manualIds } })} />
      </RuleCard>

      <RuleCard title="نافذة العروض" description="الرئيسية تعرض زر فقط، وصفحة العروض تعرض المعتمد من الإدارة.">
        <Toggle label="تفعيل نافذة العروض" checked={rules.offers.enabled} onChange={(enabled) => setRules({ ...rules, offers: { ...rules.offers, enabled } })} />
        <Toggle label="المعتمد فقط" checked={rules.offers.onlyApproved} onChange={(onlyApproved) => setRules({ ...rules, offers: { ...rules.offers, onlyApproved } })} />
        <Toggle label="الممول أولاً" checked={rules.offers.promotedFirst} onChange={(promotedFirst) => setRules({ ...rules, offers: { ...rules.offers, promotedFirst } })} />
        <NumberField label="عدد عروض صفحة العروض" value={rules.offers.limit} onChange={(limit) => setRules({ ...rules, offers: { ...rules.offers, limit } })} />
      </RuleCard>


      <RuleCard title="منع الاحتكار والتوزيع العادل" description="تحدد هذه القواعد سقف ظهور كل متجر/قاعة وتمنح المتاجر الجديدة فرصة عادلة دون سيطرة دائمة.">
        <NumberField label="أقصى منتجات لكل متجر" value={rules.fairness.maxProductsPerStore} min={1} onChange={(value) => setRules({ ...rules, fairness: { ...rules.fairness, maxProductsPerStore: value } })} />
        <NumberField label="أقصى عروض لكل متجر" value={rules.fairness.maxOffersPerStore} min={1} onChange={(value) => setRules({ ...rules, fairness: { ...rules.fairness, maxOffersPerStore: value } })} />
        <NumberField label="أقصى متاجر من نفس القاعة/الجناح" value={rules.fairness.maxStoresPerHall} min={1} onChange={(value) => setRules({ ...rules, fairness: { ...rules.fairness, maxStoresPerHall: value } })} />
        <NumberField label="تعزيز المتاجر الجديدة / يوم" value={rules.fairness.newStoreBoostDays} min={1} onChange={(value) => setRules({ ...rules, fairness: { ...rules.fairness, newStoreBoostDays: value } })} />
        <NumberField label="تجنب تكرار نفس المنتجات / يوم" value={rules.fairness.avoidProductRepeatDays} min={1} onChange={(value) => setRules({ ...rules, fairness: { ...rules.fairness, avoidProductRepeatDays: value } })} />
        <NumberField label="أقل اكتمال بيانات للمتجر %" value={rules.fairness.activeStoreMinimumCompleteness} min={0} onChange={(value) => setRules({ ...rules, fairness: { ...rules.fairness, activeStoreMinimumCompleteness: value } })} />
      </RuleCard>

      <RuleCard title="أوزان Ranking Score" description="عدّل أوزان العوامل التي تحدد ترتيب المتاجر والمنتجات. يمكن استخدام قيم سالبة لعوامل العقوبة مثل الإلغاء والشكاوى.">
        {Object.entries(rules.rankingWeights).map(([key, value]) => <NumberField key={key} label={rankingLabel(key)} value={Number(value)} min={-100} onChange={(next) => setRules({ ...rules, rankingWeights: { ...rules.rankingWeights, [key]: next } })} />)}
      </RuleCard>

      <RuleCard title="أنواع الظهور المدعومة" description="فعّل أو أوقف أنواع الاختيار لكل فئة دون تعديل الكود.">
        {(["stores", "products", "offers", "sections", "halls"] as const).map((target) => <div key={target} className="rounded-2xl border bg-slate-50 p-4 md:col-span-2"><h3 className="mb-3 font-black">{targetLabel(target)}</h3><div className="grid gap-2 md:grid-cols-3">{Object.entries(rules.appearanceTypes[target]).map(([key, value]) => <Toggle key={`${target}-${key}`} label={appearanceLabel(key)} checked={Boolean(value)} onChange={(checked) => setRules({ ...rules, appearanceTypes: { ...rules.appearanceTypes, [target]: { ...rules.appearanceTypes[target], [key]: checked } } })} />)}</div></div>)}
      </RuleCard>

      <RuleCard title="القواعد الموسمية والزمنية" description="تحكم في رمضان والأعياد والعودة للمدارس والشتاء والصيف، وكذلك عروض نهاية الأسبوع والمساء.">
        <Toggle label="رمضان" checked={rules.seasonalRules.ramadan} onChange={(value) => setRules({ ...rules, seasonalRules: { ...rules.seasonalRules, ramadan: value } })} />
        <Toggle label="الأعياد" checked={rules.seasonalRules.eid} onChange={(value) => setRules({ ...rules, seasonalRules: { ...rules.seasonalRules, eid: value } })} />
        <Toggle label="العودة إلى المدارس" checked={rules.seasonalRules.backToSchool} onChange={(value) => setRules({ ...rules, seasonalRules: { ...rules.seasonalRules, backToSchool: value } })} />
        <Toggle label="الشتاء" checked={rules.seasonalRules.winter} onChange={(value) => setRules({ ...rules, seasonalRules: { ...rules.seasonalRules, winter: value } })} />
        <Toggle label="الصيف" checked={rules.seasonalRules.summer} onChange={(value) => setRules({ ...rules, seasonalRules: { ...rules.seasonalRules, summer: value } })} />
        <NumberField label="قوة التعزيز الموسمي" value={rules.seasonalRules.seasonalBoost} min={0} onChange={(value) => setRules({ ...rules, seasonalRules: { ...rules.seasonalRules, seasonalBoost: value } })} />
        <Toggle label="عروض نهاية الأسبوع" checked={rules.timeRules.weekendOffers} onChange={(value) => setRules({ ...rules, timeRules: { ...rules.timeRules, weekendOffers: value } })} />
        <Toggle label="عروض المساء" checked={rules.timeRules.eveningOffers} onChange={(value) => setRules({ ...rules, timeRules: { ...rules.timeRules, eveningOffers: value } })} />
        <Toggle label="مناسبات خاصة" checked={rules.timeRules.specialOccasions} onChange={(value) => setRules({ ...rules, timeRules: { ...rules.timeRules, specialOccasions: value } })} />
        <NumberField label="بداية المساء" value={rules.timeRules.eveningStartHour} min={0} onChange={(value) => setRules({ ...rules, timeRules: { ...rules.timeRules, eveningStartHour: value } })} />
        <NumberField label="نهاية المساء" value={rules.timeRules.eveningEndHour} min={0} onChange={(value) => setRules({ ...rules, timeRules: { ...rules.timeRules, eveningEndHour: value } })} />
      </RuleCard>

      <RuleCard title="المحتوى المثبت" description="ثبّت متجر أو منتج أو عرض أو جناح لفترة محددة. ضع كل عنصر في سطر بصيغة: type:id:priority:startAt:endAt">
        <div className="space-y-2 md:col-span-2"><Label>العناصر المثبتة</Label><Textarea value={pinnedToText(rules.pinnedContent)} onChange={(e) => setRules({ ...rules, pinnedContent: textToPinned(e.target.value) })} placeholder="store:uuid:100:2026-07-01:2026-07-10" className="min-h-32" /></div>
      </RuleCard>

      <RuleCard title="محاكي الواجهة الرئيسية" description="اعرف لماذا ظهر عنصر أو لماذا تم إخفاؤه وما القواعد المؤثرة عليه.">
        <form onSubmit={simulate} className="grid gap-3 md:col-span-2 md:grid-cols-[180px_1fr_auto]"><select name="type" className="h-11 rounded-xl border bg-white px-4 text-sm"><option value="store">متجر</option><option value="product">منتج</option><option value="offer">عرض</option><option value="wing">جناح</option></select><Input name="id" placeholder="ID" /><Button type="submit">تشغيل المحاكاة</Button></form>
        {simulation ? <pre className="max-h-80 overflow-auto rounded-2xl bg-slate-950 p-4 text-left text-xs text-slate-50 md:col-span-2">{JSON.stringify(simulation, null, 2)}</pre> : null}
      </RuleCard>
      <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-2xl border bg-white/95 p-4 shadow-soft backdrop-blur">
        <Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ قواعد الظهور"}</Button>
        <Button type="button" variant="secondary" disabled={loading} onClick={recalculate}>إعادة حساب ترتيب الصفحة الرئيسية</Button>
        {message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}
      </div>
    </form>
  );
}

function RuleCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section className="rounded-3xl border bg-white p-6 shadow-card"><h2 className="text-xl font-black">{title}</h2><p className="mt-2 text-sm leading-7 text-slate-500">{description}</p><div className="mt-5 grid gap-4 md:grid-cols-2">{children}</div></section>; }
function ModeSelect({ value, onChange }: { value: VisibilityMode; onChange: (mode: VisibilityMode) => void }) { return <div className="space-y-2"><Label>طريقة الاختيار</Label><select value={value} onChange={(e) => onChange(e.target.value as VisibilityMode)} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="automatic">تلقائي</option><option value="manual">يدوي</option><option value="mixed">مختلط</option><option value="promoted">ممول فقط</option></select></div>; }
function NumberField({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (value: number) => void; min?: number }) { return <div className="space-y-2"><Label>{label}</Label><Input type="number" min={min} value={value} onChange={(e) => onChange(Number(e.target.value || min))} /></div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2 rounded-xl border bg-slate-50 px-4 py-3 text-sm font-bold"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>; }
function IdsField({ label, value, onChange }: { label: string; value: string[]; onChange: (ids: string[]) => void }) { return <div className="space-y-2 md:col-span-2"><Label>{label}</Label><Textarea value={idsToText(value)} onChange={(e) => onChange(textToIds(e.target.value))} placeholder="ضع ID في كل سطر" /></div>; }

function rankingLabel(key: string) { return ({ sales: "المبيعات", ratings: "التقييمات", preparationSpeed: "سرعة التجهيز", activity: "النشاط", dataQuality: "جودة البيانات", cancellationRate: "معدل الإلغاء", complaints: "الشكاوى", freshness: "الحداثة", views: "المشاهدات", promoted: "الإعلانات" } as Record<string,string>)[key] || key; }
function appearanceLabel(key: string) { return ({ bestSelling: "الأكثر مبيعاً", topRated: "الأعلى تقييماً", newest: "الأحدث إضافة", mostViewed: "الأكثر مشاهدة", activeOffers: "العروض النشطة", seasonal: "موسمي", promoted: "مدعوم إعلانياً", manual: "يدوي", smartRecommendations: "توصيات ذكية" } as Record<string,string>)[key] || key; }
function targetLabel(key: string) { return ({ stores: "المتاجر", products: "المنتجات", offers: "العروض", sections: "الأقسام", halls: "القاعات/الأجنحة" } as Record<string,string>)[key] || key; }
function pinnedToText(items: HomeVisibilityRules["pinnedContent"]) { return items.map((item) => `${item.type}:${item.id}:${item.priority || 100}:${item.startsAt || ""}:${item.endsAt || ""}:${item.enabled === false ? "off" : "on"}`).join("\n"); }
function textToPinned(value: string): HomeVisibilityRules["pinnedContent"] { return value.split(/\n/).map((line) => line.trim()).filter(Boolean).map((line) => { const [type, id, priority, startsAt, endsAt, enabled] = line.split(":"); return { type: (type || "product") as any, id: id || "", priority: Number(priority || 100), startsAt: startsAt || null, endsAt: endsAt || null, enabled: enabled !== "off" }; }).filter((item) => item.id); }
