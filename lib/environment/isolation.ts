export const APPLICATION_ENVIRONMENTS = ["development", "staging", "production"] as const;
export type ApplicationEnvironment = (typeof APPLICATION_ENVIRONMENTS)[number];

type EnvironmentValues = Record<string, string | undefined>;

export type EnvironmentIsolationCheck = {
  key: string;
  ok: boolean;
  message: string;
};

export type EnvironmentIsolationReport = {
  environment: ApplicationEnvironment;
  enforced: boolean;
  checks: EnvironmentIsolationCheck[];
  ok: boolean;
};

function value(env: EnvironmentValues, key: string) {
  return env[key]?.trim() || "";
}

function truthy(input: string) {
  return ["true", "1", "yes", "on", "enabled"].includes(input.trim().toLowerCase());
}

export function normalizeApplicationEnvironment(input: string | undefined | null): ApplicationEnvironment {
  const normalized = String(input || "").trim().toLowerCase();
  if ((APPLICATION_ENVIRONMENTS as readonly string[]).includes(normalized)) return normalized as ApplicationEnvironment;
  return "development";
}

/**
 * APP_ENV is the explicit deployment contract. Vercel's value is only a safe
 * fallback for older environments that have not yet been migrated to it.
 */
export function resolveApplicationEnvironment(env: EnvironmentValues = process.env): ApplicationEnvironment {
  const explicit = value(env, "APP_ENV") || value(env, "NEXT_PUBLIC_APP_ENV");
  if (explicit) return normalizeApplicationEnvironment(explicit);
  return value(env, "VERCEL_ENV") === "production" ? "production" : "development";
}

export function environmentNamespace(environment: ApplicationEnvironment) {
  return `mall-os:${environment}`;
}

export function isEnvironmentIsolationEnforced(env: EnvironmentValues = process.env) {
  return truthy(value(env, "ENVIRONMENT_ISOLATION_ENFORCED"));
}

