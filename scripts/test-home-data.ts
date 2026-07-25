import { config } from "dotenv";
config();
import { getHomeData } from "@/lib/db/queries";
async function run() {
  try {
    const data = await getHomeData();
    const ann = (data as any).marketplaceAnnouncements || [];
    console.log("getHomeData OK. marketplaceAnnouncements:", ann.length);
    const merchantAds = ann.filter((a: any) => a.isMerchantAd);
    console.log("merchant ads in stream:", merchantAds.length);
    if (merchantAds.length) console.log("first merchant ad title:", merchantAds[0].title);
  } catch (e: any) {
    console.error("getHomeData THREW:", e.message);
    console.error((e.stack || "").slice(0, 600));
  }
}
run();
