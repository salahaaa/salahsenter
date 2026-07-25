export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { and, eq } from "drizzle-orm";
import { fail, handleApiError } from "@/lib/api";
import { getCurrentSession, hasRole } from "@/lib/auth";
import { db, merchantApplicationArchives, merchantApplications } from "@/lib/db";
import { privateDocumentKeyFromUrl, readPrivateDocument } from "@/lib/private-documents-storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string; archiveId: string }> }) {
  try {
    const { id, archiveId } = await context.params;
    const session = await getCurrentSession();
    const [applications, archives] = await Promise.all([
      db.select().from(merchantApplications).where(eq(merchantApplications.id, id)).limit(1),
      db.select().from(merchantApplicationArchives).where(and(eq(merchantApplicationArchives.id, archiveId), eq(merchantApplicationArchives.applicationId, id), eq(merchantApplicationArchives.status, "ready"))).limit(1)
    ]);
    const application = applications[0];
    const archive = archives[0];
    if (!application || !archive) return fail("أرشيف العقد غير موجود", 404);
    const allowed = Boolean(session && (hasRole(session, "super_admin") || session.userId === application.applicantUserId));
    if (!allowed) return fail("لا تملك صلاحية تنزيل هذا الأرشيف", 403);
    const key = archive.storageKey || privateDocumentKeyFromUrl(archive.url);
    if (!key) return fail("مرجع التخزين الخاص للأرشيف غير موجود", 409);
    const content = await readPrivateDocument(key);
    const safeKind = archive.kind.replace(/[^a-zA-Z0-9._-]/g, "-");
    return new Response(content, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${safeKind}-${archive.version}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return handleApiError(error, "تعذر تنزيل أرشيف العقد الخاص");
  }
}
