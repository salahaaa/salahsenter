export const revalidate = 120;

import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { SmartMallMapWorkspace } from "@/components/home/smart-mall-experience";
import { getHomeData } from "@/lib/db/queries";

type AnyRecord = Record<string, any>;

export default async function SmartMapPage() {
  const data = await getHomeData();
  const stores = uniqueRecordsById([...(data.trendingStores || []), ...(data.latestStores || [])]);
  const products = uniqueRecordsById([...(data.trendingProducts || []), ...(data.latestAdditions || []), ...(data.promotedOffers || [])]);

  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      <SmartMallMapWorkspace wings={data.wings || []} stores={stores} products={products} offers={data.seasonalOffers || []} />
      <Footer />
    </main>
  );
}

function uniqueRecordsById(items: AnyRecord[]) {
  const seen = new Set<string>();
  return items.filter((item, index) => {
    const key = String(item.id || item.slug || `item-${index}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
