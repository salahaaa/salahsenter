export const dynamic = "force-dynamic";

import { desc } from "drizzle-orm";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, subscriptions } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const subscriptionSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  price: z.coerce.number().min(0).default(0),
  durationDays: z.coerce.number().int().positive().default(30),
  maxProducts: z.coerce.number().int().min(0).default(100),
  maxEmployees: z.coerce.number().int().min(0).default(3),
  maxAnnouncements: z.coerce.number().int().min(0).default(3),
  maxNews: z.coerce.number().int().min(0).default(10),
  maxBranches: z.coerce.number().int().min(0).default(1),
  features: z.array(z.string()).default([]),
  isActive: z.boolean().default(true)
});

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "subscriptions.manage");
    const items = await db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt));
    return ok({ subscriptions: items });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل الاشتراكات");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "subscriptions.manage");
    const payload = subscriptionSchema.parse(await request.json());
    const [subscription] = await db
      .insert(subscriptions)
      .values({
        ...payload,
        price: payload.price.toString()
      })
      .returning();

    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "subscription", entityId: subscription.id, afterData: subscription });
    return created({ subscription, message: "تم حفظ الباقة بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ الباقة");
  }
}
