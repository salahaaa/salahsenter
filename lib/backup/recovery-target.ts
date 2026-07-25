import crypto from "node:crypto";

export type RecoveryTargetSqlClient = {
  // postgres-js returns a thenable PendingQuery; `any` keeps this small safety
  // module compatible with both postgres-js and deterministic test doubles.
  unsafe: (query: string, parameters?: any[]) => any;
};

export function normalizedDatabaseIdentity(value: string) {
  const url = new URL(value);
  return `${url.hostname}:${url.port || "5432"}/${url.pathname.replace(/^\//, "")}`.toLowerCase();
}

export function databaseFingerprint(value: string) {
  return crypto.createHash("sha256").update(normalizedDatabaseIdentity(value)).digest("hex");
}

export function assertStagingRecoveryDrillEnvironment(env: Record<string, string | undefined> = process.env) {
  if (env.APP_ENV !== "staging" || env.NEXT_PUBLIC_APP_ENV && env.NEXT_PUBLIC_APP_ENV !== "staging") {
    throw new Error("Recovery drill يعمل فقط عند APP_ENV=staging.");
  }
  if (env.VERCEL_ENV === "production") throw new Error("Recovery drill محظور في Vercel Production.");
  if (env.RECOVERY_TEST_ENVIRONMENT !== "staging") {
    throw new Error("RECOVERY_TEST_ENVIRONMENT=staging مطلوب لمنع الاستعادة على بيئة خاطئة.");
  }
}

export function assertDistinctRecoveryTarget(input: { sourceDatabaseUrl: string; recoveryDatabaseUrl: string }) {
  if (normalizedDatabaseIdentity(input.sourceDatabaseUrl) === normalizedDatabaseIdentity(input.recoveryDatabaseUrl)) {
    throw new Error("RECOVERY_TEST_DATABASE_URL يطابق DATABASE_URL. اختبار الاستعادة على قاعدة المصدر/Production محظور.");
  }
}

export async function initializeStagingRecoveryTarget(input: {
  client: RecoveryTargetSqlClient;
  recoveryDatabaseUrl: string;
  targetLabel: string;
}) {
  const label = input.targetLabel.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._ -]{2,117}$/.test(label)) {
    throw new Error("RECOVERY_TARGET_LABEL يجب أن يكون 3–120 حرفاً آمناً.");
  }
  const fingerprint = databaseFingerprint(input.recoveryDatabaseUrl);
  const [row] = await input.client.unsafe(
    `insert into "backup_recovery_targets" ("environment", "target_label", "target_fingerprint", "is_active", "initialized_at", "updated_at")
     values ('staging', $1, $2, true, now(), now())
     on conflict ("environment") do update
       set "target_label" = excluded."target_label",
           "target_fingerprint" = excluded."target_fingerprint",
           "is_active" = true,
           "updated_at" = now()
     returning "environment", "target_label", "target_fingerprint", "initialized_at"`,
    [label, fingerprint]
  );
  if (!row) throw new Error("تعذر تهيئة recovery target.");
  return row;
}

export async function assertAuthorizedStagingRecoveryTarget(input: {
  client: RecoveryTargetSqlClient;
  recoveryDatabaseUrl: string;
}) {
  const fingerprint = databaseFingerprint(input.recoveryDatabaseUrl);
  const [row] = await input.client.unsafe(
    `select "target_label" as "targetLabel", "target_fingerprint" as "targetFingerprint", "is_active" as "isActive"
     from "backup_recovery_targets"
     where "environment" = 'staging' and "target_fingerprint" = $1 and "is_active" = true
     limit 1`,
    [fingerprint]
  );
  if (!row) {
    throw new Error("قاعدة الاستعادة غير مهيأة كـ Staging recovery target. طبّق migrations ثم شغّل تهيئة recovery target المقصودة.");
  }
  return { targetLabel: String(row.targetLabel), targetFingerprint: fingerprint };
}

export async function recordStagingRecoveryTargetDrill(input: {
  client: RecoveryTargetSqlClient;
  recoveryDatabaseUrl: string;
  backupFile: string;
  backupSha256: string;
}) {
  const fingerprint = databaseFingerprint(input.recoveryDatabaseUrl);
  await input.client.unsafe(
    `update "backup_recovery_targets"
     set "last_drill_at" = now(), "last_drill_status" = 'passed', "last_backup_file" = $1,
         "last_backup_sha256" = $2, "last_verified_at" = now(), "updated_at" = now()
     where "environment" = 'staging' and "target_fingerprint" = $3 and "is_active" = true`,
    [input.backupFile, input.backupSha256, fingerprint]
  );
}
