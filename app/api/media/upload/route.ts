export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import crypto from "node:crypto";
import { created, fail, handleApiError } from "@/lib/api";
import { hasRole, hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, mediaAssets } from "@/lib/db";
import { uploadMediaFile, type ImageQualityProfile } from "@/lib/media";
import { isPrivateDocumentFolder, uploadPrivateDocument } from "@/lib/private-documents-storage";
import { getPlatformSecuritySettings, isPlatformLocked } from "@/lib/security-settings";
import { checkIpRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const security = await getPlatformSecuritySettings();
    if (isPlatformLocked(security) || security.disabledModules.uploads) return fail("رفع الملفات متوقف مؤقتاً", 503);
    const rate = await checkIpRateLimit("media:upload", 30, 10 * 60 * 1000);
    if (!rate.allowed) return fail("تم تجاوز حد رفع الملفات مؤقتاً", 429);
    const session = await requireAuth();
    const form = await request.formData();
    const file = form.get("file");
    const storeId = String(form.get("storeId") || "") || null;
    const folder = String(form.get("folder") || (storeId ? `stores/${storeId}` : "marketplace"));
    const requestedProfile = String(form.get("imageQualityProfile") || "").trim();
    const imageQualityProfile: ImageQualityProfile = (["general", "product", "category", "banner"] as const).includes(requestedProfile as ImageQualityProfile)
      ? requestedProfile as ImageQualityProfile
      : folder.includes("/products/") ? "product" : folder.includes("/categories") ? "category" : folder.includes("banner") ? "banner" : "general";

    if (!(file instanceof File)) return fail("لم يتم إرسال ملف", 422);
    if (storeId && !hasStoreAccess(session, storeId) && !hasRole(session, "super_admin")) {
      return fail("لا تملك صلاحية رفع ملفات لهذا المتجر", 403);
    }

    const privateDocument = isPrivateDocumentFolder(folder);
    const uploaded = privateDocument
      ? await uploadPrivateDocument({ file, folder })
      : await uploadMediaFile(file, folder, { imageQualityProfile });
    const sha256 = crypto.createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex");
    const [asset] = await db
      .insert(mediaAssets)
      .values({
        ownerId: session.userId,
        storeId,
        provider: uploaded.provider,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        url: uploaded.url,
        storageKey: uploaded.storageKey,
        metadata: { ...("metadata" in uploaded && uploaded.metadata ? uploaded.metadata : {}), sha256, privateDocument }
      })
      .returning();

    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "media_asset", entityId: asset.id, afterData: asset });
    return created({ asset, message: "تم رفع الملف بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر رفع الملف");
  }
}
