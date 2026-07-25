export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { fail, handleApiError } from "@/lib/api";
import { getCurrentSession, hasRole } from "@/lib/auth";
import { db, merchantApplications } from "@/lib/db";
import { privateDocumentKeyFromUrl, readPrivateDocument } from "@/lib/private-documents-storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await getCurrentSession();
    const [application] = await db.select().from(merchantApplications).where(eq(merchantApplications.id, id)).limit(1);
    if (!application?.contractSignatureDataUrl) return fail("التوقيع غير موجود", 404);
    const allowed = Boolean(session && (hasRole(session, "super_admin") || session.userId === application.applicantUserId));
    if (!allowed) return fail("لا تملك صلاحية عرض التوقيع", 403);
    const key = privateDocumentKeyFromUrl(application.contractSignatureDataUrl);
    if (!key) return fail("التوقيع من نسخة قديمة غير خاصة", 409);
    const content = await readPrivateDocument(key);
    return new Response(content, { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل التوقيع الخاص");
  }
}
