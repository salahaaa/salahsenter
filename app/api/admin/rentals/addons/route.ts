export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db, rentalAddons } from "@/lib/db";
import { assignRentalAddon } from "@/lib/rentals/service";
import { assertAdmin } from "@/lib/rbac";
import { RENTAL_LIMIT_KEYS } from "@/lib/rentals/entitlements";

const addonMetadataSchema = z.object({
  limitKey: z.enum(RENTAL_LIMIT_KEYS).optional(),
  limitIncrease: z.coerce.number().int().min(0).max(1_000_000).optional(),
  unlimited: z.boolean().optional(),
  features: z.array(z.string().trim().min(2).max(120)).max(30).optional()
}).catchall(z.unknown());
const createSchema = z.object({ code: z.string().trim().min(2).max(120), name: z.string().trim().min(2).max(180), description: z.string().max(2_000).optional(), entitlementKey: z.string().trim().min(2).max(120), price: z.coerce.number().min(0), billingCycle: z.enum(["monthly", "quarterly", "semi_annual", "annual"]).default("monthly"), metadata: addonMetadataSchema.default({}) });
const assignSchema = z.object({ agreementId: z.string().uuid(), addonId: z.string().uuid(), quantity: z.coerce.number().int().positive().max(100).default(1), unitPrice: z.coerce.number().min(0).optional() });

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "contracts.manage");
    return ok({ addons: await db.select().from(rentalAddons).orderBy(desc(rentalAddons.createdAt)) });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل إضافات الإيجار");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "contracts.manage");
    const raw = await request.json();
    if (raw.action === "assign") {
      const payload = assignSchema.parse(raw);
      const result = await assignRentalAddon({ ...payload, actorId: session.userId });
      await writeAuditLog({ actorId: session.userId, action: "create", category: "financial", entityType: "rental.addon_assigned", entityId: result.assignment.id, afterData: result });
      return created({ ...result, message: "تم تفعيل الإضافة للمتجر" });
    }
    const payload = createSchema.parse(raw);
    const [addon] = await db.insert(rentalAddons).values({ ...payload, price: payload.price.toString() }).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", category: "administrative", entityType: "rental.addon_created", entityId: addon.id, afterData: addon });
    return created({ addon, message: "تم إنشاء الإضافة المدفوعة" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ إضافة الإيجار");
  }
}
