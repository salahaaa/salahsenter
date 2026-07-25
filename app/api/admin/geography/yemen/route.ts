export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { ok, handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { cities, countries, db, governorates } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

const yemenGovernorates = [
  "أمانة العاصمة",
  "صنعاء",
  "عدن",
  "تعز",
  "إب",
  "الحديدة",
  "حضرموت",
  "ذمار",
  "عمران",
  "حجة",
  "المحويت",
  "ريمة",
  "صعدة",
  "البيضاء",
  "الضالع",
  "لحج",
  "أبين",
  "شبوة",
  "المهرة",
  "مأرب",
  "الجوف",
  "سقطرى"
];

const mainCities: Record<string, string[]> = {
  "أمانة العاصمة": ["صنعاء"],
  "صنعاء": ["سنحان", "همدان", "بني حشيش"],
  "عدن": ["كريتر", "المنصورة", "خور مكسر", "الشيخ عثمان"],
  "تعز": ["مدينة تعز", "التربة", "المخا"],
  "إب": ["مدينة إب", "يريم", "العدين"],
  "الحديدة": ["مدينة الحديدة", "زبيد", "بيت الفقيه"],
  "حضرموت": ["المكلا", "سيئون", "تريم"],
  "ذمار": ["مدينة ذمار", "معبر", "عنس"],
  "عمران": ["مدينة عمران", "خمر", "حوث"],
  "حجة": ["مدينة حجة", "عبس", "حرض"],
  "المحويت": ["مدينة المحويت", "شبام كوكبان"],
  "ريمة": ["الجبين", "كسمة"],
  "صعدة": ["مدينة صعدة", "رازح"],
  "البيضاء": ["مدينة البيضاء", "رداع"],
  "الضالع": ["مدينة الضالع", "دمت"],
  "لحج": ["الحوطة", "تبن"],
  "أبين": ["زنجبار", "جعار"],
  "شبوة": ["عتق", "بيحان"],
  "المهرة": ["الغيضة", "قشن"],
  "مأرب": ["مدينة مأرب", "صرواح"],
  "الجوف": ["الحزم", "خب والشعف"],
  "سقطرى": ["حديبو", "قلنسية"]
};

export async function POST() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "geography.manage");
    const result = await db.transaction(async (tx) => {
      let [country] = await tx.select().from(countries).where(eq(countries.name, "اليمن")).limit(1);
      if (!country) {
        [country] = await tx.insert(countries).values({ name: "اليمن", iso2: "YE", phoneCode: "+967", sortOrder: 1, isActive: true }).returning();
      } else {
        [country] = await tx.update(countries).set({ iso2: country.iso2 || "YE", phoneCode: country.phoneCode || "+967", isActive: true, sortOrder: country.sortOrder || 1 }).where(eq(countries.id, country.id)).returning();
      }

      let governoratesCreated = 0;
      let citiesCreated = 0;
      for (const [index, name] of yemenGovernorates.entries()) {
        let [governorate] = await tx.select().from(governorates).where(eq(governorates.name, name)).limit(1);
        if (!governorate) {
          [governorate] = await tx.insert(governorates).values({ countryId: country.id, name, sortOrder: index + 1, isActive: true }).returning();
          governoratesCreated += 1;
        } else {
          [governorate] = await tx.update(governorates).set({ countryId: country.id, isActive: true, sortOrder: governorate.sortOrder || index + 1 }).where(eq(governorates.id, governorate.id)).returning();
        }

        for (const [cityIndex, cityName] of (mainCities[name] || []).entries()) {
          const existing = await tx.select({ id: cities.id }).from(cities).where(eq(cities.name, cityName)).limit(1);
          if (!existing.length) {
            await tx.insert(cities).values({ governorateId: governorate.id, name: cityName, sortOrder: cityIndex + 1, isActive: true });
            citiesCreated += 1;
          }
        }
      }
      return { countryId: country.id, governoratesTotal: yemenGovernorates.length, governoratesCreated, citiesCreated };
    });
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "geography_yemen_seed", entityId: result.countryId, afterData: result });
    return ok({ ...result, message: "تم تجهيز محافظات اليمن والمدن الرئيسية بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر تجهيز محافظات اليمن");
  }
}
