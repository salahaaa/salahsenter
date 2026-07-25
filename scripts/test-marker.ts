import { config } from "dotenv";
config();
import { getHomeData } from "@/lib/db/queries";
async function run() {
  const data = await getHomeData() as any;
  const ann = data.marketplaceAnnouncements || [];
  const found = ann.find((a:any) => JSON.stringify(a).includes("MK1782697610170"));
  console.log("total announcements:", ann.length);
  console.log("marker found in announcements:", found ? "YES" : "NO");
  if (found) console.log("title:", found.title, "| isMerchantAd:", found.isMerchantAd);
}
run();
