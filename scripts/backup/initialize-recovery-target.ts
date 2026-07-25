import "dotenv/config";
import postgres from "postgres";
import {
  assertDistinctRecoveryTarget,
  assertStagingRecoveryDrillEnvironment,
  initializeStagingRecoveryTarget
} from "@/lib/backup/recovery-target";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} مطلوب لتهيئة recovery target.`);
  return value;
}

async function main() {
  assertStagingRecoveryDrillEnvironment();
  if (process.env.RECOVERY_TARGET_INITIALIZE_CONFIRM !== "INITIALIZE_STAGING_RECOVERY_TARGET") {
    throw new Error("عيّن RECOVERY_TARGET_INITIALIZE_CONFIRM=INITIALIZE_STAGING_RECOVERY_TARGET. هذه العملية تسمح لاحقاً بالاستعادة المدمرة إلى قاعدة recovery فقط.");
  }

  const sourceDatabaseUrl = required("DATABASE_URL");
  const recoveryDatabaseUrl = required("RECOVERY_TEST_DATABASE_URL");
  const targetLabel = required("RECOVERY_TARGET_LABEL");
  assertDistinctRecoveryTarget({ sourceDatabaseUrl, recoveryDatabaseUrl });

  const recoveryClient = postgres(recoveryDatabaseUrl, { max: 1, prepare: false });
  try {
    const target = await initializeStagingRecoveryTarget({ client: recoveryClient, recoveryDatabaseUrl, targetLabel });
    console.log(JSON.stringify({ ok: true, environment: "staging", targetLabel: target.target_label || target.targetLabel, initializedAt: target.initialized_at || target.initializedAt }, null, 2));
  } finally {
    await recoveryClient.end({ timeout: 5 }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
