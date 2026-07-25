export const dynamic = "force-dynamic";

import { asc, desc } from "drizzle-orm";
import { z } from "zod";
import { optionalUrlOrPathSchema, requiredUrlOrPathSchema } from "@/lib/validators";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, defaultActivityMedia, wings } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const mediaSchema = z.object({
  wingId: z.string().uuid(),
  mediaType: z.enum(["cover", "logo", "intro", "gallery", "video", "banner", "icon"]),
  url: requiredUrlOrPathSchema,
  alt: z.string().optional(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true)
});

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "default_media.manage");
    const [media, wingItems] = await Promise.all([
      db.select().from(defaultActivityMedia).orderBy(desc(defaultActivityMedia.createdAt)),
      db.select({ id: wings.id, name: wings.name }).from(wings).orderBy(asc(wings.sortOrder), asc(wings.name))
    ]);
    return ok({ media, wings: wingItems });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل الصور الافتراضية");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "default_media.manage");
    const payload = mediaSchema.parse(await request.json());
    const [media] = await db.insert(defaultActivityMedia).values(payload).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "default_activity_media", entityId: media.id, afterData: media });
    return created({ media, message: "تم حفظ الصورة الافتراضية بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ الصورة الافتراضية");
  }
}
