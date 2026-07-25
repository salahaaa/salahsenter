export const dynamic = "force-dynamic";

import { asc } from "drizzle-orm";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, shippingMethods } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
const schema = z.object({ name: z.string().min(2), code: z.string().min(2), description: z.string().optional(), fee: z.coerce.number().min(0).default(0), estimatedDaysMin: z.coerce.number().int().min(0).default(1), estimatedDaysMax: z.coerce.number().int().min(0).default(3), coverageConfig: z.record(z.unknown()).default({}), isActive: z.boolean().default(true), sortOrder: z.coerce.number().int().default(0) });
export async function GET() { try { const session = await requireAuth(); await assertAdmin(session, "shipping.manage"); const items = await db.select().from(shippingMethods).orderBy(asc(shippingMethods.sortOrder), asc(shippingMethods.name)); return ok({ shippingMethods: items }); } catch (error) { return handleApiError(error, "تعذر تحميل وسائل الشحن"); } }
export async function POST(request: Request) { try { const session = await requireAuth(); await assertAdmin(session, "shipping.manage"); const payload = schema.parse(await request.json()); const [item] = await db.insert(shippingMethods).values({ ...payload, fee: payload.fee.toString() }).returning(); await writeAuditLog({ actorId: session.userId, action: "create", entityType: "shipping_method", entityId: item.id, afterData: item }); return created({ shippingMethod: item, message: "تم حفظ وسيلة الشحن بنجاح" }); } catch (error) { return handleApiError(error, "تعذر حفظ وسيلة الشحن"); } }
