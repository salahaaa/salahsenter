export const dynamic = "force-dynamic";

import { desc, eq, and } from "drizzle-orm";
import { handleApiError, ok } from "@/lib/api";
import { cities, countries, db, governorates, stores } from "@/lib/db";

export async function GET() {
  try {
    const items = await db
      .select({
        id: stores.id,
        name: stores.name,
        slug: stores.slug,
        coverImageUrl: stores.coverImageUrl,
        logoUrl: stores.logoUrl,
        ratingAverage: stores.ratingAverage,
        orderCount: stores.orderCount,
        countryName: countries.name,
        governorateName: governorates.name,
        cityName: cities.name
      })
      .from(stores)
      .leftJoin(countries, eq(stores.countryId, countries.id))
      .leftJoin(governorates, eq(stores.governorateId, governorates.id))
      .leftJoin(cities, eq(stores.cityId, cities.id))
      .where(and(eq(stores.status, "active"), eq(stores.isActive, true)))
      .orderBy(desc(stores.createdAt))
      .limit(50);

    return ok({ stores: items });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل المتاجر");
  }
}
