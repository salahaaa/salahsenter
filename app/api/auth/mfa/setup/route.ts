export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { handleApiError, ok } from "@/lib/api";
import { hasRole, requireAuth } from "@/lib/auth";
import { db, userMfaSettings } from "@/lib/db";
import { buildTotpUrl, generateBackupCodes, generateTotpSecret, hashCodes } from "@/lib/mfa";

export async function POST() {
  try {
    const session = await requireAuth();
    if (!hasRole(session, "super_admin")) throw new Error("المصادقة الثنائية مفعلة حالياً للمدراء فقط");
    const secret = generateTotpSecret();
    const backupCodes = generateBackupCodes();
    const recoveryCodes = generateBackupCodes(5);
    const [settings] = await db
      .insert(userMfaSettings)
      .values({ userId: session.userId, totpSecret: secret, isTotpEnabled: false, backupCodeHashes: await hashCodes(backupCodes), recoveryCodeHashes: await hashCodes(recoveryCodes) })
      .onConflictDoUpdate({ target: userMfaSettings.userId, set: { totpSecret: secret, isTotpEnabled: false, backupCodeHashes: await hashCodes(backupCodes), recoveryCodeHashes: await hashCodes(recoveryCodes), updatedAt: new Date() } })
      .returning();

    return ok({
      settingsId: settings.id,
      secret,
      otpauthUrl: buildTotpUrl({ secret, accountName: session.email }),
      backupCodes,
      recoveryCodes,
      message: "امسح QR/الرابط في Google Authenticator أو Microsoft Authenticator ثم أكد الرمز لتفعيل MFA"
    });
  } catch (error) {
    return handleApiError(error, "تعذر إعداد المصادقة الثنائية");
  }
}
