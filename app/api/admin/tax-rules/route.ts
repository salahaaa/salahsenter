export const dynamic = "force-dynamic";

import { asc } from "drizzle-orm";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, taxRules } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
const schema = z.object({ name: z.string().min(2), code: z.string().min(2), rate: z.coerce.number().min(0).default(0), includedInPrice: z.boolean().default(false), countryId: z.string().uuid().optional().nullable(), governorateId: z.string().uuid().optional().nullable(), priority: z.coerce.number().int().default(0), isActive: z.boolean().default(true), config: z.record(z.unknown()).default({}) });
export async function GET() { try { const session = await requireAuth(); await assertAdmin(session, "taxes.manage"); const items = await db.select().from(taxRules).orderBy(asc(taxRules.priority), asc(taxRules.name)); return ok({ rules: items }); } catch (error) { return handleApiError(error, "تعذر تحميل قواعد الضرائب"); } }
export async function POST(request: Request) { try { const session = await requireAuth(); await assertAdmin(session, "taxes.manage"); const payload = schema.parse(await request.json()); const [rule] = await db.insert(taxRules).values({ ...payload, rate: payload.rate.toString() }).returning(); await writeAuditLog({ actorId: session.userId, action: "create", entityType: "tax_rule", entityId: rule.id, afterData: rule }); return created({ rule, message: "تم حفظ قاعدة الضريبة" }); } catch (error) { return handleApiError(error, "تعذر حفظ قاعدة الضريبة"); } }
