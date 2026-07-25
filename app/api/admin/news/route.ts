export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { optionalUrlOrPathSchema, requiredUrlOrPathSchema } from "@/lib/validators";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, news } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { assertAdmin } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

function revalidatePublicPages() {
  revalidatePath("/");
  revalidatePath("/wings");
}

const newsSchema = z.object({
  title: z.string().min(2),
  body: z.string().optional(),
  linkUrl: optionalUrlOrPathSchema,
  isTicker: z.boolean().default(true),
  isPinned: z.boolean().default(false),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  status: z.enum(["draft", "scheduled", "active", "expired", "disabled"]).default("draft")
});

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "news.manage");
    const items = await db.select().from(news).where(eq(news.level, "marketplace")).orderBy(desc(news.createdAt)).limit(100);
    revalidatePublicPages();
    return ok({ news: items });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل أخبار المول");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "news.manage");
    const payload = newsSchema.parse(await request.json());

    const [item] = await db
      .insert(news)
      .values({
        level: "marketplace",
        storeId: null,
        title: payload.title,
        body: payload.body,
        linkUrl: payload.linkUrl || null,
        isTicker: payload.isTicker,
        isPinned: payload.isPinned,
        startAt: payload.startAt ? new Date(payload.startAt) : null,
        endAt: payload.endAt ? new Date(payload.endAt) : null,
        status: payload.status,
        createdBy: session.userId
      })
      .returning();

    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "marketplace_news", entityId: item.id, afterData: item });
    revalidatePublicPages();
    return created({ news: item, message: "تم حفظ خبر المول بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ خبر المول");
  }
}
