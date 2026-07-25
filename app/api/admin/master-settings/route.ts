export const dynamic = "force-dynamic";

import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { getMasterSettings, getMasterSettingsVersions, masterSettingsSchema, publishMasterSettings, rollbackMasterSettings, saveMasterSettingsDraft } from "@/lib/master-settings";
import { writeAuditLog } from "@/lib/audit";

const publishSchema = z.object({ action: z.enum(["draft", "publish"]), settings: masterSettingsSchema, reason: z.string().trim().max(1_500).optional().nullable(), basedOnVersionId: z.string().uuid().optional().nullable() });
const rollbackSchema = z.object({ action: z.literal("rollback"), versionId: z.string().uuid(), reason: z.string().trim().max(1_500).optional().nullable() });

export async function GET() {
  try {
    const session = await requireAuth(); await assertAdmin(session, "master.manage");
    const [settings, versions] = await Promise.all([getMasterSettings(), getMasterSettingsVersions()]);
    return ok({ settings, versions });
  } catch (error) { return handleApiError(error, "تعذر تحميل حوكمة النظام المركزية"); }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth(); await assertAdmin(session, "master.manage");
    const raw = await request.json(); const rollback = rollbackSchema.safeParse(raw);
    if (rollback.success) {
      const snapshot = await rollbackMasterSettings({ versionId: rollback.data.versionId, actorId: session.userId, reason: rollback.data.reason });
      await writeAuditLog({ actorId: session.userId, action: "update", category: "system", entityType: "master_settings.rollback", entityId: snapshot.id, afterData: snapshot });
      return ok({ snapshot, settings: await getMasterSettings(), message: `تم نشر نسخة rollback جديدة رقم ${snapshot.version}` });
    }
    const payload = publishSchema.parse(raw);
    const snapshot = payload.action === "draft"
      ? await saveMasterSettingsDraft({ settings: payload.settings, actorId: session.userId, reason: payload.reason, basedOnVersionId: payload.basedOnVersionId })
      : await publishMasterSettings({ settings: payload.settings, actorId: session.userId, reason: payload.reason, basedOnVersionId: payload.basedOnVersionId });
    await writeAuditLog({ actorId: session.userId, action: "update", category: "system", entityType: `master_settings.${payload.action}`, entityId: snapshot.id, afterData: snapshot });
    return ok({ snapshot, settings: payload.action === "publish" ? await getMasterSettings() : null, message: payload.action === "draft" ? "تم حفظ مسودة الحوكمة دون تأثير تشغيلي" : "تم نشر إعدادات الحوكمة المركزية" });
  } catch (error) { return handleApiError(error, "تعذر حفظ حوكمة النظام المركزية"); }
}
