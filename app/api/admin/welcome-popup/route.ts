export const dynamic = "force-dynamic";

import { z } from "zod";
import { optionalUrlOrPathSchema, requiredUrlOrPathSchema } from "@/lib/validators";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, systemSettings } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { getWelcomePopupSettings } from "@/lib/welcome-popup";
import { writeAuditLog } from "@/lib/audit";

const welcomePopupSchema = z.object({
  enabled: z.boolean().default(true),
  showOnce: z.boolean().default(true),
  delayMs: z.coerce.number().int().min(0).max(30000).default(700),
  imageUrl: optionalUrlOrPathSchema,
  badgeText: z.string().default(""),
  title: z.string().min(1),
  message: z.string().default(""),
  couponCode: z.string().default(""),
  buttonText: z.string().default("ابدأ التسوق"),
  buttonUrl: z.string().default("/"),
  closeOnBackdrop: z.boolean().default(true)
});

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "home.manage");
    return ok({ settings: await getWelcomePopupSettings() });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل إعدادات الواجهة الترحيبية");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "home.manage");
    const payload = welcomePopupSchema.parse(await request.json());
    const [setting] = await db
      .insert(systemSettings)
      .values({ group: "homepage", key: "welcome_popup", value: payload, isPublic: true, updatedBy: session.userId })
      .onConflictDoUpdate({
        target: [systemSettings.group, systemSettings.key],
        set: { value: payload, isPublic: true, updatedBy: session.userId, updatedAt: new Date() }
      })
      .returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "welcome_popup", entityId: "homepage", afterData: setting });
    return ok({ settings: payload, message: "تم حفظ الواجهة الترحيبية بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ الواجهة الترحيبية");
  }
}
