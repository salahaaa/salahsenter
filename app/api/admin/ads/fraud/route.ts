export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { adCampaigns, adFraudSignals, db, stores } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { reviewAdFraudSignal } from "@/lib/ads/fraud-review";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ signalId: z.string().uuid(), action: z.enum(["confirm_clean", "invalidate"]), note: z.string().trim().min(3).max(2_000) });

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "ads.fraud.view");
    const signals = await db.select({ signal: adFraudSignals, campaignName: adCampaigns.name, storeName: stores.name })
      .from(adFraudSignals)
      .innerJoin(adCampaigns, eq(adFraudSignals.campaignId, adCampaigns.id))
      .innerJoin(stores, eq(adCampaigns.storeId, stores.id))
      .orderBy(desc(adFraudSignals.createdAt)).limit(300);
    return ok({ signals });
  } catch (error) { return handleApiError(error, "تعذر تحميل إشارات جودة الإعلان"); }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "ads.fraud.view");
    const payload = schema.parse(await request.json());
    const result = await db.transaction((tx) => reviewAdFraudSignal({ tx, signalId: payload.signalId, actorId: session.userId, action: payload.action, note: payload.note }));
    await writeAuditLog({ actorId: session.userId, action: "update", category: "financial", entityType: "ad_fraud_signal_review", entityId: payload.signalId, afterData: { action: payload.action, signal: result.signal, credit: result.credit } });
    return ok({ ...result, message: payload.action === "invalidate" ? "تم إبطال الحدث وإنشاء إشعار credit عند وجود تكلفة فوترة." : "تم اعتماد جودة الحدث دون تعديل مالي." });
  } catch (error) { return handleApiError(error, "تعذر مراجعة إشارة جودة الإعلان"); }
}
