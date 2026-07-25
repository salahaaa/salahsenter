import { config } from "dotenv";
config();
import { getHomepageApprovedMerchantBanners } from "@/lib/home-visibility";
async function run() {
  try {
    const banners = await getHomepageApprovedMerchantBanners(new Date());
    console.log("RESULT: found", banners.length, "banners");
    if (banners.length) console.log("first:", JSON.stringify(banners[0]).slice(0, 400));
  } catch (e: any) {
    console.error("FUNCTION THREW:", e.message);
    console.error((e.stack || "").slice(0, 500));
  }
}
run();
