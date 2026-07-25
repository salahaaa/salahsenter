export const dynamic = "force-dynamic";

import { desc } from "drizzle-orm";
import { z } from "zod";
import { optionalUrlOrPathSchema, requiredUrlOrPathSchema } from "@/lib/validators";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { banners, db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { assertAdminOperation } from "@/lib/rbac";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

async function revalidatePublicPages() {
  await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home], paths: ["/"] });
}

const bannerSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  imageUrl: requiredUrlOrPathSchema,
  linkUrl: optionalUrlOrPathSchema,
  placement: z.string().min(2).default("homepage_hero"),
  sortOrder: z.coerce.number().int().default(0),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  status: z.enum(["draft", "scheduled", "active", "expired", "disabled"]).default("draft"),
  visibilitySchedule: z.record(z.unknown()).optional().default({})
});

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "ads.view");
    const items = await db.select().from(banners).orderBy(desc(banners.createdAt)).limit(100);
    return ok({ banners: items });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل البانرات");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "ads.create");
    const payload = bannerSchema.parse(await request.json());

    const [banner] = await db
      .insert(banners)
      .values({
        title: payload.title,
        description: payload.description,
        imageUrl: payload.imageUrl,
        linkUrl: payload.linkUrl || null,
        placement: payload.placement,
        sortOrder: payload.sortOrder,
        startAt: payload.startAt ? new Date(payload.startAt) : null,
        endAt: payload.endAt ? new Date(payload.endAt) : null,
        status: payload.status,
        visibilitySchedule: payload.visibilitySchedule,
        createdBy: session.userId
      })
      .returning();

    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "banner", entityId: banner.id, afterData: banner });
    await revalidatePublicPages();
    return created({ banner, message: "تم حفظ البانر بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ البانر");
  }
}
