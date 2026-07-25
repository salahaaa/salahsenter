export const dynamic = "force-dynamic";

import { z } from "zod";
import { created, handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { createExperiencePreview, experiencePreviewScopes } from "@/lib/experience-preview";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ scope: z.enum(experiencePreviewScopes), payload: z.unknown(), expiresHours: z.coerce.number().int().min(1).max(72).optional() });
const permissionByScope: Record<(typeof experiencePreviewScopes)[number], string> = { platform_identity: "admin.settings.manage", theme: "theme.manage", home_content: "home.manage", welcome_popup: "home.manage", home_sections: "home.manage" };

export async function POST(request: Request) {
  try {
    const session = await requireAuth(); const payload = schema.parse(await request.json());
    await assertAdmin(session, permissionByScope[payload.scope]);
    const preview = await createExperiencePreview({ scope: payload.scope, payload: payload.payload, userId: session.userId, expiresHours: payload.expiresHours });
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "experience_preview", entityId: preview.session.id, afterData: { scope: payload.scope, expiresAt: preview.expiresAt } });
    return created({ previewId: preview.session.id, previewUrl: `/?experiencePreview=${encodeURIComponent(preview.token)}`, expiresAt: preview.expiresAt, message: "تم إنشاء معاينة خاصة للأدمن فقط؛ لم تنشر أي تغييرات." });
  } catch (error) { return handleApiError(error, "تعذر إنشاء معاينة التعديل"); }
}
