export const dynamic = "force-dynamic";

import { asc } from "drizzle-orm";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { commissionRules, db } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
const schema = z.object({ name: z.string().min(2), code: z.string().min(2), scope: z.string().default("platform"), wingId: z.string().uuid().optional().nullable(), storeId: z.string().uuid().optional().nullable(), rate: z.coerce.number().min(0).default(0), fixedFee: z.coerce.number().min(0).default(0), priority: z.coerce.number().int().default(0), isActive: z.boolean().default(true), config: z.record(z.unknown()).default({}) });
export async function GET() { try { const session = await requireAuth(); await assertAdmin(session, "commissions.manage"); const items = await db.select().from(commissionRules).orderBy(asc(commissionRules.priority), asc(commissionRules.name)); return ok({ rules: items }); } catch (error) { return handleApiError(error, "تعذر تحميل قواعد العمولات"); } }
export async function POST(request: Request) { try { const session = await requireAuth(); await assertAdmin(session, "commissions.manage"); const payload = schema.parse(await request.json()); const [rule] = await db.insert(commissionRules).values({ ...payload, rate: payload.rate.toString(), fixedFee: payload.fixedFee.toString() }).returning(); await writeAuditLog({ actorId: session.userId, action: "create", entityType: "commission_rule", entityId: rule.id, afterData: rule }); return created({ rule, message: "تم حفظ قاعدة العمولة" }); } catch (error) { return handleApiError(error, "تعذر حفظ قاعدة العمولة"); } }
