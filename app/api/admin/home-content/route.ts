export const dynamic = "force-dynamic";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, systemSettings } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { defaultHomeContent, getHomeContentSettings, invalidateHomeContentSettingsCache } from "@/lib/home-content";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

function revalidatePublicPages() {
  revalidatePath("/");
  revalidatePath("/wings");
}

const homeContentSchema = z.object(
  Object.fromEntries(Object.keys(defaultHomeContent).map((key) => [key, z.string().default("")])) as Record<keyof typeof defaultHomeContent, z.ZodDefault<z.ZodString>>
);

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "home.manage");
    revalidatePublicPages();
    return ok({ content: await getHomeContentSettings() });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل محتوى الواجهة الرئيسية");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "home.manage");
    const payload = homeContentSchema.parse(await request.json());
    const [setting] = await db
      .insert(systemSettings)
      .values({ group: "homepage", key: "content", value: payload, isPublic: true, updatedBy: session.userId })
      .onConflictDoUpdate({
        target: [systemSettings.group, systemSettings.key],
        set: { value: payload, isPublic: true, updatedBy: session.userId, updatedAt: new Date() }
      })
      .returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "homepage_content", entityId: "content", afterData: setting });
    invalidateHomeContentSettingsCache();
    revalidatePublicPages();
    return ok({ content: payload, message: "تم حفظ محتوى الواجهة الرئيسية بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ محتوى الواجهة الرئيسية");
  }
}
