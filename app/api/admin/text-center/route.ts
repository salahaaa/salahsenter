export const dynamic = "force-dynamic";

import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";
import { listTextCenterEntries, publishTextDraft, restoreTextVersion, saveTextDraft, syncPlatformTextCatalog } from "@/lib/text-center/service";

const localeSchema = z.string().trim().min(2).max(20).default("ar");
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("sync"), locale: localeSchema }),
  z.object({ action: z.literal("save_draft"), key: z.string().trim().min(2).max(220), locale: localeSchema, value: z.string().max(20_000), note: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("publish"), key: z.string().trim().min(2).max(220), locale: localeSchema }),
  z.object({ action: z.literal("restore"), key: z.string().trim().min(2).max(220), locale: localeSchema, versionId: z.string().uuid() })
]);

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "system.settings.view");
    const url = new URL(request.url);
    const locale = localeSchema.parse(url.searchParams.get("locale") || "ar");
    return ok({ entries: await listTextCenterEntries(locale, { namespace: url.searchParams.get("namespace") || undefined, query: url.searchParams.get("q") || undefined }), locale });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل مركز النصوص");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = actionSchema.parse(await request.json());
    await assertAdminOperation(session, payload.action === "sync" ? "system.settings.edit" : "system.settings.edit");

    if (payload.action === "sync") {
      const result = await syncPlatformTextCatalog(session.userId, payload.locale);
      await writeAuditLog({ actorId: session.userId, action: "create", category: "administrative", entityType: "platform_text_catalog_sync", entityId: payload.locale, afterData: result });
      return created({ result, message: `تمت مزامنة ${result.total} نصاً في الكتالوج المركزي.` });
    }
    if (payload.action === "save_draft") {
      const version = await saveTextDraft({ key: payload.key, locale: payload.locale, value: payload.value, note: payload.note, actorId: session.userId });
      await writeAuditLog({ actorId: session.userId, action: "update", category: "administrative", entityType: "platform_text_draft", entityId: payload.key, afterData: { versionId: version.id, locale: payload.locale, versionNumber: version.versionNumber, note: version.changeNote } });
      return ok({ version, message: "تم حفظ المسودة؛ لن تظهر للزوار حتى تنشرها." });
    }
    if (payload.action === "publish") {
      const result = await publishTextDraft({ key: payload.key, locale: payload.locale, actorId: session.userId });
      await writeAuditLog({ actorId: session.userId, action: "update", category: "administrative", entityType: "platform_text_publish", entityId: payload.key, afterData: { locale: payload.locale, versionId: result.published.id, versionNumber: result.published.versionNumber } });
      return ok({ result, message: "تم نشر النص وإبطال الكاش العام." });
    }
    const result = await restoreTextVersion({ key: payload.key, locale: payload.locale, versionId: payload.versionId, actorId: session.userId });
    await writeAuditLog({ actorId: session.userId, action: "update", category: "administrative", entityType: "platform_text_restore", entityId: payload.key, afterData: { locale: payload.locale, restoredVersionId: payload.versionId, publishedVersion: result.published.versionNumber } });
    return ok({ result, message: "تم استرجاع النص ونشر نسخة جديدة مدققة." });
  } catch (error) {
    return handleApiError(error, "تعذر تنفيذ عملية مركز النصوص");
  }
}
