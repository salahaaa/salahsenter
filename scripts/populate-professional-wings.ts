import "dotenv/config";
import { eq, like, sql } from "drizzle-orm";
import { client, db, wings } from "@/lib/db";

const professionalWings = [
  {
    slug: "electronics",
    name: "جناح الإلكترونيات والأجهزة الذكية",
    description: "أحدث الهواتف الذكية، أجهزة الكمبيوتر المحمولة، الشاشات، وملحقات التقنية المتقدمة من أشهر الماركات العالمية",
    iconUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80",
    heroImageUrl: "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=1200&q=80",
    desktopImageUrl: "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=1200&q=80",
    mobileImageUrl: "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=800&q=80",
    activityTemplateKey: "electronics",
    isActive: true,
    sortOrder: 1
  },
  {
    slug: "fashion",
    name: "جناح الملابس والأزياء الفاخرة",
    description: "تشكيلات راقية من الأزياء الرجالية والنسائية، الأحذية، والحقائب من أحدث صيحات الموضة والماركات العالمية",
    iconUrl: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=400&q=80",
    heroImageUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80",
    desktopImageUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80",
    mobileImageUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
    activityTemplateKey: "fashion",
    isActive: true,
    sortOrder: 2
  },
  {
    slug: "solar-energy",
    name: "جناح الطاقة الشمسية والحلول الذكية",
    description: "ألواح شمسية عالية الكفاءة، بطاريات أنبوبية وليثيوم، انفرترات، ومنظمات شحن بضمانات معتمدة",
    iconUrl: "https://images.unsplash.com/photo-1509391365360-fa0ba1f57e50?auto=format&fit=crop&w=400&q=80",
    heroImageUrl: "https://images.unsplash.com/photo-1509391365360-fa0ba1f57e50?auto=format&fit=crop&w=1200&q=80",
    desktopImageUrl: "https://images.unsplash.com/photo-1509391365360-fa0ba1f57e50?auto=format&fit=crop&w=1200&q=80",
    mobileImageUrl: "https://images.unsplash.com/photo-1509391365360-fa0ba1f57e50?auto=format&fit=crop&w=800&q=80",
    activityTemplateKey: "solar-energy",
    isActive: true,
    sortOrder: 3
  },
  {
    slug: "grocery",
    name: "جناح السوبرماركت والمواد الغذائية",
    description: "مواد غذائية طازجة، معلبات، منتجات استهلاكية يومية، ومستلزمات الأسرة بأسعار الجملة",
    iconUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80",
    heroImageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
    desktopImageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
    mobileImageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80",
    activityTemplateKey: "grocery",
    isActive: true,
    sortOrder: 4
  },
  {
    slug: "pharmacy",
    name: "جناح الصيدليات والرعاية الصحية",
    description: "أدوية ومستحضرات طبية أصلية، مكملات غذائية، ومعدات رعاية منزلية تحت إشراف صيدلاني معتمد",
    iconUrl: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=400&q=80",
    heroImageUrl: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80",
    desktopImageUrl: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80",
    mobileImageUrl: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=800&q=80",
    activityTemplateKey: "pharmacy",
    isActive: true,
    sortOrder: 5
  },
  {
    slug: "restaurant",
    name: "جناح المطاعم والكافيهات الراقية",
    description: "أشهى الوجبات العربية والغربية، مشاوي، حلويات، ومشروبات مختصة من أرقى المطاعم والكافيهات",
    iconUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80",
    heroImageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    desktopImageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    mobileImageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
    activityTemplateKey: "restaurant",
    isActive: true,
    sortOrder: 6
  },
  {
    slug: "hardware-building",
    name: "جناح مواد البناء والتشطيبات الحديثة",
    description: "سيراميك، صحيات، إضاءات، دهانات، وأدوات بناء احترافية من كبرى المصانع والوكالات",
    iconUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=400&q=80",
    heroImageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80",
    desktopImageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80",
    mobileImageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80",
    activityTemplateKey: "hardware-building",
    isActive: true,
    sortOrder: 7
  },
  {
    slug: "beauty-perfume",
    name: "جناح العطور ومستحضرات التجميل",
    description: "عطور شرقية وفرنسية أصلية، بخور، ومستحضرات عناية بالبشرة والشعر من أشهر البراندات العالمية",
    iconUrl: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=400&q=80",
    heroImageUrl: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=1200&q=80",
    desktopImageUrl: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=1200&q=80",
    mobileImageUrl: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80",
    activityTemplateKey: "fashion",
    isActive: true,
    sortOrder: 8
  }
];

async function run() {
  console.log("1. Cleaning up E2E temporary test wings...");
  await db.delete(wings).where(like(wings.name, "E2E-%"));

  console.log("2. Upserting 8 Professional Luxury Wings with CDN images...");
  for (const wing of professionalWings) {
    await db
      .insert(wings)
      .values(wing)
      .onConflictDoUpdate({
        target: [wings.slug],
        set: {
          name: wing.name,
          description: wing.description,
          iconUrl: wing.iconUrl,
          heroImageUrl: wing.heroImageUrl,
          desktopImageUrl: wing.desktopImageUrl,
          mobileImageUrl: wing.mobileImageUrl,
          activityTemplateKey: wing.activityTemplateKey,
          isActive: wing.isActive,
          sortOrder: wing.sortOrder,
          updatedAt: new Date()
        }
      });
  }

  console.log("3. Deleting any duplicate/empty legacy wings that do not match the professional 8 slugs...");
  const validSlugs = professionalWings.map(w => w.slug);
  const allWings = await db.select().from(wings);
  for (const w of allWings) {
    if (!validSlugs.includes(w.slug)) {
      await db.delete(wings).where(eq(wings.id, w.id));
    }
  }

  console.log("4. Verifying final Wings list in Neon database:");
  const finalWings = await db.select().from(wings).orderBy(wings.sortOrder);
  for (const w of finalWings) {
    console.log(`[#${w.sortOrder}] ${w.name} (${w.slug}) — Active: ${w.isActive}`);
    console.log(`     Icon: ${w.iconUrl?.slice(0, 45)}...`);
  }
  console.log(`\nSUCCESS: Exactly ${finalWings.length} professional wings configured!`);
}

run().catch(e => {
  console.error("Error populating wings:", e);
  process.exit(1);
}).finally(() => {
  client.end({ timeout: 5 }).catch(() => undefined);
});
