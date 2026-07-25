/**
 * Merchant Service
 * ================
 * Merchant profile + onboarding helpers. Centralizes the "does this user have
 * an active store / open application" checks that were previously duplicated
 * across routes.
 */

import { and, eq, inArray } from "drizzle-orm";
import { db, merchantApplications, merchants, stores } from "@/lib/db";

export interface MerchantContext {
  userId: string;
  merchantProfileId: string | null;
  primaryStoreId: string | null;
  hasOpenApplication: boolean;
}

/** Resolve the full merchant context for a user in a single round-trip. */
export async function getMerchantContext(userId: string): Promise<MerchantContext> {
  const [merchantProfile, [activeStore], [openApplication]] = await Promise.all([
    db.select({ id: merchants.id }).from(merchants).where(eq(merchants.userId, userId)).limit(1),
    db
      .select({ id: stores.id })
      .from(stores)
      .where(and(eq(stores.merchantId, userId), inArray(stores.status, ["active", "pending", "suspended", "frozen"])))
      .limit(1),
    db
      .select({ id: merchantApplications.id })
      .from(merchantApplications)
      .where(
        and(
          eq(merchantApplications.applicantUserId, userId),
          inArray(merchantApplications.status, ["new", "pending", "under_review", "waiting_for_data", "documents_required", "pre_approved", "contract_created", "contract_signed", "waiting_final_approval"])
        )
      )
      .limit(1)
  ]);

  return {
    userId,
    merchantProfileId: merchantProfile[0]?.id ?? null,
    primaryStoreId: activeStore?.id ?? null,
    hasOpenApplication: Boolean(openApplication)
  };
}

/** True when the user is already a merchant with at least one store. */
export async function isMerchantWithStore(userId: string): Promise<boolean> {
  const ctx = await getMerchantContext(userId);
  return ctx.primaryStoreId !== null;
}
