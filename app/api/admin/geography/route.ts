export const dynamic = "force-dynamic";

import { asc } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { cities, countries, db, districts, governorates } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const geographySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("country"), name: z.string().min(2), iso2: z.string().max(2).optional(), phoneCode: z.string().optional(), sortOrder: z.coerce.number().int().default(0), isActive: z.boolean().default(true) }),
  z.object({ kind: z.literal("governorate"), countryId: z.string().uuid(), name: z.string().min(2), sortOrder: z.coerce.number().int().default(0), isActive: z.boolean().default(true) }),
  z.object({ kind: z.literal("city"), governorateId: z.string().uuid(), name: z.string().min(2), latitude: z.coerce.number().optional(), longitude: z.coerce.number().optional(), sortOrder: z.coerce.number().int().default(0), isActive: z.boolean().default(true) }),
  z.object({ kind: z.literal("district"), cityId: z.string().uuid(), name: z.string().min(2), latitude: z.coerce.number().optional(), longitude: z.coerce.number().optional(), sortOrder: z.coerce.number().int().default(0), isActive: z.boolean().default(true) })
]);

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "geography.manage");
    const [countryItems, governorateItems, cityItems, districtItems] = await Promise.all([
      db.select().from(countries).orderBy(asc(countries.sortOrder), asc(countries.name)),
      db.select().from(governorates).orderBy(asc(governorates.sortOrder), asc(governorates.name)),
      db.select().from(cities).orderBy(asc(cities.sortOrder), asc(cities.name)),
      db.select().from(districts).orderBy(asc(districts.sortOrder), asc(districts.name))
    ]);
    return ok({ countries: countryItems, governorates: governorateItems, cities: cityItems, districts: districtItems });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل المناطق الجغرافية");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "geography.manage");
    const payload = geographySchema.parse(await request.json());

    if (payload.kind === "country") {
      const [country] = await db.insert(countries).values({ name: payload.name, iso2: payload.iso2, phoneCode: payload.phoneCode, sortOrder: payload.sortOrder, isActive: payload.isActive }).onConflictDoUpdate({ target: countries.name, set: { iso2: payload.iso2, phoneCode: payload.phoneCode, sortOrder: payload.sortOrder, isActive: payload.isActive } }).returning();
      await writeAuditLog({ actorId: session.userId, action: "create", entityType: "country", entityId: country.id, afterData: country });
      return created({ item: country, message: "تم حفظ الدولة بنجاح" });
    }
    if (payload.kind === "governorate") {
      const [governorate] = await db.insert(governorates).values({ countryId: payload.countryId, name: payload.name, sortOrder: payload.sortOrder, isActive: payload.isActive }).onConflictDoUpdate({ target: [governorates.countryId, governorates.name], set: { sortOrder: payload.sortOrder, isActive: payload.isActive } }).returning();
      await writeAuditLog({ actorId: session.userId, action: "create", entityType: "governorate", entityId: governorate.id, afterData: governorate });
      return created({ item: governorate, message: "تم حفظ المحافظة بنجاح" });
    }
    if (payload.kind === "city") {
      const [city] = await db.insert(cities).values({ governorateId: payload.governorateId, name: payload.name, latitude: payload.latitude?.toString(), longitude: payload.longitude?.toString(), sortOrder: payload.sortOrder, isActive: payload.isActive }).onConflictDoUpdate({ target: [cities.governorateId, cities.name], set: { latitude: payload.latitude?.toString(), longitude: payload.longitude?.toString(), sortOrder: payload.sortOrder, isActive: payload.isActive } }).returning();
      await writeAuditLog({ actorId: session.userId, action: "create", entityType: "city", entityId: city.id, afterData: city });
      return created({ item: city, message: "تم حفظ المدينة بنجاح" });
    }
    if (payload.kind === "district") {
      const [district] = await db.insert(districts).values({ cityId: payload.cityId, name: payload.name, latitude: payload.latitude?.toString(), longitude: payload.longitude?.toString(), sortOrder: payload.sortOrder, isActive: payload.isActive }).onConflictDoUpdate({ target: [districts.cityId, districts.name], set: { latitude: payload.latitude?.toString(), longitude: payload.longitude?.toString(), sortOrder: payload.sortOrder, isActive: payload.isActive } }).returning();
      await writeAuditLog({ actorId: session.userId, action: "create", entityType: "district", entityId: district.id, afterData: district });
      return created({ item: district, message: "تم حفظ المنطقة بنجاح" });
    }

    return fail("نوع غير مدعوم", 400);
  } catch (error) {
    return handleApiError(error, "تعذر حفظ المنطقة الجغرافية");
  }
}
