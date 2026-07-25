export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { and, eq } from "drizzle-orm";
import { fail, handleApiError } from "@/lib/api";
import { getCurrentSession, hasRole } from "@/lib/auth";
import { db, merchantApplicationDocuments, merchantApplications } from "@/lib/db";
import { privateDocumentKeyFromUrl, readPrivateDocument } from "@/lib/private-documents-storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const { id, documentId } = await context.params;
    const session = await getCurrentSession();
    const [applications, documents] = await Promise.all([
      db.select().from(merchantApplications).where(eq(merchantApplications.id, id)).limit(1),
      db.select().from(merchantApplicationDocuments).where(and(eq(merchantApplicationDocuments.id, documentId), eq(merchantApplicationDocuments.applicationId, id))).limit(1)
    ]);
    const application = applications[0];
    const document = documents[0];
    if (!application || !document) return fail("الوثيقة غير موجودة", 404);
    const allowed = Boolean(session && (hasRole(session, "super_admin") || session.userId === application.applicantUserId));
    if (!allowed) return fail("لا تملك صلاحية تنزيل هذه الوثيقة", 403);
    const key = document.storageKey || privateDocumentKeyFromUrl(document.fileUrl);
    if (!key) return fail("مرجع التخزين الخاص للوثيقة غير موجود", 409);
    const content = await readPrivateDocument(key);
    const safeName = (document.fileName || "document.pdf").replace(/[^a-zA-Z0-9._-]/g, "-");
    return new Response(content, { headers: { "Content-Type": document.mimeType || "application/pdf", "Content-Disposition": `attachment; filename="${safeName}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return handleApiError(error, "تعذر تنزيل الوثيقة الخاصة");
  }
}