function urlHost(raw: string) {
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Verifies the *configuration contract* that keeps external resources from
 * being accidentally shared between Staging and Production. It deliberately
 * never prints credentials or complete URLs.
 *
 * A provider account can still be misconfigured outside this process, so this
 * is paired with separately named buckets/projects and GitHub Environments.
 */
export function getEnvironmentIsolationReport(env: EnvironmentValues = process.env): EnvironmentIsolationReport {
  const environment = resolveApplicationEnvironment(env);
  const enforced = isEnvironmentIsolationEnforced(env);
  const checks: EnvironmentIsolationCheck[] = [];
  const publicEnvironment = value(env, "NEXT_PUBLIC_APP_ENV");
  const runtimeEnvironment = value(env, "RUNTIME_ENVIRONMENT");
  const namespace = value(env, "RESOURCE_NAMESPACE");
  const redisPrefix = value(env, "REDIS_KEY_PREFIX");
  const appUrl = value(env, "NEXT_PUBLIC_APP_URL");
  const publicHost = value(env, "ENVIRONMENT_PUBLIC_HOST").toLowerCase();
  const cloudinaryFolder = value(env, "CLOUDINARY_FOLDER").replace(/^\/+|\/+$/g, "");
  const privateBucket = value(env, "PRIVATE_DOCUMENTS_R2_BUCKET").toLowerCase();
  const privatePrefix = value(env, "PRIVATE_DOCUMENTS_R2_PREFIX").replace(/^\/+|\/+$/g, "");
  const backupBucket = value(env, "BACKUP_S3_BUCKET").toLowerCase();
  const backupPrefix = value(env, "BACKUP_S3_PREFIX").replace(/^\/+|\/+$/g, "");
  const paymentEnvironment = value(env, "PAYMENT_ENVIRONMENT").toLowerCase();
  const erpEnvironment = value(env, "ERP_ENVIRONMENT").toLowerCase();
  const outboundMode = value(env, "OUTBOUND_DELIVERY_MODE").toLowerCase();

  checks.push({
    key: "APP_ENV / NEXT_PUBLIC_APP_ENV",
    ok: !publicEnvironment || normalizeApplicationEnvironment(publicEnvironment) === environment,
    message: "APP_ENV وNEXT_PUBLIC_APP_ENV يجب أن يحددا البيئة نفسها."
  });

  if (environment === "development" && !enforced) {
    checks.push({ key: "Development opt-out", ok: true, message: "التطوير المحلي لا يتطلب موارد تشغيلية مستقلة." });
    return { environment, enforced, checks, ok: true };
  }

  checks.push({
    key: "RUNTIME_ENVIRONMENT",
    ok: runtimeEnvironment === environment,
    message: `RUNTIME_ENVIRONMENT يجب أن يساوي ${environment}.`
  });
  checks.push({
    key: "RESOURCE_NAMESPACE",
    ok: namespace === environmentNamespace(environment),
    message: `RESOURCE_NAMESPACE يجب أن يساوي ${environmentNamespace(environment)}.`
  });
  checks.push({
    key: "REDIS_KEY_PREFIX",
    ok: redisPrefix === `${environmentNamespace(environment)}:`,
    message: `REDIS_KEY_PREFIX يجب أن يساوي ${environmentNamespace(environment)}:.`
  });
  checks.push({
    key: "Public host",
    ok: Boolean(appUrl && urlHost(appUrl) && (!publicHost || urlHost(appUrl) === publicHost)),
    message: "NEXT_PUBLIC_APP_URL يجب أن يكون URL صحيحاً ويطابق ENVIRONMENT_PUBLIC_HOST عند ضبطه."
  });

  // All provider names/prefixes carry the environment as a human-verifiable
  // guardrail. Empty optional providers are allowed; configured providers must
  // declare their isolation boundary.
  if (cloudinaryFolder) {
    checks.push({
      key: "Cloudinary folder",
      ok: cloudinaryFolder === environment || cloudinaryFolder.startsWith(`${environment}/`),
      message: `CLOUDINARY_FOLDER في ${environment} يجب أن يبدأ بـ ${environment}/.`
    });
  }
  if (privateBucket || privatePrefix) {
    checks.push({
      key: "Private R2 documents",
      ok: privateBucket.includes(environment) && (privatePrefix === environment || privatePrefix.startsWith(`${environment}/`)),
      message: `Bucket/Prefix للوثائق الخاصة يجب أن يحمل ${environment} ولا يشارك مسار بيئة أخرى.`
    });
  }
  if (backupBucket || backupPrefix) {
    checks.push({
      key: "Backup storage",
      ok: backupBucket.includes(environment) && (backupPrefix === environment || backupPrefix.startsWith(`${environment}/`)),
      message: `Bucket/Prefix للنسخ الاحتياطي يجب أن يحمل ${environment} ولا يشارك مسار بيئة أخرى.`
    });
  }

  if (environment === "staging") {
    checks.push({ key: "Payment sandbox", ok: paymentEnvironment === "sandbox", message: "PAYMENT_ENVIRONMENT في Staging يجب أن يكون sandbox." });
    checks.push({ key: "ERP sandbox", ok: erpEnvironment === "sandbox", message: "ERP_ENVIRONMENT في Staging يجب أن يكون sandbox." });
    checks.push({ key: "Outbound sandbox", ok: ["sandbox", "disabled"].includes(outboundMode), message: "OUTBOUND_DELIVERY_MODE في Staging يجب أن يكون sandbox أو disabled." });
  }
  if (environment === "production") {
    checks.push({ key: "Payment live mode", ok: paymentEnvironment === "live", message: "PAYMENT_ENVIRONMENT في Production يجب أن يكون live." });
    checks.push({ key: "ERP live mode", ok: erpEnvironment === "live", message: "ERP_ENVIRONMENT في Production يجب أن يكون live." });
    checks.push({ key: "Outbound live mode", ok: outboundMode === "live", message: "OUTBOUND_DELIVERY_MODE في Production يجب أن يكون live." });
    checks.push({ key: "No staging public host", ok: !urlHost(appUrl).includes("staging"), message: "Production لا يجوز أن يستخدم staging في الدومين العام." });
  }

  return { environment, enforced, checks, ok: checks.every((check) => check.ok) };
}

export function assertEnvironmentIsolation(env: EnvironmentValues = process.env) {
  const report = getEnvironmentIsolationReport(env);
  if (!report.enforced || report.ok) return report;
  const failed = report.checks.filter((check) => !check.ok).map((check) => check.key).join(", ");
  throw new Error(`Environment isolation configuration is incomplete for ${report.environment}: ${failed}`);
}
