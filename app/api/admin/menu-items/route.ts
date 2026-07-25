export const dynamic = "force-dynamic";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, menuItems } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const createSchema = z.object({ menuKey: z.string().default("main"), parentId: z.string().uuid().optional().nullable(), title: z.string().min(2), url: z.string().min(1), icon: z.string().optional(), target: z.enum(["_self", "_blank"]).default("_self"), isVisible: z.boolean().default(true), sortOrder: z.coerce.number().int().default(0), config: z.record(z.unknown()).default({}) });
const patchSchema = createSchema.partial().extend({ id: z.string().uuid() });

export async function GET() { try { const session = await requireAuth(); await assertAdmin(session, "home.manage"); const items = await db.select().from(menuItems).orderBy(asc(menuItems.menuKey), asc(menuItems.sortOrder)); return ok({ menuItems: items }); } catch (error) { return handleApiError(error, "تعذر تحميل القوائم"); } }
export async function POST(request: Request) { try { const session = await requireAuth(); await assertAdmin(session, "home.manage"); const payload = createSchema.parse(await request.json()); const [item] = await db.insert(menuItems).values(payload).returning(); await writeAuditLog({ actorId: session.userId, action: "create", entityType: "menu_item", entityId: item.id, afterData: item }); return created({ menuItem: item, message: "تم حفظ عنصر القائمة" }); } catch (error) { return handleApiError(error, "تعذر حفظ عنصر القائمة"); } }
export async function PATCH(request: Request) { try { const session = await requireAuth(); await assertAdmin(session, "home.manage"); const payload = patchSchema.parse(await request.json()); const [before] = await db.select().from(menuItems).where(eq(menuItems.id, payload.id)).limit(1); if (!before) return fail("عنصر القائمة غير موجود", 404); const { id, ...updates } = payload; const [item] = await db.update(menuItems).set({ ...updates, updatedAt: new Date() }).where(eq(menuItems.id, id)).returning(); await writeAuditLog({ actorId: session.userId, action: "update", entityType: "menu_item", entityId: id, beforeData: before, afterData: item }); return ok({ menuItem: item, message: "تم تعديل عنصر القائمة" }); } catch (error) { return handleApiError(error, "تعذر تعديل عنصر القائمة"); } }
export async function DELETE(request: Request) { try { const session = await requireAuth(); await assertAdmin(session, "home.manage"); const id = new URL(request.url).searchParams.get("id") || ""; const [before] = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1); if (!before) return fail("عنصر القائمة غير موجود", 404); await db.delete(menuItems).where(eq(menuItems.id, id)); await writeAuditLog({ actorId: session.userId, action: "delete", entityType: "menu_item", entityId: id, beforeData: before }); return ok({ message: "تم حذف عنصر القائمة" }); } catch (error) { return handleApiError(error, "تعذر حذف عنصر القائمة"); } }
